// plantlink: http://myplantlink.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


// var logger = climate.logger;


var Sensor = exports.Device = function(deviceID, deviceUID, info) {
  var param, self, status;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = {};
  status = info.params.status;
  delete(info.params.status);
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  self.update(self, info.params, status);
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

  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }

  status = (status !== 'Hardware Error') ? 'present' : 'error';
  if (self.status !== status) {
    self.status = status;
    updateP = true;
  }

  if (updateP) {
    self.changed();
    sensor.update(self.deviceID, params);
  }
};

var Plant = exports.Device = function(deviceID, deviceUID, info) {
  var param, self, status;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = {};
  status = info.params.status;
  delete(info.params.status);
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  self.update(self, info.params, status);
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Plant, climate.Device);
Plant.prototype.perform = devices.perform;


Plant.prototype.update = function(self, params, status) {
  var color, param, updateP;

  updateP = false;

  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }

  color = self.info.needsWater === 'true' ? 'orange' : 'green';
  switch(status) {
    case 'Link Missing':
    case 'No Soil':
    case 'Hardware Error':
    case 0:
      color = 'red';
      break;

    case 'Waiting on First Measurement':
      color = 'blue';
      break;

    default:
      break;
  }
  if (self.status !== color) {
    self.status = color;
    updateP = true;
  }

  if (updateP) self.changed();
};

exports.start = function() {
  var colors, status;

  steward.actors.device.climate.plantlink = steward.actors.device.climate.plantlink ||
      { $info     : { type: '/device/climate/plantlink' } };

  steward.actors.device.climate.plantlink.soil =
      { $info     : { type       : '/device/climate/plantlink/soil'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'present', 'error' ]
                                   , placement    : true
                                   , lastSample   : 'timestamp'
                                   , moisture     : 'millibars'
                                   , rssi         : 's8'
                                   , batteryLevel : 'percentage'
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/climate/plantlink/soil'] = Sensor;

  colors = [];
  for (status in devices.rainbow) if (devices.rainbow.hasOwnProperty(status)) colors.push(devices.rainbow[status].color);

  steward.actors.device.climate.plantlink.plant =
      { $info     : { type       : '/device/climate/plantlink/plant'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name            : true
                                   , status          : colors
                                   , placement       : true
                                   , lastSample      : 'timestamp'
                                   , needsWater      : [ 'true', 'false' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/climate/plantlink/plant'] = Plant;
};
