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
  self.roomtype = info.params.roomtype;
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  setInterval(function() { self.scan(self); }, 60 * 1000);
  self.scan(self);
};
util.inherits(Sensor, climate.Device);
Sensor.prototype.perform = devices.perform;


Sensor.prototype.scan = function(self) {
  self.gateway.cloud.getDeviceState(self.cubeID, function(err, state) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'getDeviceState', diagnostic: err.message });

    self.status = 'absent';
    if (self.updateInfo(state)) {
      self.status = 'present';
      self.changed();
      sensor.update(self.deviceID, state);
    }
  });
};

// algorithm from cbsr.sdk.js -- thanks to alja isakovic for suggesting taking a look!
// not used yet.

Sensor.prototype.comfort = function(self) {
  var d, tc0, tc1, to0, to1, humidity, limit, limits, noise, temperature, v, voc, w;

  var inRange = function(min, val, max) { return Math.min(max, Math.max(min, val)); };

  limits = { work  : { temperature : { range: [15,    31], critical: [  18,   28], optimal: [  21,   24] }
                     , noise       : { range: [ 5,    40], critical: [   0,   22], optimal: [   0,   18] }
                     , light       : { range: [50, 12000], critical: [ 200, 8000], optimal: [ 300, 8000] }
                     }
           , live  : { temperature : { range: [15,    31], critical: [  18,   28], optimal: [  21,   24] }
                     , noise       : { range: [ 5,    40], critical: [   0,   22], optimal: [   0,   18] }
                     , light       : { range: [50, 12000], critical: [ 200, 8000], optimal: [ 300, 8000] }
                     }
           , sleep : { temperature : { range: [15,    31], critical: [  18,   28], optimal: [  21,   24] }
                     , noise       : { range: [ 5,    40], critical: [   0,   22], optimal: [   0,   18] }
                     , light       : { range: [50, 12000], critical: [ 200, 8000], optimal: [ 300, 8000] }
                     }
           };
  limit = limits[self.roomtype] || limits.live;

  tc0 = limit.temperature.critical[0];
  tc1 = limit.temperature.critical[1];
  to0 = limit.temperature.optimal[0];
  to1 = limit.temperature.optimal[1];

  temperature = inRange(tc0 - 3, self.info.temperature, tc1 + 3);
  humidity = inRange(0, self.info.humidity, 100);
  voc = inRange(450, self.info.voc, 3000);
  noise = inRange(5, self.info.noise, 50);

  w = 25;
  d = 15;

  v =   (temperature < to0 
            ? (temperature < tc0
                   ? (-0.25 * Math.pow(Math.abs((temperature - tc0) / (3 / d)), 0.50) + 0.21)
                   : (-0.25 * Math.pow(Math.abs((temperature - to0) / 2.5),     1.66) + 1.00))
            : (temperature > to1
                   ? (temperature > tc1
                          ? (-0.25 * Math.pow(Math.abs((temperature - tc1) / (3 / d)), 0.50) + 0.21)
                          : (-0.25 * Math.pow(Math.abs((temperature - to1) / 1.5),     1.66) + 1.00))
                   : 1)) * w
    + (humidity < 45 
           ? (humidity < 30
                  ? (-0.25 * Math.pow(Math.abs((humidity - 30) / (30 / d)), 0.50) + 0.21)
                  : (-0.25 * Math.pow(Math.abs((humidity - 45) / 7.5),      1.66) + 1.00))
           : (humidity > 55
                  ? (humidity > 65
                         ? (-0.25 * Math.pow(Math.abs((humidity - 65) / (35 / d)), 0.50) + 0.21)
                         : (-0.25 * Math.pow(Math.abs((humidity - 55) / 5),        1.66) + 1.00))
                  : 1)) * w
    + (voc > 450
           ? (voc > 2000
                  ? (-0.25 * Math.pow(Math.abs((voc - 2000) / (1000 / d)), 0.50) + 0.21)
                  : (-0.25 * Math.pow(Math.abs((voc - 450) / 775),         1.66) + 1.00))
           : 1) * w
    + (noise > 18
           ? (noise > 22
                  ? (-0.25 * Math.pow(Math.abs((noise - 22) / (20 / d)), 0.50) + 0.21)
                  : (-0.25 * Math.pow(Math.abs((noise - 18) / 12.5),     1.66) + 1.00))
        : 1) * w;

  return Math.max(0, v).toFixed(0);
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
                                   , rssi         : 's8'
                                   }
                    }
      , $validate : {  perform   : devices.validate_perform }
      };
  devices.makers['/device/climate/cubesensors/meteo'] = Sensor;
};
