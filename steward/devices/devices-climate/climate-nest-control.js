// Nest - the learning thermostat: http://nest.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


var logger = climate.logger;


var Thermostat = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.serial = info.device.unit.serial;

  self.status = self.initInfo(info.params);
  sensor.update(self.deviceID, info.params);
  self.changed();

  self.gateway = info.gateway;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Thermostat, climate.Device);


Thermostat.prototype.update = function(self, params, status) {
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

Thermostat.operations =
{ set: function(self, params) {
         var serial = self.serial;
         var nest = self.gateway.nest;

         devices.attempt_perform('name', params, function(value) {
           self.setName(value);
         });

         devices.attempt_perform('away', params, function(value) {
           var structureId = nest.getStructureId();

// NB: sometimes we don't get back structures from the cloud... (not sure why)
           if (!structureId) return logger.error('device/' + self.deviceID, { event: 'away', diagnostic: 'no structureID' });
           nest.setAway(value === 'on', structureId);
         });

         devices.attempt_perform('hvac', params, function(value) {
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

         devices.attempt_perform('fan', params, function(value) {
           var time;

           switch (value) {
             case 'off':
             case 'on':
             case 'auto':
               nest.setFanMode(serial, value);
               break;

             default:
               time = parseInt(value, 10);
               if (isNaN(time)) break;
               nest.setFanMode(serial, 'on', time);
               break;
           }
         });

         devices.attempt_perform('goalTemperature', params, function(value) {
           var goalTemperature;

           goalTemperature = parseInt(value, 10);
           if (!isNaN(goalTemperature)) nest.setTemperature(serial, goalTemperature);
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
  devices.validate_param('away',            params, result, false, { off:  1, on:  1                   });
  devices.validate_param('hvac',            params, result, false, { off:  1, fan: 1, heat: 1, cool: 1 });
  devices.validate_param('fan',             params, result, true,  { off:  1, on:  1, auto: 1          });
  devices.validate_param('goalTemperature', params, result, true,  {                                   });

  return result;
};


exports.start = function() {
  steward.actors.device.climate.nest = steward.actors.device.climate.nest ||
      { $info     : { type: '/device/climate/nest' } };

  steward.actors.device.climate.nest.control =
      { $info     : { type       : '/device/climate/nest/control'
                    , observe    : [ ]
                    , perform    : [ 'wake' ]
                    , properties : { name            : true
                                   , status          : [ 'present', 'absent' ]
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
  devices.makers['/device/climate/nest/control'] = Thermostat;
};
