// climate control template -- start with this when an HVAC unit can be managed independently
// search for TBD to see what to change

// load the module that knows how to discover/communicate with a bulb
var samsung     = require('samsung-airconditioner')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


// var logger = climate.logger;


// define the prototype that will be instantiated when the HVAC unit is discovered
// later, we will create a ...perform function, and a ...update function.
var Thermostat = exports.Device = function(deviceID, deviceUID, info) {
  var logger2 = utility.logger('discovery');  
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.hvac = info.hvac;
  self.info = {};

  self.hvac.on('stateChange', function(state) { 
    translated_state = {}
    for (key in state) {
      switch (key) {
        case "AC_FUN_POWER":
          if (state[key] == 'On') {
            translated_state['hvac'] = 'on';
            translated_state['fan'] = 'on';
          }
          if (state[key] == 'Off') {
            translated_state['hvac'] = 'off';
            translated_state['fan'] = 'off';
          }
          break;
        case "AC_FUN_OPMODE":
          if (state[key] == 'Cool') {
            translated_state['hvac'] = 'cool';
          }
          if (state[key] == 'Heat') {
            translated_state['hvac'] = 'heat';
          }
          if (state[key] == 'Dry') {
            translated_state['hvac'] = 'dry';
          }
          if (state[key] == 'Wind') {
            translated_state['hvac'] = 'fan';
          }
          if (state[key] == "Auto") {
            translated_state['hvac'] = 'on';
          }            
          break;
        case "AC_FUN_TEMPSET":
          state['goalTemperature'] = state[key];
          break;    
        case "AC_FUN_WINDLEVEL":
          if (state[key] == "High") {
            translated_state['fan'] = 'high';
          }
          if (state[key] == "Mid") {
            translated_state['fan'] = 'mid';
          }
          if (state[key] == "Low") {
            translated_state['fan'] = 'low';
          }
          if (state[key] == "Auto") {
            translated_state['fan'] = 'auto';
          }          
          break;
        case "AC_ADD_SPI":
          break;
        case "AC_FUN_TEMPNOW":
          translated_state['temperature'] = state[key];
          break;
        case "AC_ADD_AUTOCLEAN":
          break;
        case "AC_FUN_COMODE":
          // Convience mode
          // Smart, Quiet, Off, etc
          break;
        case "AC_FUN_DIRECTION":
          // SwingUD, Fixed or Rotation
          break;
      }
    }

//    logger2.info('device/' + self.deviceID, state);
    logger2.info('device/' + self.deviceID, translated_state);
  });

  self.update(self, translated_state, self.status);
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.setup();
};
util.inherits(Thermostat, climate.Device);

Thermostat.prototype.setup = function () {
  var self = this;
  var logger2 = utility.logger('discovery');

  // var db = require('./../../core/database').db
  // db.on('trace', function(e) {
  //   console.log(e);
  // });


  var state = self.getState(function (err, state) {
    if (!state) {
      state = {};
    }

    if (!state.token) {
      self.hvac.get_token(function(err, token) {
        if (!!err) {
          self.update(self, {}, 'reset');

          return logger2.info('device/' + self.deviceID, 'Get Token error: ' + err.message);
        }

        logger2.info('device/' + self.deviceID, "Token found:" + token);

        state.token = token;

        self.setState(state);

        self.hvac.login(token, function () {
          self.update(self, {}, 'present');
          logger2.info('device/' + self.deviceID, "Logged on");
        });
      }).on('waiting', function() {
        self.alert('Please power on the device within the next 30 seconds');
        logger2.info('device/' + self.deviceID, 'Please power on the device within the next 30 seconds');
      });
    } else {
      self.hvac.login(state.token, function () {
        self.update(self, {}, 'present');
        logger2.info('device/' + self.deviceID, "Logged on");
      });
    }
  });

};

Thermostat.prototype.update = function(self, params, status) {
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

Thermostat.operations = {
  set: function(self, params) {

    var performed = false;

    var attempt_perform = function(key, fn) {
      if (typeof params[key] !== 'undefined') {
        fn(params[key]);
        performed = true;
      }
    };

    attempt_perform('hvac', function(value) {
      switch (value) {
        case 'off':
          self.hvac.onoff(false);
          break;
        case 'on':
          self.hvac.onoff(true);   
          break;
        case 'cool':
          self.hvac.onoff(true);   
          self.hvac.mode('Cool');
          break;
        case 'heat':
          self.hvac.onoff(true);   
          self.hvac.mode('Heat');
          break;        
        case 'fan':
          self.hvac.onoff(true);   
          self.hvac.mode('Wind');
          break;
      }
    });

    attempt_perform('fan', function(value) {
      var time;

      switch (value) {
        // Available options for convenient mode
        // var modes = ['Off', 'Quiet', 'Sleep', 'Smart', 'SoftCool', 'TurboMode', 'WindMode1', 'WindMode2', 'WindMode3']
        case 'off':
          self.hvac.set_convenient_mode('Off');
          break;
        case 'on':
          self.hvac.set_convenient_mode('Quiet');        
          break;
        case 'auto':
          self.hvac.set_convenient_mode('WindMode1');
          break;

        default:
          time = parseInt(value, 10);
          if (isNaN(time)) break;
          // TBD: set the fan duration. adjust time from milliseconds to whatever
          break;
      }
    });

    attempt_perform('goalTemperature', function(value) {
      var goalTemperature;

      goalTemperature = parseInt(value, 10);
      if (isNaN(goalTemperature)) {
        return;
      }

      if (goalTemperature > 30 || goalTemperature < 16) {
        return;
      }

      self.hvac.set_temperature(goalTemperature);
    });

    return performed;
  }
};

Thermostat.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(e) { params = {}; }

  if (!!Thermostat.operations[perform]) {
    if (Thermostat.operations[perform](this, params)) {
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

    if (key == 'goalTemperature') {
      var temperature = parseInt(params[key], 10);

      if (temperature > 30 || temperature < 16) {
        result.invalid.push(key);
      }
    }
  }
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!!Thermostat.operations[perform]) {
    if (perform === 'set') {
      if (!params) {
        result.requires.push('parameter');
        return result;
      }

      checkParam('hvac', params, result, false, { heat: 1, cool: 1, fan: 1, off: 1 });
      checkParam('fan', params, result, true, { off: 1, on: 1, auto: 1 });
      checkParam('goalTemperature', params, result, true, {});
    }
    return result;
  }

  return devices.validate_perform(perform, parameter);
};


exports.start = function() {
  var logger2 = utility.logger('discovery');

  steward.actors.device.climate.samsung = steward.actors.device.climate.samsung ||
      { $info     : { type: '/device/climate/samsung' } };

  steward.actors.device.climate.samsung.control =
      { $info     : { type       : '/device/climate/samsung/control'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name            : true
                                   , status          : [ 'present', 'reset' ]
                                   , lastSample      : 'timestamp'
                                   , temperature     : 'celsius'
                                   , humidity        : 'percentage'
                                   , hvac            : [ 'cool', 'heat', 'fan', 'dry', 'off', 'on', ]
                                   , fan             : [ 'on', 'off', 'high', 'mid', 'low', 'auto', 'milliseconds' ]
                                   , goalTemperature : 'celsius'
                                   }
                    }
        , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/climate/samsung/control'] = Thermostat;
// TBD: when the hardware driver discovers a new HVAC unit, it will call us.
// TBD: or if the low-level driver needs to be polled, then create a 'scan' function and call it periodically.

  new samsung().on('discover', function(aircon) {
    // TODO This is done to avoid detecting ourselves listening for the SSDP response.
    // There should be a better way :(
    if (!aircon.options.duid) {
      return;
    }
    var info;
    info = { source     : 'samsung'
           , hvac       : aircon
           , device     : { url          : null
                          , name         : aircon.options.info["NICKNAME"]
                          , manufacturer : aircon.manufacturer || 'Samsung'
                          , model        : { name        : aircon.options.info["MODELCODE"]
                                           , description : ''
                                           }
                          , unit         : { serial      : aircon.props.duid
                                           , udn         : 'Samsung:' + aircon.props.duid
                                           }
                          }

         };

    info.url = info.device.url;
    info.deviceType = '/device/climate/samsung/control';
    info.id = info.device.unit.udn;

    devices.discover(info, function (err, deviceID) {
      if (!!err) { logger2.error('samsung', { diagnostic: err.message });};
    });

  }).on('error', function(err) {
    logger2.error('samsung', { diagnostic: err.message });
  }).logger = logger2;
};
