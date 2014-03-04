// climate control template -- start with this when an HVAC unit can be managed independently

exports.start = function() {};

// load the module that knows how to discover/communicate with a bulb
var samsung     = require('samsung-airconditioner')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


var logger = climate.logger;


// define the prototype that will be instantiated when the HVAC unit is discovered
// later, we will create a ...perform function, and a ...update function.
var Thermostat = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.hvac = info.hvac;
  self.info = {};

  self.hvac.on('stateChange', function(state) {
// { AC_FUN_ENABLE: 'Enable',
//   AC_FUN_COMODE: 'Off',
//   AC_FUN_SLEEP: '0',
//   AC_FUN_WINDLEVEL: 'High',
//   AC_FUN_DIRECTION: 'Fixed',
//   AC_ADD_AUTOCLEAN: 'Off',
//   AC_ADD_APMODE_END: '0',
//   AC_ADD_STARTWPS: 'Direct',
//   AC_ADD_SPI: 'Off',
//   AC_SG_WIFI: 'Connected',
//   AC_SG_INTERNET: 'Connected',
    var translated_state = {};
    for (var key in state) {
      switch (key) {
        case "AC_FUN_POWER":
          if (state[key] == 'On') {
            translated_state.power = 'on';
          }
          if (state[key] == 'Off') {
            translated_state.power = 'off';
          }
          break;
        case "AC_FUN_OPMODE":
          if (state[key] == 'Cool') {
            translated_state.hvac = 'cool';
          }
          if (state[key] == 'Heat') {
            translated_state.hvac = 'heat';
          }
          if (state[key] == 'Dry') {
            translated_state.hvac = 'dry';
          }
          if (state[key] == 'Wind') {
            translated_state.hvac = 'fan';
          }
          if (state[key] == "Auto") {
            translated_state.hvac = 'auto';
          }
          break;
        case "AC_FUN_TEMPSET":
          translated_state.goalTemperature = state[key];
          break;
        case 'AC_FUN_SLEEP':
          translated_state.fan = parseInt(state[key], 10) * 1000 * 60;
          break;
        // TODO: this isn't what the hvac fan interace wants
        // case "AC_FUN_WINDLEVEL":
        //   if (state[key] == "High") {
        //     translated_state['fan'] = 'high';
        //   }
        //   if (state[key] == "Mid") {
        //     translated_state['fan'] = 'mid';
        //   }
        //   if (state[key] == "Low") {
        //     translated_state['fan'] = 'low';
        //   }
        //   if (state[key] == "Auto") {
        //     translated_state['fan'] = 'auto';
        //   }
        //   break;
        case "AC_ADD_SPI":
          break;
        case "AC_FUN_TEMPNOW":
          translated_state.temperature = parseInt(state[key], 10);
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

    logger.info('device/' + self.deviceID, translated_state);

    self.update(self, translated_state, self.status);
    self.changed();
  });

  self.update(self, {
    'hvac': 'off',
    'power': 'off',
    'fan': 0,
    'temperature': 0
  }, 'present');
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

  self.getState(function (err, state) {
    if (!state) {
      state = {};
    }

    if (!state.token) {
      self.hvac.get_token(function(err, token) {
        if (!!err) {
          self.update(self, {}, 'reset');

          return logger.info('device/' + self.deviceID, 'Get Token error: ' + err.message);
        }

        logger.info('device/' + self.deviceID, "Token found:" + token);

        state.token = token;

        self.setState(state);

        self.hvac.login(token, function () {
        }).on('loginSuccess', function () {
          self.update(self, {}, 'present');
          self.hvac.status();
          logger.info('device/' + self.deviceID, "Logged on");
        });
      }).on('waiting', function() {
        self.alert('Please power on the device within the next 30 seconds');
        logger.info('device/' + self.deviceID, 'Please power on the device within the next 30 seconds');
      });
    } else {
      self.hvac.login(state.token, function () {
      }).on('loginSuccess', function () {
        self.update(self, {}, 'present');
        self.hvac.status();
        logger.info('device/' + self.deviceID, "Logged on");
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

Thermostat.operations =
{ set: function(self, params) {
         devices.attempt_perform('name', params, function(value) {
           self.setName(value);
         });

        devices.attempt_perform('power', params, function(value) {
          switch (value) {
            case 'off':
              self.hvac.onoff(false);
              break;
            case 'on':
              self.hvac.onoff(true);
              break;
          }
        });

        devices.attempt_perform('hvac', params, function(value) {
          switch (value) {
            case 'auto':
              self.hvac.mode('Auto');
              break;
            case 'cool':
              self.hvac.mode('Cool');
              break;
            case 'heat':
              self.hvac.mode('Heat');
              break;
            case 'dry':
              self.hvac.mode('Dry');
              break;
            case 'fan':
              self.hvac.mode('Wind');
              break;
          }
        });

        devices.attempt_perform('fan', params, function(value) {
          var time;

          switch (value) {
            // Available options for convenient mode
            // var modes = ['Off', 'Quiet', 'Sleep', 'Smart', 'SoftCool', 'TurboMode', 'WindMode1', 'WindMode2', 'WindMode3']
            // case 'off':
            //   // self.hvac.set_convenient_mode('Off');
            //   break;
            // case 'on':
            //   // self.hvac.set_convenient_mode('Quiet');
            //   break;
            // case 'auto':
            //   // self.hvac.set_convenient_mode('WindMode1');
            //   break;

            default:
              time = parseInt(value, 10);
              if (isNaN(time)) break;
              self.hvac.set_sleep_mode(time/1000/60);
              break;
          }
        });

        devices.attempt_perform('goalTemperature', params, function(value) {
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
      }
};

Thermostat.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(e) { params = {}; }

  if (!Thermostat.operations[perform]) return devices.perform(self, taskID, perform, parameter);

  Thermostat.operations[perform](this, params);
  setTimeout(function () {
    if (self.gateway) {
      self.gateway.scan(self); 
    }
  }, 1 * 1000);
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!Thermostat.operations[perform]) return devices.validate_perform(perform, parameter);

  if (!params) return result;

  devices.validate_param('power',           params, result, false, { off: 1, on:  1 });
  devices.validate_param('hvac',            params, result, false, { off: 1, fan: 1, heat: 1, cool: 1, auto: 1 });
  devices.validate_param('fan',             params, result, true,  { off: 1, on:  1, auto: 1 });
  devices.validate_param('goalTemperature', params, result, true,  { });

  return result;
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
                                   , power           : [ 'on', 'off' ]
                                   , hvac            : [ 'cool', 'heat', 'fan', 'dry', 'off', 'auto', ]
                                   , fan             : [ 'on', 'off', 'high', 'mid', 'low', 'auto', 'milliseconds' ]
                                   , goalTemperature : 'celsius'
                                   }
                    }
        , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/climate/samsung/control'] = Thermostat;

  new samsung({ logger: logger2 }).on('discover', function(aircon) {
    var info;

    // TODO This is done to avoid detecting ourselves listening for the SSDP response.
    // There should be a better way :(
    if (!aircon.options.duid) {
      return;
    }

    info = { source     : 'samsung'
           , hvac       : aircon
           , device     : { url          : 'tcp://' + aircon.ip + ':2878'
                          , name         : aircon.options.info.NICKNAME
                          , manufacturer : aircon.manufacturer || 'Samsung'
                          , model        : { name        : aircon.options.info.MODELCODE
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
    if (!!devices.devices[info.id]) return;

    logger2.info(info.device.name, info.device);
    devices.discover(info);
  }).on('error', function(err) {
    logger2.error('samsung', { diagnostic: err.message });
  });
};
