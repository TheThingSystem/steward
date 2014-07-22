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
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();
  if (!self.ikon) self.setIkon('control-thermostat');

  self.serial = info.device.unit.serial;
  self.revision = info.revision;

  self.status = self.initInfo(info.params);
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

Sensor.operations =
{ set: function(self, params) {
         var ecobee = self.gateway.ecobee;

         devices.attempt_perform('name', params, function(value) {
           self.setName(value);
         });
         devices.attempt_perform('ikon', params, function(value) {
           self.setIkon(value);
         });

         devices.attempt_perform('away', params, function(value) {
           ecobee.setAway(ecobee, self, value);
         });

         switch (params.hvac) {
           case 'off':
           case 'cool':
           case 'heat':
             devices.attempt_perform('goalTemperature', function(params, value) {
               var goalTemperature  = parseInt(value, 10);

               if (!isNaN(goalTemperature)) ecobee.setHold(ecobee, self, params.hvac, goalTemperature);
             });
             break;

           case 'fan':
             if (!params.fan) params.fan = 'on';
             devices.attempt_perform('fan', params, function(value) {
               ecobee.setHold(ecobee, self, params.hvac, value);
             });
             break;
         }
       }
};

Sensor.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!Sensor.operations[perform]) return devices.perform(self, taskID, perform, parameter);

  Sensor.operations[perform](this, params);
  setTimeout(function () { self.gateway.scan(self); }, 1 * 1000);
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!Sensor.operations[perform]) return devices.validate_perform(perform, parameter);

  if (!params) return result;

  devices.validate_param('name',            params, result, false, {                                   });
  devices.validate_param('ikon',            params, result, false, {                                   });
  devices.validate_param('away',            params, result, false, { off:  1, on:  1                   });
  devices.validate_param('hvac',            params, result, false, { off:  1, fan: 1, heat: 1, cool: 1 });
  devices.validate_param('fan',             params, result, true,  { off:  1, on:  1, auto: 1          });
  devices.validate_param('goalTemperature', params, result, true,  {                                   });

  return result;
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
