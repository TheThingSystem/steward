// https://www.quirky.com/shop/752

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
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

  self.info = {};
  self.gateway = info.gateway;
  self.update(self, info.params);

  self.status = 'quiet';
  self.changed();

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if ((request === 'perform') && (observe === 'set')) return self.perform(self, eventID, observe, parameter);
  });

  setInterval(function() { self.scan(self); }, 60 * 1000);
};
util.inherits(Thermostat, sensor.Device);


Thermostat.prototype.scan = function(self) {
  if (!self.gateway.wink) return;

  self.gateway.wink.getDevice(self.params, function(err, params) {
    if (!!err) {
      if (!self.errorP) logger.error('device/' + self.deviceID, { event: 'getDevice', diagnostic: err.message });
      self.errorP = true;
      return;
    }
    delete(self.errorP);

    if (!!params) self.update(self, params);
  });
};

Thermostat.prototype.update = function(self, params) {
  var d, data, props, updateP;

  self.params = params;
  updateP = false;

  data = self.params.props.last_reading;
  props = { lastSample      : 0
          , temperature     : (typeof data.temperature   === 'number') ? data.temperature           : undefined
          , away            : (data.mode === 'auto_eco')               ? 'true'                     : false
          , hvac            : { cool_only: 'cool', fan_only: 'fan' }[data.mode] || 'off'
          , fan             : (typeof data.fan_speed     === 'number')
                                                                       ? (  (data.fan_speed === 0.00) ? 'off'
                                                                          : (data.fan_speed === 0.33) ? 'low'
                                                                          : (data.fan_speed === 0.67) ? 'mid'
                                                                          : (data.fan_speed === 1.00) ? 'high'
                                                                          : Math.round(data.fan_speed * 100))
                                                                                                    : undefined
          , goalTemperature : (typeof data.max_set_point === 'number') ? data.data.max_set_point    : undefined
          };
  if ((props.away === 'true') && (data.powered)) props.hvac = data.powered;

  if (self.params.name !== self.name) {
    self.name = self.params.name;
    updateP = true;
  }

  for (d in data) {
    if ((!data.hasOwnProperty(d)) || (d.indexOf('_updated_at') !== (d.length - 11)) || (typeof data[d] !== 'number')) continue;
    if (data[d] > props.lastSample) props.lastSample = data[d];
  }
  if (props.lastSample === 0) return;
  props.lastSample *= 1000;

  if (self.updateInfo(props)) updateP = true;

  if (updateP) {
    self.changed();
    sensor.update(self.deviceID, props);
  }
};

Thermostat.operations =
{ set: function(self, params) {

         devices.attempt_perform('name', params, function(value) {
           self.setName(value);
         });

         if (!!params.away) params.hvac = { true: 'auto_eco', false: 'cool' }[params.away] || params.hvac;

         devices.attempt_perform('hvac', params, function(value) {
           var mode = { off: 'off', auto_eco: 'auto_eco', cool: 'cool_only', fan: 'fan_only' }[value];

           if (!mode) return;        

// ...set mode to mode
         });

         devices.attempt_perform('fan', params, function(value) {
           var fanSpeed = { off: 0.00, low: 0.33, mid: 0.67, high: 1.00 }[value] || parseInt(value, 10);

           if (isNaN(fanSpeed)) return;
           if ((fanSpeed < 0) || (fanSpeed > 100)) fanSpeed = 100;

// ...set fan_speed to fanSpeed
         });

         devices.attempt_perform('goalTemperature', params, function(value) {
           var goalTemperature;

           goalTemperature = parseInt(value, 10);
// ...set max_set_point to goalTemperature
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

  devices.validate_param('name',            params, result, false, {                                  });
  devices.validate_param('away',            params, result, false, { off:  1, on:  1                  });
  devices.validate_param('hvac',            params, result, false, { off:  1, fan: 1,         cool: 1 });
  devices.validate_param('fan',             params, result, true,  { off:  1, low: 1, mid: 1, high: 1 });
  devices.validate_param('goalTemperature', params, result, true,  {                                  });

  return result;
};


exports.start = function() {
  steward.actors.device.climate.wink = steward.actors.device.climate.wink ||
      { $info     : { type: '/device/climate/wink' } };

  steward.actors.device.climate.wink.control =
      { $info     : { type       : '/device/climate/wink/control'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status          : [ 'present', 'absent' ]
                                   , lastSample      : 'timestamp'
                                   , temperature     : 'celsius'
                                   , away            : [ 'on', 'off' ]
                                   , hvac            : [ 'cool', 'fan', 'off' ]
                                   , fan             : [ 'high', 'mid', 'low', 'off' ]
                                   , goalTemperature : 'celsius'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/climate/wink/control'] = Thermostat;
};
