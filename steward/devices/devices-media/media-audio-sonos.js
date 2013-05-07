// +++ under development
/*
  seek: HH:MM:SS
  removeall queue
  get track length, duration, playback position,
  playmode: NORMAL, SHUFFLE_NOREPEAT, SHUFFLE, REPEAT_ALL
 */


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
  self.info = { track: {} };

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

  self.sonos.currentTrack(function(err, track) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'currentTrack', diagnostic: err.message });

    if (track !== undefined) {
      self.status = 'play';
      self.info.track = track;
    } else {
      self.status = 'idle';
      self.info.track = { };
    }
    self.changed();
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

// '/ZoneGroupTopology/Event'
// '/MediaRenderer/RenderingControl/Event'
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
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  switch (perform) {
    case 'set':
      return self.setName(params.name);

    case 'play':
      if (!params.url) return false;
      self.sonos.play(params.url, function(err, data) {/* jshint unused: false */
        if (err) logger('device/' + self.deviceID, { event: 'play', diagnostic: err.message });
      });
      break;

    case 'queue':
      if (!params.url) return false;
      self.sonos.queueNext(params.url, function(err, data) {/* jshint unused: false */
        if (err) logger('device/' + self.deviceID, { event: 'queue', diagnostic: err.message });
      });
      break;

    case 'pause':
      self.sonos.pause(function(err, data) {/* jshint unused: false */
        if (err) logger('device/' + self.deviceID, { event: 'stop', diagnostic: err.message });
      });
      break;

    case 'stop':
      self.sonos.stop(function(err, data) {/* jshint unused: false */
        if (err) logger('device/' + self.deviceID, { event: 'stop', diagnostic: err.message });
      });
      break;

    case 'next':
      self.sonos.next(function(err, data) {/* jshint unused: false */
        if (err) logger('device/' + self.deviceID, { event: 'next', diagnostic: err.message });
      });
      break;

    case 'previous':
      self.sonos.previous(function(err, data) {/* jshint unused: false */
        if (err) logger('device/' + self.deviceID, { event: 'previous', diagnostic: err.message });
      });
      break;

    case 'volume':
      if (!params.level) return false;
      self.sonos.setVolume(params.level, function(err, data) {/* jshint unused: false */
        if (err) logger('device/' + self.deviceID, { event: 'setVolume', diagnostic: err.message });
      });
      break;

    case 'mute':
    case 'unmute':
      self.sonos.setMuted(perform === 'mute', function(err, data) {/* jshint unused: false */
        if (err) logger('device/' + self.deviceID, { event: 'setMute', diagnostic: err.message });
      });
      break;

    default:
      return false;
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

    parser.parseString (data['e:propertyset']['e:property'][0].LastChange[0], function(err, event) {
      var state;

      if (err) {
        logger.error('device/' + self.deviceID,
                          { event      : 'xml2js.Parser'
                          , diagnostic : 'parseString'
                          , content    : data['e:propertyset']['e:property'][0].LastChange[0]
                          , exception  : err });
        return;
      }

      switch (event.Event.InstanceID[0].TransportState[0].$.val) {
        case 'PLAYING':          state = 'playing'; break;
        case 'PAUSED_PLAYBACK':  state = 'paused';  break;
        case 'TRANSITIONING':    state = 'busy';    break;
        case 'STOPPED':          state = 'idle';    break;
        default:                 state = 'idle';    break;
      }
      if (self.status !== state) {
        self.status = state;
        self.changed();
      }
    });
  }); } catch(ex) { logger.error('device/' + self.deviceID, { event: 'notify', diagnostic: ex.message }); }
};

Sonos_Audio.prototype.observe = function(self, results) {
  var i, now, onoff, previous;

  now = new Date();

  previous = self.status;
  if (self.status === 'unknown') self.changed(now);
  self.status = 'idle';
  if (!util.isArray(results)) return;

  for (i = 0; i < results.length; i++) {
    onoff = results[i].BinaryState;
    if (!util.isArray(onoff)) continue;

    self.status = parseInt(onoff[0], 10) ? 'on' : 'off';
    break;
  }

  if (self.status != previous) self.changed(now);
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
    case 'queue':
      if (!params.url) result.requires.push('url');
      try { validator.isUrl(params.url); } catch(ex) { result.invalid.push('url'); }
      break;

    case 'pause':
    case 'stop':
    case 'next':
    case 'mute':
    case 'unmute':
      break;

    case 'volume':
      if (!params.level) result.requires.push('level');
      else if (!media.validVolume(params.level)) result.invalid.push('level');
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
                    , perform    : [ 'play', 'stop', 'pause', 'next', 'previous', 'seek', 'queue' ]
                    , properties : { name    : true
                                   , status  : [ 'idle', 'playing', 'paused', 'busy' ]
                                   , track   : { title: true, artist: true, album: true, albumArtURI: true }
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
