// Parrot Flower Power: http://www.parrot.com/flowerpower/

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

var Plant = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.initInfo(info.params);
  self.update(self, info.params);
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Plant, climate.Device);
Plant.prototype.perform = devices.perform;


Plant.prototype.update = function(self, params) {
  var color, updateP;

  updateP = self.updateInfo(params);

  color = ((self.info.needsMist === 'true') || (self.info.needsFertilizer === 'true'))
              ? 'orange' : ((self.info.adviseChange === 'true') || (self.info.adviseLight === 'true')) ? 'blue' : 'green';
  if (self.status !== color) {
    self.status = color;
    updateP = true;
  }

  if (updateP) self.changed();
};

exports.start = function() {
  var colors, status;

  steward.actors.device.climate['flower-power'] = steward.actors.device.climate['flower-power'] ||
      { $info     : { type: '/device/climate/flower-power' } };

  steward.actors.device.climate['flower-power'].soil =
      { $info     : { type       : '/device/climate/flower-power/soil'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'present' ]
                                   , placement    : true
                                   , location     : 'coordinates'
                                   , lastSample   : 'timestamp'
                                   , moisture     : 'millibars'
                                   , waterVolume  : 'percentage'
                                   , temperature  : 'celsius'
                                   , light        : 'lux'
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/climate/flower-power/soil'] = Sensor;

  colors = [];
  for (status in devices.rainbow) if (devices.rainbow.hasOwnProperty(status)) colors.push(devices.rainbow[status].color);

  steward.actors.device.climate['flower-power'].plant =
      { $info     : { type       : '/device/climate/flower-power/plant'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name            : true
                                   , status          : colors
                                   , placement       : true
                                   , lastSample      : 'timestamp'
                                   , needsWater      : [ 'true', 'false' ]
                                   , needsFertilizer : [ 'true', 'false' ]
                                   , adviseChange    : true
                                   , adviseLight     : true
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/climate/flower-power/plant'] = Plant;
};
