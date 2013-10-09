// Yocto-CO2: http://www.yoctopuce.com/EN/products/usb-sensors/yocto-co2

var util        = require('util')
  , yapi        = require('yoctolib')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , hub         = require('./../devices-gateway/gateway-yoctopuce-hub')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


var logger = climate.logger;


var Sensor = exports.Device = function(deviceID, deviceUID, info) {
  var param;

  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = {};
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  sensor.update(self.deviceID, info.params);

  self.status = 'waiting';
  self.co2 = yapi.yFindCarbonDioxide(info.device.unit.serial + '.carbonDioxide');
  self.info = {};

  if (self.co2.isOnline()) {
     self.status = 'present';

    self.co2.get_logicalName_async(function(ctx, led, result) {
      if (result === yapi.Y_LOGICALNAME_INVALID) {
        return logger.error('device/' + self.deviceID, { event: 'get_logicalName', diagnostic: 'logicalName invalid' });
      }

      if ((!result) || (result.length === 0) || (result === self.name)) return;

      logger.info('device/' + self.deviceID, { event: 'get_logicalName', result: result });
      self.setName(result);
    });
  } else self.status = 'absent';
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  setInterval(function() { self.scan(self); }, 45 * 1000);
  self.scan(self);
};
util.inherits(Sensor, climate.Device);

Sensor.prototype.scan = function(self) {
  var status = self.co2.isOnline() ? 'present' : 'absent';

  if (self.status !== status) {
    self.status = status;
    self.changed();
  }
  if (self.status !== 'present') return;

  self.co2.get_currentValue_async(function(ctx, led, result) {
    var params;

    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'get_currentValue', diagnostic: 'currentValue invalid' });
    }

    params = { lastSample : new Date().getTime()
             , co2        : result
             };
    self.update(self, params);
  });
};

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

Sensor.prototype.perform = function(self, taskID, perform, parameter) {
  var params, result;

  if (perform !== 'set') return false;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  result = self.co2.set_logicalName(params.name);
  if (result === yapi.YAPI_SUCCESS) return self.setName(params.name);

  logger.error('device/' + self.deviceID, { event: 'set_logicalName', result: result });
  return false;
};


exports.start = function() {
  steward.actors.device.climate.yoctopuce = steward.actors.device.climate.yoctopuce ||
      { $info     : { type: '/device/climate/yoctopuce' } };

  steward.actors.device.climate.yoctopuce.co2 =
      { $info     : { type       : '/device/climate/yoctopuce/co2'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'present', 'absent' ]
                                   , lastSample : 'timestamp'
                                   , co2        : 'ppm'
                                   }
                    }
      , $validate : {  perform   : hub.validate_perform }
      };
  devices.makers['/device/climate/yoctopuce/co2'] = Sensor;

  hub.register('Yocto-CO2', '/device/climate/yoctopuce/co2');
};
