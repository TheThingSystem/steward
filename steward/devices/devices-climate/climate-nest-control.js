// +++ under development
// Nest - the learning thermostat: http://nest.com

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

  self.info = {};
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  sensor.update(self.deviceID, info.params);

  self.status = 'present';
  self.changed();
  self.gateway = info.gateway;

  utility.broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {/* jshint unused: false */
// name is read-only...
  });
};
util.inherits(Sensor, climate.Device);


Sensor.prototype.update = function(self, params) {
  var param, updateP;

  updateP = false;
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
  steward.actors.device.climate.nest = steward.actors.device.climate.nest ||
      { $info     : { type: '/device/climate/nest' } };

  steward.actors.device.climate.nest.control =
      { $info     : { type       : '/device/climate/nest/control'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name            : true
                                   , status          : [ 'present' ]
                                   , lastSample      : 'timestamp'
                                   , temperature     : 'celsius'
                                   , goaltemperature : 'celsius'
                                   , humidity        : 'percentage'
                                   , hvac            : [ 'cool', 'heat', 'fan', 'off' ]
                                   , away            : [ 'on', 'off' ]
                                   , leaf            : [ 'on', 'off' ]
                                   }
                    }
      };
  devices.makers['/device/climate/nest/control'] = Sensor;
};
