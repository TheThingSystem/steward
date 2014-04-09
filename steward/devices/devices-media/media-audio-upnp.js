// "minimal" UPnP audio renderer control

var sonos       = require('sonos')
  , stringify   = require('json-stringify-safe')
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

var UPnP_Audio = exports.Device = function(deviceID, deviceUID, info) {
  var o, options, self;

  self = this;

  self.whatami = '/device/media/upnp/audio';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.sid = null;
  self.seq = 0;

  options = {};
  if (info.device.model.name === 'gmediarender') {
    options.endpoints = { transport: '/upnp/control/rendertransport1' , rendering: '/upnp/control/rendercontrol1' };
  }

  o = url.parse(info.url);
  self.sonos = new sonos.Sonos(o.hostname, o.port, options);
  self.status = 'idle';
  self.changed();
  self.info = { track: {}, mode: 'normal' };
  self.refreshID = null;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  utility.broker.subscribe('discovery', function(method, headers, content) {
    if (method === 'notify') self.notify(self, headers, content);
  });

// we poll because '/MediaRenderer/RenderingControl/Event' doesn't inform us of changes in volume/mutedness
  self.refresh(self);

  self.jumpstart(self, '/upnp/event/rendertransport1');
//  self.jumpstart(self, '/MediaRenderer/AVTransport/Event');
};
util.inherits(UPnP_Audio, media.Device);


UPnP_Audio.prototype.jumpstart = function(self, path) {
  discovery.upnp_subscribe('device/' + self.deviceID, self.url, self.sid, path, function(err, state, response) {
    var i, secs;

    logger.debug('device/' + self.deviceID, { event   : 'subscribe'
                                            , state   : state
                                            , code    : response.statusCode
                                            , err     : stringify(err)
                                            , headers : stringify(response.headers)
                                            });

    if (err) {
      self.error(self, err, 'subscribe');
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

UPnP_Audio.prototype.perform = function(self, taskID, perform, parameter) {
  var e, param0, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  e = perform;
  param0 = null;
  switch (perform) {
    case 'set':
      if (!!params.name) self.setName(params.name);
      if ((!!params.mode) && (self.info.mode !== params.mode)) {
        param0 = { normal   : 'NORMAL'
                 , repeat   : 'REPEAT_ALL'
                 }[params.mode.toLowerCase()];
        self.sonos.setPlayMode(param0, function(err, data) {/* jshint unused: false */
          if (err) return self.error(self, err,  'setPlayMode');
        });
      }
      if ((!!params.track) && (!!params.track.position) && (!params.track.duration)
              && (self.info.track.position !== params.track.position)) {
        self.sonos.seek(Math.round(params.position / 1000), function(err, data) {/* jshint unused: false */
          if (err) return self.error(self, err,  'seek');
        });
      }
      if ((!!params.volume) && (self.info.volume !== params.volume)) {
        self.sonos.setVolume(params.volume, function(err, data) {/* jshint unused: false */
          if (err) return self.error(self, err,  'setVolume');
        });
      }
      if ((!!params.muted) && (self.info.muted !== params.muted)) {
        self.sonos.setMuted(params.muted === 'on' ? '1' : '0', function(err, data) {/* jshint unused: false */
          if (err) return self.error(self, err,  'setMuted');
        });
      }
      return true;

    case 'wake':
      return self.wake();

    case 'play':
      param0 = (!!params.url) && (params.url.length) ? devices.expand(params.url) : null;
      break;

    case 'stop':
    case 'pause':
      break;

    default:
      return false;
  }

  if (!!param0) {
    self.sonos[e](param0, function(err, data) {/* jshint unused: false */
      if (err) self.error(self, err, e);
    });
  } else {
    self.sonos[e](function(err, data) {/* jshint unused: false */
      if (err) self.error(self, err, e);
    });
  }

  return steward.performed(taskID);
};

UPnP_Audio.prototype.notify = function(self, headers, content) {
  var parser = new xml2js.Parser();

  if ((headers.sid !== self.sid) || (headers.seq < self.seq)) return;
  self.seq = headers.seq + 1;

// NB: strip trailing NUL (rocki!)
  content = content.replace(/\0+$/, '');
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
        return logger.error('device/' + self.deviceID,
                            { event      : 'xml2js.Parser'
                            , diagnostic : 'parseString'
                            , content    : data['e:propertyset']['e:property'][0].LastChange[0]
                            , exception  : err });
      }

      status = { PLAYING          : 'playing'
               , PAUSED_PLAYBACK  : 'paused'
               , TRANSITIONING    : 'busy'
               , STOPPED          : 'idle'
               }[event.Event.InstanceID[0].TransportState[0].$.val] || 'idle';
      if (!!event.Event.InstanceID[0].CurrentPlayMode) {
        mode = { NORMAL           : 'normal'
               , REPEAT_ALL       : 'repeat'
               }[event.Event.InstanceID[0].CurrentPlayMode[0].$.val] || 'normal';
      } else mode = self.info.mode;

      if ((self.info.mode != mode) || (self.status !== status)) {
        self.info.mode = mode;
        self.status = status;
        self.changed();
        self.refresh(self);
      }

// rocki!
      if (!event.Event.InstanceID[0].CurrentTrackMetaData) return self.refresh(self);

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
          delete(track.albumArtURL);
          self.info.track = track;
          self.changed();
        }
      });
    });
  }); } catch(ex) {
    logger.error('device/' + self.deviceID, { event: 'notify', diagnostic: ex.message });
    console.log(content);
  }
};

UPnP_Audio.prototype.refresh = function(self) {
  if (!!self.refreshID) { clearTimeout(self.refreshID); self.refreshID = null; }

  self.sonos.getTransportInfo(function(err, info) {
    var status;

    if (err) return self.error(self, err,  'getTransportInfo');

    status = { PLAYING          : 'playing'
             , PAUSED_PLAYBACK  : 'paused'
             , TRANSITIONING    : 'busy'
             , STOPPED          : 'idle'
             }[info.state] || 'idle';
    if (self.status !== status) {
      self.status = status;
      self.changed();
    }
  });

  self.sonos.currentTrack(function(err, track) {
    if (err) return self.error(self, err,  'currentTrack');

    if ((!!track.uri) && (!track.title) && (!track.artist) && (!track.album)) {
      track.title = track.uri;
      delete(track.uri);
    }
    if ((track !== undefined)
          && ((self.info.track.title !== track.title)
               || (self.info.track.position !== (track.position * 1000))
               || (self.info.track.duration !== (track.duration * 1000)))) {
      delete(track.albumArtURL);
      self.info.track = track;
      self.info.track.position *= 1000;
      self.info.track.duration *= 1000;
      self.changed();
    }
  });

  self.sonos.getVolume(function(err, volume) {
    if (err) return self.error(self, err,  'getVolume');

    if ((volume !== undefined) && (self.info.volume !== volume)) {
      self.info.volume = volume;
      self.changed();
    }
  });

  self.sonos.getMuted(function(err, muted) {
    if (err) return self.error(self, err,  'getMuted');

    if ((muted !== undefined) && (self.info.muted !== (muted ? 'on' : 'off'))) {
      self.info.muted = muted ? 'on' : 'off';
      self.changed();
    }
  });

  self.refreshID = setTimeout (function() { self.refresh(self); }, (self.status === 'idle') ? (5 * 1000) : 350);
};

UPnP_Audio.prototype.error = function(self, err, event) {
  if (err.message === 'socket hang up') return;

  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
  if (self.status !== 'error') {
    self.status = 'error';
    self.changed();
  }
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  switch (perform) {
    case 'wake':
      return true;

    case 'set':
      if (!parameter) {
        result.requires.push('parameter');
        return result;
      }
      if ((!!params.mode) && (!({ normal: true, repeat: true }[params.mode.toLowerCase()]))) {
        result.invalid.push('mode');
      }
      if ((!!params.position) && (!media.validPosition(params.position))) result.invalid.push('position');
      if ((!!params.volume) && (!media.validVolume(params.volume))) result.invalid.push('volume');
      if ((!!params.muted) && (params.muted !== 'on') && (params.muted !== 'off')) result.invalid.push('volume');
      break;

    case 'play':
      if (!!params.url) try { validator.check(devices.expand(params.url)).isUrl(); } catch(ex) { result.invalid.push('url'); }
      break;

    case 'stop':
    case 'pause':
      break;

    default:
      result.invalid.push('perform');
      break;
  }

  return result;
};


exports.start = function() {
  steward.actors.device.media.upnp = steward.actors.device.media.upnp ||
      { $info     : { type: '/device/media/upnp' } };

  steward.actors.device.media.upnp.audio =
      { $info     : { type       : '/device/media/upnp/audio'
                    , observe    : [ ]
                    , perform    : [ 'play'
                                   , 'stop'
                                   , 'pause'
                                   , 'wake'
                                   ]
                    , properties : { name    : true
                                   , status  : [ 'idle', 'playing', 'paused', 'busy', 'error' ]
                                   , track   : { title       : true
                                               , artist      : true
                                               , album       : true
                                               , albumArtURI : true
                                               , position    : 'milliseconds'
                                               , duration    : 'milliseconds'
                                               }
                                   , mode    : [ 'normal', 'repeat' ]
                                   , volume  : 'percentage'
                                   , muted   : [ 'on', 'off' ]
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['urn:schemas-upnp-org:device:MediaRenderer:1'] = UPnP_Audio;
};
