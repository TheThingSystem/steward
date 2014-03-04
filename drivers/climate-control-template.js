// climate control template -- start with this when an HVAC unit can be managed independently
// search for TBD to see what to change

// load the module that knows how to discover/communicate with a bulb
var TBD         = require('TBD')
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

Thermostat.operations =
{ set: function(self, params) {
         devices.attempt_perform('name', params, function(value) {
           self.setName(value);
         });

// if the HVAC unit does NOT has home/away, then delete this call to attempt_perform()
         devices.attempt_perform('away', params, function(value) {
           if (value === 'on') {
// TBD: turn on away mode here...
           } else {
// TBD: turn on home mode here...
           }
         });

         devices.attempt_perform('hvac', params, function(value) {
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

         devices.attempt_perform('fan', params, function(value) {
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

         devices.attempt_perform('goalTemperature', params, function(value) {
           var goalTemperature;

         goalTemperature = parseInt(value, 10);
         if (isNaN(goalTemperature)) return;
// TBD: set the desired temperature here...
         });
       }
};

Thermostat.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(e) { params = {}; }

  if (!Thermostat.operations[perform]) return devices.perform(self, taskID, perform, parameter);

  Thermostat.operations[perform](this, params);
  setTimeout(function () { self.gateway.scan(self); }, 1 * 1000);
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!Thermostat.operations[perform]) return devices.validate_perform(perform, parameter);

  if (!params) return result;

  devices.validate_param('name',            params, result, false, {                                   });
// if the HVAC unit does NOT has home/away, then delete this call to checkParam()
  devices.validate_param('away',            params, result, false, { off:  1, on:  1                   });
  devices.validate_param('hvac',            params, result, false, { off:  1, fan: 1, heat: 1, cool: 1 });
  devices.validate_param('fan',             params, result, true,  { off:  1, on:  1, auto: 1          });
  devices.validate_param('goalTemperature', params, result, true,  {                                   });

  return result;
};


exports.start = function() {
  var logger2 = utility.logger('discovery');

  steward.actors.device.climate.nest = steward.actors.device.climate.nest ||
      { $info     : { type: '/device/climate/nest' } };

  steward.actors.device.climate.hvac.control =
      { $info     : { type       : '/device/climate/nest/control'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name            : true
                                   , status          : [ 'present', 'absent' ]
                                   , lastSample      : 'timestamp'
                                   , temperature     : 'celsius'
                                   , humidity        : 'percentage'
// if the HVAC unit doesn't report energy efficiency, remove this proprerty
                                   , leaf            : [ 'on', 'off' ]
// if the HVAC unit doesn't support home/awaymode, remove this property
                                   , away            : [ 'on', 'off' ]
                                   , hvac            : [ 'cool', 'heat', 'fan', 'off' ]
                                   , fan             : [ 'on', 'auto', 'milliseconds' ]
                                   , goalTemperature : 'celsius'
                                   }
                    }
        , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/climate/TBD/control'] = Thermostat;

// TBD: when the hardware driver discovers a new HVAC unit, it will call us.
// TBD: or if the low-level driver needs to be polled, then create a 'scan' function and call it periodically.
  new TBD().on('discover', function(hvac) {
    var info;

    info = { source     : 'TBD'
           , hvac       : hvac
           , device     : { url          : null
                          , name         : hvac.name
                          , manufacturer : hvac.manufacturer
                          , model        : { name        : hvac.name
                                           , description : hvac.description
                                           , number      : hvac.number
                                           }
                          , unit         : { serial      : hvac.serialNo
                                           , udn         : 'TBD:' + hvac.serialNo.toLowerCase()
                                           }
                          }
           , deviceType : '/device/lighting/TBD/led'
         };
// if multiple hvac types, update info.deviceType as appropriate
    info.url = info.device.url;
    info.deviceType = '/device/climate/TBD/control';
    info.id = info.device.unit.udn;
    if (!!devices.devices[info.id]) return;

    logger2.info(info.device.name, info.device);
    devices.discover(info);
  }).on('error', function(err) {
    logger2.error('TBD', { diagnostic: err.message });
  }).logger = logger2;
};
