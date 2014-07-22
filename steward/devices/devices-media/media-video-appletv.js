// AppleTV media player: http://www.appletv.com/developer

var mdns
  , utility     = require('./../../core/utility')
  ;

try {
  mdns          = require('mdns');
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing video-appletv media (continuing)', { diagnostic: ex.message });
}

var airplay     = require('airplay')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , media       = require('./../device-media')
  , url         = require('url')
  ;


var logger = media.logger;


var AppleTV = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = { track: { url: '', position: 0, duration: 0 } };

  self.status = 'waiting';
  self.changed();
  self.timer = null;
  self.params =  url.parse(info.url);

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.prime(self);
};
util.inherits(AppleTV, media.Device);


AppleTV.prototype.prime = function(self) {
  if (!!self.appletv) return;

  self.appletv = new airplay.Device(self.deviceID, { host: self.params.hostname, port: self.params.port }, function(err) {
    if (!!err) return self.error(self, err, 'prime');

    self.status = 'idle';
    self.changed();
    self.refresh();
/* LATER: look at self.appletv.serverInfo_.features: 1: video, 2: photo, 4: video volume control, 64: slideshow, 512: audio
 */
  });
};

AppleTV.prototype.error = function(self, err, event) {
  self.status = 'error';
  self.changed();
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });

  if (self.timer) {
    clearTimeout(self.timer);
    self.timer = null;
  }
  self.appletv = null;

  setTimeout(function() { self.prime(self); }, 30 * 1000);
};

AppleTV.operations =
{ stop  : function(device, params) {/* jshint unused: false */
            device.stop();
          }

, play  : function(device, params) {
            if (params && params.url) {
              device.play(params.url, 0);
            } else {
              device.rate(1.0);
            }
          }

, pause : function(device, params) {/* jshint unused: false */
            device.rate(0.0);
          }

, set   : function(self, params) {
            devices.attempt_perform('name', params, function(value) {
              self.setName(value);
            });
            devices.attempt_perform('ikon', params, function(value) {
              self.setIkon(value);
            });

            devices.attempt_perform('position', params, function(value) {
              value = parseFloat(value);
              if (media.validPosition(value)) self.appletv.scrub( value / 1000);
            });

            devices.attempt_perform('volume', params, function(value) {
              if (media.validVolume(value)) self.appletv.volume(value);
            });
          }
};


AppleTV.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!AppleTV.operations[perform]) return devices.perform(self, taskID, perform, parameter);

  AppleTV.operations[perform](self.appletv, params);
  setTimeout(function() { self.refresh(); }, 0);
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!AppleTV.operations[perform]) return devices.validate_perform(perform, parameter);

  devices.validate_param('name',     params, result, false,                { });
  devices.validate_param('ikon',     params, result, false,                { });
  devices.validate_param('position', params, result, media.validPosition,  { });
  devices.validate_param('volume',   params, result, media.validVolume,    { });

  return result;
};

AppleTV.prototype.refresh = function() {
  var self = this;

  if (self.timer) clearTimeout(self.timer);

  var timeout = (self.status === 'idle') ? (5 * 1000) : 350;
  self.timer = setTimeout(self.refresh.bind(self), timeout);

  self.appletv.status(function(err, stats) {
    var status;

    if (!!err) return self.error(self, err, 'status');

    status = self.status;
    if (stats.duration === undefined) {
      status = 'idle';
    } else {
      stats.position = (stats.position * 1000).toFixed(0);
      stats.duration = (stats.duration * 1000).toFixed(0);

      if (status.position === self.info.track.position) {
        status = "paused";
      } else {
        status = "playing";
      }

      self.info.track.position = stats.position;
      self.info.track.duration = stats.duration;
    }

    if (self.status === status) {
      if (self.status !== 'playing') return;
      if (!!self.info.track.url) return self.changed();
    }
    self.status = status;
    self.changed();

    self.appletv.playbackAccessLog(function(err, o) {
      if (!!err) return self.error(self, err, 'playbackAccessLog');

      if (!o) return;

      if (self.info.track.url !== o.uri) {
        self.info.track.url = o.uri;
        self.changed();
      }
    });
  });
};

exports.start = function() {
  var discovery = utility.logger('discovery');

  try {
    mdns.createBrowser(mdns.tcp('airplay')).on('serviceUp', function(service) {
      var info, mac, model, suffix;
      if (service.name.indexOf('XBMC') === 0) return;

      model = service.txtRecord.model.match(/([\d]*),([\d]*)/).slice(1).join('.');
      mac = devices.ip2mac[service.addresses[0]] || service.txtRecord.deviceid;
      suffix = mac.split(':').join('').toLowerCase();
      info =  { source  : 'mdns'
              , device  : { url          : 'http://' + service.addresses[0] + ':' + service.port + '/'
                          , name         : service.name
                          , manufacturer : 'APPLE'
                          , model        : { name        : service.name
                                           , description : ''
                                           , number      : model
                                           }
                          , unit         : { serial      : service.txtRecord.deviceid
                                           , udn         : 'uuid:2f402f80-da50-11e1-9b23-' + suffix
                                           }
                            }
              };
      info.url = info.device.url;
      info.deviceType = '/device/media/appletv/video';
      info.id = info.device.unit.udn;
      if (!!devices.devices[info.id]) return;

      discovery.info('mDNS ' + info.device.name, { url: info.url });
      devices.discover(info);
    }).on('serviceDown', function(service) {
      discovery.debug('_airplay._tcp', { event: 'down', name: service.name, host: service.host });
    }).on('serviceChanged', function(service) {
      discovery.debug('_airplay._tcp', { event: 'changed', name: service.name, host: service.host });
    }).on('error', function(err) {
      discovery.error('_airplay._tcp', { event: 'mdns', diagnostic: err.message });
    }).start();
  } catch(ex) {
      discovery.error('_airplay._tcp', { event: 'browse', diagnostic: ex.message });
  }

  steward.actors.device.media.appletv = steward.actors.device.media.appletv ||
      { $info     : { type: '/device/media/appletv' } };

  steward.actors.device.media.appletv.video =
      { $info     : { type       : '/device/media/appletv/video'
                    , observe    : [ ]
                    , perform    : [ 'play'
                                   , 'stop'
                                   , 'pause'
                                   , 'wake'
                                   ]
                    , properties : { name    : true
                                   , status  : [ 'idle', 'playing', 'paused', 'waiting', 'error' ]
                                   , track   : { uri         : true
                                               , position    : 'milliseconds'
                                               , duration    : 'milliseconds'
                                               }
                                   , volume  : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/media/appletv/video'] = AppleTV;
};
