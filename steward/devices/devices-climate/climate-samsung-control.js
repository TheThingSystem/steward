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
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.hvac = info.hvac;
// TBD: invoked by the lower-level hvac driver whenever the hvac unit changes state. You probably
// have to set the name of the event to whatever the hvac driver emits when its state changes.
  self.hvac.on('stateChange', function(state) { self.update(self, state); });
  self.update(self, self.hvac.state);
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Thermostat, climate.Device);


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

/*
    attempt_perform('hvac', function(value) {
      switch (value) {
        case 'off':
        case 'cool':
        case 'heat':
// TBD: turn the unit on/off
          break;

        case 'fan':
// TBD: turn the fan on only
          break;
      }
    });

    attempt_perform('fan', function(value) {
      var time;

      switch (value) {
        case 'off':
        case 'on':
        case 'auto':
// TBD: set the fan's mode
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
      if (isNaN(goalTemperature)) break;
// TBD: set the desired temperature here...
    });
*/
    return performed;
  }
};

Thermostat.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(e) { params = {}; }

  if (!!Thermostat.operations[perform]) {
    if (Thermostat.operations[perform](this, params)) {
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

  if (!!Thermostat.operations[perform]) {
    if (perform === 'set') {
      if (!params) {
        result.requires.push('parameter');
        return result;
      }

// if the HVAC unit does NOT has home/away, then delete this call to checkParam()
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
                                   , status          : [ 'present', 'absent' ]
                                   , lastSample      : 'timestamp'
                                   , temperature     : 'celsius'
                                   , humidity        : 'percentage'
                                   , hvac            : [ 'cool', 'heat', 'fan', 'off' ]
                                   , fan             : [ 'on', 'auto', 'milliseconds' ]
                                   , goalTemperature : 'celsius'
                                   }
                    }
        , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/climate/samsung/control'] = Thermostat;

// TBD: when the hardware driver discovers a new HVAC unit, it will call us.
// TBD: or if the low-level driver needs to be polled, then create a 'scan' function and call it periodically.
/*
 function(aircon) {

  if (connecting_to[aircon.options.ip]) { 
    return; 
  }

  // Do we need to find get a token?
  if (!known_tokens[aircon.options.ip]) {
    connecting_to[aircon.options.ip] = true;

    aircon.get_token(function(err, token) {
      if (!!err) return console.log('get_token error: ' + err.message);

      console.log('Token is ' + token);
      known_tokens[aircon.options.ip] = token;
      connecting_to[aircon.options.ip] = false;

    }).on('waiting', function() {
      console.log('Please power on the device within the next 30 seconds');
    });

    return;
  }

  connecting_to[aircon.options.ip] = true;
  aircon.login(known_tokens[aircon.options.ip], function() {
    aircon.onoff(true);

    setTimeout(function() { aircon.onoff(false); }, 10 * 1000);
  });


})

*/
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
    if (!!devices.devices[info.id]) return;

    logger2.info(info.device.name, info.device);
    devices.discover(info);
  }).on('error', function(err) {
    logger2.error('samsung', { diagnostic: err.message });
  }).logger = logger2;
};
