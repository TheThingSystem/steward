// koubachi - interactive plant care: http://www.koubachi.com

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

var Plant = exports.Device = function(deviceID, deviceUID, info) {
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
  self.update(self, info.params);
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Plant, climate.Device);


Plant.prototype.update = function(self, params) {
  var color, param, updateP;

  updateP = false;

  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }

  color = ((self.info.needsWater === 'true') || (self.info.needsMist === 'true') || (self.info.needsFertilizer === 'true'))
              ? 'orange' : ((self.info.adviseChange === 'true') || (self.info.adviseLight=== 'true')) ? 'blue' : 'green';
  if (self.status !== color) {
    self.status = color;
    updateP = true;
  }

  if (updateP) self.changed();
};

exports.start = function() {
  var colors, status;

  steward.actors.device.climate.koubachi = steward.actors.device.climate.koubachi ||
      { $info     : { type: '/device/climate/koubachi' } };

  steward.actors.device.climate.koubachi.sensor =
      { $info     : { type       : '/device/climate/koubachi/sensor'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'present' ]
                                   , placement   : true
                                   , lastSample  : 'timestamp'
                                   , nextSample  : 'timestamp'
                                   , moisture    : 'millibars'
                                   , temperature : 'celsius'
                                   , light       : 'lux'
                                   }
                    }
      };
  devices.makers['/device/climate/koubachi/sensor'] = Sensor;

  colors = [];
  for (status in devices.rainbow) if (devices.rainbow.hasOwnProperty(status)) colors.push(devices.rainbow[status].color);

  steward.actors.device.climate.koubachi.plant =
      { $info     : { type       : '/device/climate/koubachi/plant'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name            : true
                                   , status          : colors
                                   , placement       : true
                                   , lastSample      : 'timestamp'
                                   , needsWater      : [ 'true', 'false' ]
                                   , needsMist       : [ 'true', 'false' ]
                                   , needsFertilizer : [ 'true', 'false' ]
                                   , adviseChange    : true
                                   , adviseLight     : true
                                   }
                    }
      };
  devices.makers['/device/climate/koubachi/plant'] = Plant;
};
