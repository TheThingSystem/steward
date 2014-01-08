// ecobee - more than just a thermostat: http://www.ecobee.com

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

  self.serial = info.device.unit.serial;
  self.revision = info.revision;

  self.info = {};
  if (!!info.params.status) {
    self.status = info.params.status;
    delete(info.params.status);
  } else self.status = 'present';
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  sensor.update(self.deviceID, info.params);

  self.changed();
  self.gateway = info.gateway;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
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

Sensor.operations = {
  set: function(sensor, params) {

    var ecobee = sensor.gateway.ecobee;
    var performed = false;

    var attempt_perform = function(key, fn) {
      if (typeof params[key] !== 'undefined') {
        fn(params[key]);
        performed = true;
      }
    };


    attempt_perform('away', function(value) {
      ecobee.setAway(ecobee, sensor, value);
    });

    attempt_perform('hvac', function(mode) {
      switch (mode) {
        case 'off':
        case 'cool':
        case 'heat':
          attempt_perform('goalTemperature', function(value) {
            var goalTemperature  = parseInt(value, 10);

            if (!isNaN(goalTemperature)) ecobee.setHold(ecobee, sensor, mode, goalTemperature);
          });
          break;

        case 'fan':
          if (!params.fan) params.fan = 'on';
          attempt_perform('fan', function(value) {
            ecobee.setHold(ecobee, sensor, mode, value);
          });
          break;
      }
    });

    return performed;
  }
};

Sensor.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!!Sensor.operations[perform]) {
    if (Sensor.operations[perform](this, params)) {
      setTimeout(function () { self.gateway.scan(self); }, 1 * 1000);
      return steward.performed(taskID);
    }
  }

  return devices.perform(self, taskID, perform, parameter);
};

var checkParam = function(key, params, result, allowNumeric, map) {
  if (typeof params[key] !== 'undefined') {

    var defined = typeof map[params[key]] !== 'undefined';

    if (((!defined) && (!allowNumeric)) || ((!defined) && allowNumeric && isNaN(parseInt(params[key], 10)))) {
      result.invalid.push(key);
    }
  }
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!!Sensor.operations[perform]) {
    if (perform === 'set') {
      if (!params) {
        result.requires.push('parameter');
        return result;
      }

      checkParam('away', params, result, false, { on: 1, off: 1 });
      checkParam('hvac', params, result, false, { heat: 1, cool: 1, fan: 1, off: 1 });
      checkParam('fan', params, result, true, { on: 1, auto: 1 });
      checkParam('goalTemperature', params, result, true, {});
    }
    return result;
  }

  return devices.validate_perform(perform, parameter);
};

exports.start = function() {
  steward.actors.device.climate.ecobee = steward.actors.device.climate.ecobee ||
      { $info     : { type: '/device/climate/ecobee' } };

  steward.actors.device.climate.ecobee.control =
      { $info     : { type       : '/device/climate/ecobee/control'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name            : true
                                   , status          : [ 'present', 'absent' ]
                                   , lastSample      : 'timestamp'
                                   , temperature     : 'celsius'
                                   , humidity        : 'percentage'
                                   , away            : [ 'on', 'off' ]
                                   , hvac            : [ 'cool', 'heat', 'fan', 'off' ]
                                   , fan             : [ 'on', 'auto', 'milliseconds' ]
                                   , goalTemperature : 'celsius'
                                   }
                    }
        , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/climate/ecobee/control'] = Sensor;
};
