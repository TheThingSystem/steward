// AppleTV media player: http://www.appletv.com/developer

var airplay     = require('airplay')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , media       = require('./../device-media')
  , mdns        = require('mdns')
  , utility     = require('./../../core/utility')
  , url         = require('url')
  ;


var logger = media.logger;

var AppleTV = exports.Device = function(deviceID, deviceUID, info) {

  this.whatami = '/device/media/appletv/video';
  this.deviceID = deviceID.toString();
  this.deviceUID = deviceUID;
  this.name = info.device.name;
  this.getName();

  this.url = info.url;

  var parts = url.parse(info.url);
  var self = this;

  this.appletv = new airplay.Device(deviceID, {
    host : parts.hostname
  , port: parts.port
  }, function() {
    self.status = 'idle';
    self.changed();
    self.refresh();
    logger.info('device/' + self.deviceID, self.appletv.serverInfo_);
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
, play : function(device, params) {/* jshint unused: false */
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
  var params;
  try { params = JSON.parse(parameter); } catch(e) {}

  if (!!AppleTV.operations[perform]) {
    AppleTV.operations[perform](this.appletv, params);
    return steward.performed(taskID);
  }

  return devices.perform(self, taskID, perform, parameter);
};

var validate_perform = function(perform, parameter) {
  if (!!AppleTV.operations[perform]) return { invalid: [], requires: [] };

  return devices.validate_perform(perform, parameter);
};

AppleTV.prototype.refresh = function() {
  var timeout = (this.status === 'idle') ? (5 * 1000) : 350;
  var self = this;

  this.appletv.status(function(status) {
    self.info.track = status
    self.info.track.position *= 1000;
    self.info.track.duration *= 1000;
    self.changed();

    // TODO: playback status

    // set the timeout here so we don't get a runaway
    // timer condition.
    setTimeout(self.refresh.bind(self), timeout);
  });
};

exports.start = function() {
  var discovery = utility.logger('discovery');

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

    logger.info('mDNS ' + info.device.name, { url: info.url });
    devices.discover(info);

  }).on('serviceDown', function(service) {
    discovery.debug('_airplay._tcp', { event: 'down', name: service.name, host: service.host });
  }).on('serviceChanged', function(service) {
    discovery.debug('_airplay._tcp', { event: 'changed', name: service.name, host: service.host });
  }).on('error', function(err) {
    discovery.error('_airplay._tcp', { event: 'mdns', diagnostic: err.message });
  }).start();


    steward.actors.device.media.appletv = steward.actors.device.media.appletv ||
        { $info     : { type: '/device/media/appletv' } };

    steward.actors.device.media.appletv.video =
        { $info     : { type       : '/device/media/appletv/video'
                      , observe    : [
                                        uri         : true
                                      , position    : 'milliseconds'
                                      , duration    : 'milliseconds'
                                     ]
                      , perform    : [
                                       'play'
                                     , 'stop'
                                     , 'pause'
                                     ]
                      , properties : { name    : true
                                     , status  : [ 'idle' ]
                                     }
                      }
        , $validate : { perform    : validate_perform }
        };
    devices.makers['/device/media/appletv/video'] = AppleTV;
};
