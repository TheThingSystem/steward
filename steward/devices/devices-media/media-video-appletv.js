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
  var parts;

  var self = this;

  self.whatami = '/device/media/appletv/video';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = { track : { url: '', position: 0, duration: 0 } };

  self.url = info.url;
  parts = url.parse(info.url);

  self.appletv = new airplay.Device(deviceID, {
    host : parts.hostname
  , port : parts.port
  }, function(err) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'creation', diagnostic: err.message });

    self.status = 'idle';
    self.changed();
    self.refresh();
/* LATER: look at self.appletv.serverInfo_.features: 1: video, 2: photo, 4: video volume control, 64: slideshow, 512: audio
 */
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(AppleTV, media.Device);


AppleTV.operations = {
  stop : function(device, params) {/* jshint unused: false */
    device.stop();
  }
, play : function(device, params) {
    if (params && params.url) {
      device.play(params.url, 0);
    } else {
      device.rate(1.0);
    }
  }
, pause : function(device, params) {/* jshint unused: false */
    device.rate(0.0);
  }
};


AppleTV.prototype.perform = function(self, taskID, perform, parameter) {
  var params, position, volume;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!!AppleTV.operations[perform]) {
    AppleTV.operations[perform](self.appletv, params);

    self.refresh();

    return steward.performed(taskID);
  }

  if ((perform === 'set') && (!!params.position)) {
    position = parseFloat(params.position);
    if (isNaN(position)) {
      position = 0;
    }

    self.appletv.scrub(position/1000);
  }

  if ((perform === 'set') && (!!params.volume) && (media.validVolume(params.volume))) self.appletv.volume(volume);

  return devices.perform(self, taskID, perform, parameter);
};

var validate_perform = function(perform, parameter) {
  var params, result;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }
  result = { invalid: [], requires: [] };

  if (!!AppleTV.operations[perform]) return result;

  if (perform === 'set') {
    if ((!!params.position) && (!media.validPosition(params.position))) result.invalid.push('position');
    if ((!!params.volume)   && (!media.validVolume(params.volume)))     result.invalid.push('volume');

    if (result.invalid.length > 0) return result;
  }

  return devices.validate_perform(perform, parameter);
};

AppleTV.prototype.refresh = function() {
  var self = this;

  if (this.timer) { clearTimeout(this.timer); }

  var timeout = (this.status === 'idle') ? (5 * 1000) : 350;
  this.timer = setTimeout(this.refresh.bind(this), timeout);

  this.appletv.status(function(err, stats) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'status', diagnostic: err.message });

    var status = self.status;

    if (stats.duration === undefined) {
      status = 'idle';
    } else {
      stats.position *= 1000;
      stats.duration *= 1000;

      if (status.position === self.info.track.position) {
        status = "paused";
      } else {
        status = "playing";
      }

      self.info.track = stats;
    }

    var changed = self.status !== status;
    self.status = status;

    if (changed) {
      self.appletv.playbackAccessLog(function(e, o) {
        if (!e) {
          var trackChanged = o.url !== self.info.uri;
          self.info.uri = o.url;

          if (trackChanged) {
            self.changed();
          }
        }
      });
      self.changed();
    }
  });
};

exports.start = function() {
  var discovery = utility.logger('discovery');

  try {
    mdns.createBrowser(mdns.tcp('airplay')).on('serviceUp', function(service) {
      var model = service.txtRecord.model.match(/([\d]*),([\d]*)/).slice(1).join('.');
      var info =  { source  : 'mdns'
                  , device  : { url          : 'http://' + service.host + ':' + service.port + '/'
                              , name         : service.name
                              , manufacturer : 'APPLE'
                              , model        : { name        : service.name
                                               , description : service.name
                                               , number      : model
                                               }
                              , unit         : { serial      : service.txtRecord.macaddress
                                               , udn         : 'uuid:' + service.txtRecord.macaddress
                                               }
                                }
                  };

      info.url = info.device.url;

      info.deviceType = '/device/media/appletv/video';
      info.id = info.device.unit.udn;
      if (devices.devices[info.id]) return;

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
                                   ]
                    , properties : { name    : true
                                   , status  : [ 'idle', 'playing', 'paused' ]
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
