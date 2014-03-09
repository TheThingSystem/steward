// Yocto-Meteo: http://www.yoctopuce.com/EN/products/usb-sensors/yocto-meteo

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
  for (param in info.params) if (info.params.hasOwnProperty(param)) self.info[param] = info.params[param];
  sensor.update(self.deviceID, info.params);

  self.status = 'waiting';
  self.meteo = { module      : info.module
               , temperature : yapi.yFindTemperature(info.device.unit.serial + '.temperature')
               , humidity    : yapi.yFindHumidity(info.device.unit.serial + '.humidity')
               , pressure    : yapi.yFindPressure(info.device.unit.serial + '.pressure')
               };

  if (self.meteo.module.isOnline()) {
     self.status = 'present';

    self.meteo.module.get_logicalName_async(function(ctx, led, result) {
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

  setInterval(function() { self.scan(self); }, 15 * 1000);
  self.scan(self);
};
util.inherits(Sensor, climate.Device);

Sensor.prototype.scan = function(self) {
  var status = self.meteo.module.isOnline() ? 'present' : 'absent';

  if (self.status !== status) {
    self.status = status;
    self.changed();
  }
  if (self.status !== 'present') return;

  self.meteo.temperature.get_currentValue_async(function(ctx, led, result) {
    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'temperature currentValue invalid' });
    }

    self.update(self, { temperature: result, lastSample: new Date().getTime() });
  });

  self.meteo.humidity.get_currentValue_async(function(ctx, led, result) {
    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'humidity currentValue invalid' });
    }

    self.update(self, { humidity: result, lastSample: new Date().getTime() });
  });

  self.meteo.pressure.get_currentValue_async(function(ctx, led, result) {
    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'pressure currentValue invalid' });
    }

    self.update(self, { pressure: result, lastSample: new Date().getTime() });
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
    if ((!params.hasOwnProperty(param)) || (self.info[param] === params[param])) continue;

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

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  result = self.meteo.module.set_logicalName(params.name);
  if (result === yapi.YAPI_SUCCESS) return self.setName(params.name, taskID);

  logger.error('device/' + self.deviceID, { event: 'set_logicalName', result: result });
  return false;
};


exports.start = function() {
  steward.actors.device.climate.yoctopuce = steward.actors.device.climate.yoctopuce ||
      { $info     : { type: '/device/climate/yoctopuce' } };

  steward.actors.device.climate.yoctopuce.meteo =
      { $info     : { type       : '/device/climate/yoctopuce/meteo'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'present', 'absent' ]
                                   , lastSample  : 'timestamp'
                                   , temperature : 'celsius'
                                   , humidity    : 'percentage'
                                   , pressure    : 'millibars'
                                   }
                    }
      , $validate : {  perform   : hub.validate_perform }
      };
  devices.makers['/device/climate/yoctopuce/meteo'] = Sensor;

  hub.register('Yocto-Meteo', '/device/climate/yoctopuce/meteo');
};
