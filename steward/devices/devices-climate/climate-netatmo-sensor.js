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
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = self.initInfo(info.params);
  sensor.update(self.deviceID, info.params);
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Sensor, climate.Device);
Sensor.prototype.perform = devices.perform;


Sensor.prototype.update = function(self, params, status) {
  var updateP = false;

  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  if (self.updateInfo(params)) updateP = true;

  if (updateP) {
    self.changed();
    sensor.update(self.deviceID, params);
  }
};

exports.start = function() {
  steward.actors.device.climate.netatmo = steward.actors.device.climate.netatmo ||
      { $info     : { type: '/device/climate/netatmo' } };

  steward.actors.device.climate.netatmo.meteo =
      { $info     : { type       : '/device/climate/netatmo/meteo'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'present' ]
                                   , placement    : true
                                   , location     : 'coordinates'
                                   , lastSample   : 'timestamp'
                                   , temperature  : 'celsius'
                                   , humidity     : 'percentage'
                                   , co2          : 'ppm'
                                   , noise        : 'decibels'
                                   , pressure     : 'millibars'
                                   , batteryLevel : 'percentage'
                                   , rssi         : 's8'
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/climate/netatmo/meteo'] = Sensor;

  steward.actors.device.climate.netatmo.rain =
      { $info     : { type       : '/device/climate/netatmo/rain'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'present' ]
                                   , placement    : true
                                   , location     : 'coordinates'
                                   , lastSample   : 'timestamp'
                                   , rainTotal    : 'millimeters'
                                   , batteryLevel : 'percentage'
                                   , rssi         : 's8'
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/climate/netatmo/rain'] = Sensor;
};
