exports.start = function() {};return;

// Cube Sensors: http://cubesensors.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


var logger = climate.logger;


var Sensor = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.status = self.initInfo({});

  self.cubeID = info.params.uid;
  self.gateway = info.gateway;
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  setInterval(function() { self.scan(self); }, 15 * 1000);
  self.scan(self);
};
util.inherits(Sensor, climate.Device);
Sensor.prototype.perform = devices.perform;


Sensor.prototype.scan = function(self) {
  self.gateway.getDeviceState(self.cubeID, function(err, state) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'getDeviceState', diagnostic: err.message });

    self.status = 'absent';
    if (self.updateInfo(state)) {
      self.status = 'present';
      self.changed();
      sensor.update(self.deviceID, state);
    }
  });
};


exports.start = function() {
  steward.actors.device.climate.cubesensors = steward.actors.device.climate.cubesensors ||
      { $info     : { type: '/device/climate/cubesensors' } };

  steward.actors.device.climate.cubesensors.meteo =
      { $info     : { type       : '/device/climate/cubesensors/meteo'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'present', 'absent' ]
                                   , lastSample   : 'timestamp'
                                   , temperature  : 'celsius'
                                   , humidity     : 'percentage'
                                   , noise        : 'decibels'
                                   , pressure     : 'millibars'
                                   , voc          : 'ppm'
                                   , light        : 'lux'
                                   , batteryLevel : 'percentage'
                                   }
                    }
      , $validate : {  perform   : devices.validate_perform }
      };
  devices.makers['/device/climate/cubesensors/meteo'] = Sensor;
};
