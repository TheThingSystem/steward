// SonOS speakers: http://www.sonos.com/system

var stringify   = require('json-stringify-safe')
  , sonos       = require('sonos')
  , url         = require('url')
  , util        = require('util')
  , validator   = require('validator')
  , xml2js      = require('xml2js')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , discovery   = require('./../../discovery/discovery-ssdp')
  , media       = require('./../device-media')
  ;


var logger = media.logger;

var Sonos_Audio = exports.Device = function(deviceID, deviceUID, info) {
  var o, self;

  self = this;

  self.whatami = '/device/media/sonos/audio';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'unknown';
  self.sid = null;
  self.seq = 0;

  o = url.parse(info.url);
  self.sonos = new sonos.Sonos(o.hostname, o.port);
  self.status = 'idle';
  self.info = { track: {}, mode: 'normal' };
  self.refreshID = null;

  self.sonos.getZoneAttrs(function(err, attrs) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'getZoneAttrs', diagnostic: err.message });

    self.setName(attrs.CurrentZoneName);
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'ping') {
      logger.info('device/' + self.deviceID, { status: self.status });
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') self.perform(self, taskID, perform, parameter);
  });

  utility.broker.subscribe('discovery', function(method, headers, content) {
    if (method === 'notify') self.notify(self, headers, content);
  });

// we poll because '/MediaRenderer/RenderingControl/Event' dosen't inform us of changes in volume/mutedness
  self.refresh(self);

  self.jumpstart(self, '/MediaRenderer/AVTransport/Event');
};
util.inherits(Sonos_Audio, media.Device);


Sonos_Audio.prototype.jumpstart = function(self, path) {
  discovery.upnp_subscribe('device/' + self.deviceID, self.url, self.sid, path, function(err, state, response) {
    var i, secs;

    logger.debug('subscribe: ' + state + ' code ' + response.statusCode,
                      { err: stringify(err), headers: stringify(response.headers) });
    if (err) {
      logger.info('device/' + self.deviceID, { event: 'subscribe', diagnostic: err.message });
      setTimeout(function() { self.jumpstart(self, path); }, secs * 30 * 1000);
      return;
    }

    if ((response.statusCode !== 200) || (!response.headers.sid)) {
      self.sid = null;
      setTimeout(function() { self.jumpstart(self, path); }, secs * 30 * 1000);
      return;
    }

    self.sid = response.headers.sid;
    self.seq = 0;
    if (!!response.headers.timeout) {
      secs = response.headers.timeout;
      if ((i = secs.indexOf('Second-')) >= 0) secs = secs.substring(i + 7);
      secs = parseInt(secs, 10) - 1;
      if (secs <= 10) secs = 10;
      setTimeout(function() { self.jumpstart(self, path); }, secs * 1000);
    } else secs = 0;

    logger.info('device/' + self.deviceID, { subscribe: self.sid, path: path, sequence: self.seq, seconds: secs });
  });
};

Sonos_Audio.prototype.perform = function(self, taskID, perform, parameter) {/* jshint multistr: true */
  var e, param0, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  e = perform;
  param0 = null;
  switch (perform) {
    case 'set':
      if (!params.name) return false;
      e = 'setName';
      self.setName(param0 = params.name);
      break;

    case 'play':
      param0 = (!!params.url) && (params.url.length) ? params.url : null;
      break;

    case 'queueNext':
      if (!params.url) return false;
      param0 = params.url;
      break;

    case 'stop':
    case 'pause':
    case 'next':
    case 'previous':
    case 'flush':
      break;

    case 'seek':
      if (!params.position) return false;
      param0 = params.position;
      break;

    case 'mode':
      if (!params.value) return false;
      e = 'setPlayMode';
      param0 = { normal   : 'NORMAL'
               , repeat   : 'REPEAT_ALL'
               , shuffle  : 'SHUFFLE'
               , shuffle1 : 'SHUFFLE_NOREPEAT'
               }[params.value.toLowerCase()];
      break;

    case 'volume':
      if (!params.level) return false;
      e = 'setVolume';
      param0 = params.level;
      break;

    case 'mute':
    case 'unmute':
      e = 'setMuted';
      param0 = perform === 'mute' ? '1' : '0';
      break;

    default:
      return false;
  }

  if (!!param0) {
    self.sonos[e](param0, function(err, data) {/* jshint unused: false */
      if (err) logger.error('device/' + self.deviceID, { event: e, diagnostic: err.message });
    });
  } else {
    self.sonos[e](function(err, data) {/* jshint unused: false */
      if (err) logger.error('device/' + self.deviceID, { event: e, diagnostic: err.message });
    });
  }

  return steward.performed(taskID);
};

Sonos_Audio.prototype.notify = function(self, headers, content) {
  var parser = new xml2js.Parser();

  if ((headers.sid !== self.sid) || (headers.seq < self.seq)) return;
  self.seq = headers.seq + 1;

  try { parser.parseString(content, function(err, data) {
    if (err) {
      logger.error('device/' + self.deviceID, { event: 'xml2js.Parser', content: content, diagnostic: err.message });
      return;
    }

    if ((!data['e:propertyset'])
          || (!util.isArray(data['e:propertyset']['e:property']))
          || (!util.isArray(data['e:propertyset']['e:property'][0].LastChange))) return;

    parser.parseString(data['e:propertyset']['e:property'][0].LastChange[0], function(err, event) {
      var mode, status;

      if (err) {
        logger.error('device/' + self.deviceID,
                          { event      : 'xml2js.Parser'
                          , diagnostic : 'parseString'
                          , content    : data['e:propertyset']['e:property'][0].LastChange[0]
                          , exception  : err });
        return;
      }

      status = { PLAYING          : 'playing'
               , PAUSED_PLAYBACK  : 'paused'
               , TRANSITIONING    : 'busy'
               , STOPPED          : 'idle'
               }[event.Event.InstanceID[0].TransportState[0].$.val] || 'idle';
      mode   = { NORMAL           : 'normal'
               , REPEAT_ALL       : 'repeat'
               , SHUFFLE          : 'shuffle'
               , SHUFFLE_NOREPEAT : 'shuffle1'
               }[event.Event.InstanceID[0].CurrentPlayMode[0].$.val] || 'normal';

      if ((self.info.mode != mode) || (self.status !== status)) {
        self.info.mode = mode;
        self.status = status;
        self.changed();
        self.refresh(self);
      }

      parser.parseString(event.Event.InstanceID[0].CurrentTrackMetaData[0].$.val, function(err, didl) {
        var track;

        if (err) {
          logger.error('device/' + self.deviceID,
                            { event      : 'xml2js.Parser'
                            , diagnostic : 'parseString'
                            , content    : event.Event.InstanceID[0].CurrentTrackMetaData[0].$.val
                            , exception  : err });
          return;
        }

        track = self.sonos.parseDIDL(didl);
        if ((self.info.track.title !== track.title)
                || (self.info.track.artist !== track.artist)
                || (self.info.track.album !== track.album)
                || (self.info.track.albumArtURI !== track.albumArtURI)) {
          self.info.track = track;
          self.changed();
        }
      });
    });
  }); } catch(ex) { logger.error('device/' + self.deviceID, { event: 'notify', diagnostic: ex.message }); }
};

Sonos_Audio.prototype.refresh = function(self) {
  if (!!self.refreshID) {
    clearTimeout(self.refreshID);
    self.refreshID = null;
  }

  self.sonos.currentTrack(function(err, track) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'currentTrack', diagnostic: err.message });

    if (track !== undefined) {      
      self.info.track = track;
      self.changed();
    }
  });

  self.sonos.currentVolume(function(err, volume) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'currentVolume', diagnostic: err.message });

    if (volume !== undefined) {
      self.info.volume = volume;
      self.changed();
    }
  });

  self.sonos.currentMuted(function(err, muted) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'currentMuted', diagnostic: err.message });

    if (muted !== undefined) {
      self.info.muted = muted;
      self.changed();
    }
  });

  self.refreshID = setTimeout (function() { self.refresh(self); }, (self.status === 'idle') ? (5 * 1000) : 350);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }
  switch (perform) {
    case 'set':
      if (!parameter) {
        result.requires.push('parameter');
        return result;
      }

      if (!params.name) result.requires.push('name');
      break;

    case 'play':
      if (!!params.url) try { validator.check(params.url).isUrl(); } catch(ex) { result.invalid.push('url'); }
      break;

    case 'queueNext':
      if (!params.url) result.requires.push('url');
      else try { validator.check(params.url).isUrl(); } catch(ex) { result.invalid.push('url'); }
      break;

    case 'stop':
    case 'pause':
    case 'next':
    case 'previous':
    case 'mute':
    case 'unmute':
    case 'flush':
      break;

    case 'seek':
      if (!params.position) result.requires.push('position');
      else if (!media.validPosition(params.position)) result.invalid.push('position');
      break;

    case 'volume':
      if (!params.level) result.requires.push('level');
      else if (!media.validVolume(params.level)) result.invalid.push('level');
      break;

    case 'mode':
      if (!params.value) result.requires.push('value');
      break;

    default:
      result.invalid.push('perform');
      break;
  }

  return result;
};


var Sonos_Bridge = function(deviceID, deviceUID, info) {
  var self;

  self = this;

  self.whatami = '/device/media/sonos/bridge';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName ();

  self.info = {};
  self.status = 'present';

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'ping') return logger.info('device/' + self.deviceID, { status: self.status });

         if (actor !== ('device/' + self.deviceID)) return;
    else if (request === 'perform') devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Sonos_Bridge, media.Device);


exports.start = function() {
  steward.actors.device.media.sonos = steward.actors.device.media.sonos ||
      { $info     : { type: '/device/media/sonos' } };

  steward.actors.device.media.sonos.audio =
      { $info     : { type       : '/device/media/sonos/audio'
                    , observe    : [ ]
                    , perform    : [ 'play'
                                   , 'queueNext'
                                   , 'stop'
                                   , 'pause'
                                   , 'next'
                                   , 'previous'
                                   , 'seek'
                                   , 'mode'
                                   , 'volume'
                                   , 'mute'
                                   , 'unmute'
                                   , 'flush'
                                   ]
                    , properties : { name    : true
                                   , status  : [ 'idle', 'playing', 'paused', 'busy' ]
                                   , mode    : [ 'normal', 'repeat' , 'shuffle', 'shuffle1' ]
                                   , track   : { title: true, artist: true, album: true, albumArtURI: true }
                                   , position: 'seconds'
                                   , volume  : 'percentage'
                                   , muted   : [ 'on', 'off' ]
                                   }
                    }
      , $validate : {  perform   : validate_perform }
      };
  devices.makers['urn:schemas-upnp-org:device:ZonePlayer:1'] = Sonos_Audio;

  steward.actors.device.media.sonos.bridge =
      { $info     : { type       : '/device/media/sonos/bridge'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name    : true
                                   , status  : [ 'present' ]
                                   }
                    }
      , $validate : {  perform   : devices.validate_perform }
      };
  devices.makers['Sonos ZoneBridge ZB100'] = Sonos_Bridge;
};
