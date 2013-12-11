// netatmo - personal weather station: http://www.netatmo.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


// var logger = climate.logger;


var Sensor = exports.Device = function(deviceID, deviceUID, info) {
  var param, self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = {};
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  sensor.update(self.deviceID, info.params);

  self.status = 'present';
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Sensor, climate.Device);
Sensor.prototype.perform = devices.perform;


Sensor.prototype.update = function(self, params, status) {
  var param, updateP;

  updateP = false;
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }
  if (updateP) {
    self.changed();
    sensor.update(self.deviceID, params);
  }
};

exports.start = function() {
  steward.actors.device.climate.netatmo = steward.actors.device.climate.netatmo ||
      { $info     : { type: '/device/climate/netatmo' } };

  steward.actors.device.climate.netatmo.sensor =
      { $info     : { type       : '/device/climate/netatmo/sensor'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'present' ]
                                   , location    : 'coordinates'
                                   , lastSample  : 'timestamp'
                                   , temperature : 'celsius'
                                   , humidity    : 'percentage'
                                   , co2         : 'ppm'
                                   , noise       : 'decibels'
                                   , pressure    : 'millibars'
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/climate/netatmo/sensor'] = Sensor;
};
