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
  self.serial = info.device.unit.serial;

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

Sensor.operations = {
  set: function(sensor, params) {

    var serial = sensor.serial;
    var nest = sensor.gateway.nest;
    var performed = false;

    var attempt_perform = function(key, fn) {
      if (typeof params[key] !== 'undefined') {
        fn(params[key]);
        performed = true;
      }
    };


    attempt_perform('away', function(value) {
      if (value === 'on') {
        nest.setAway();
      } else {
        nest.setHome();
      }
    });


    attempt_perform('hvac', function(value) {
      switch (value) {
        case 'off':
        case 'cool':
        case 'heat':
          nest.setTargetTemperatureType(serial, value);
        break;

        case 'fan':
          nest.setFanModeOn(serial);
        break;
      }
    });

    attempt_perform('fan', function(value) {
      switch (value) {

        case 'on':
        case 'auto':
          nest.setFanMode(serial, value);
        break;

        default:
          var time = parseInt(value, 10);
          if (!isNaN(time)) {
            nest.setFanMode(serial, 'timer', time);
          }
        break;
      }
    });

    attempt_perform('goalTemperature', function(value) {
      nest.setTemperature(serial, value);
    });

    return performed;
  }
};

Sensor.prototype.perform = function(self, taskID, perform, parameter) {
  var params;
  try { params = JSON.parse(parameter); } catch(e) {}

  if (!!Sensor.operations[perform]) {
    if (Sensor.operations[perform](this, params)) {
      return steward.performed(taskID);
    }
  }

  return devices.perform(self, taskID, perform, parameter);
};

var checkParam = function(key, params, result, allowNumeric, map) {
  if (typeof params[key] !== 'undefined') {

    var defined = typeof map[params[key]] !== 'undefined';

    if ((!defined && !allowNumeric) || (!defined && allowNumeric && isNaN(parseInt(params[key], 10)))) {
      result.invalid.push(key);
    }
  }
};

var validate_perform = function(perform, parameter) {
  var result = { invalid: [], requires: [] }, params;

  try { params = JSON.parse(parameter); } catch(e) {}

  if (!!Sensor.operations[perform]) {
    if (perform === 'set') {
      if (!params) {
        result.requires.push('parameter');
        return result;
      }

      checkParam('away', params, result, false, { on: 1, off: 1 });
      checkParam('hvac', params, result, false, { heat: 1, cool: 1, off: 1, fan: 1 });
      checkParam('fan', params, result, true, { on: 1, auto: 1 });
      checkParam('goalTemperature', params, result, true, {});
    }
    return result;
  }

  return devices.validate_perform(perform, parameter);
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
                                   , humidity        : 'percentage'
                                   , leaf            : [ 'on', 'off' ]
                                   , away            : [ 'on', 'off' ]
                                   , hvac            : [ 'cool', 'heat', 'fan', 'off' ]
                                   , fan             : [ 'on', 'auto', 'milliseconds' ]
                                   , goalTemperature : 'celsius'
                                   }
                    }
        , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/climate/nest/control'] = Sensor;
};
