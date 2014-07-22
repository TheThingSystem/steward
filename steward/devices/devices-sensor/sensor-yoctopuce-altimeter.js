// Yocto-Altimeter: http://www.yoctopuce.com/EN/products/usb-sensors/yocto-altimeter

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
  if (!self.ikon) self.setIkon('sensor-generic');

  self.info = { altitude: null, pressure: null, temperature: null, lastSample: new Date().getTime() };
  for (param in info.params) if (info.params.hasOwnProperty(param)) self.info[param] = info.params[param];
  sensor.update(self.deviceID, info.params);

  self.status = 'waiting';
  self.altimeter = { module      : info.module
                   , altitude    : yapi.yFindAltitude(info.device.unit.serial + '.altitude')
                   , temperature : yapi.yFindTemperature(info.device.unit.serial + '.temperature')
                   , pressure    : yapi.yFindPressure(info.device.unit.serial + '.pressure')
                   };

  if (self.altimeter.module.isOnline()) {
     self.status = 'present';

    self.altimeter.module.get_logicalName_async(function(ctx, led, result) {
      if (result === yapi.Y_LOGICALNAME_INVALID) {
        return logger.error('device/' + self.deviceID, { event: 'get_logicalName', diagnostic: 'logicalName invalid' });
      }

      if ((!result) || (result.length === 0) || (result === self.name)) return;

      logger.info('device/' + self.deviceID, { event: 'get_logicalName', result: result });
      self.setName(result);
    });
  } else self.status = 'absent';
  self.changed();

  self.altimeter.altitude.get_unit_async(function(ctx, led, result) {
    if (result === yapi.Y_UNIT_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'altitude.get_unit', diagnostic: 'unit invalid' });
    }

    logger.info('device/' + self.deviceID, { event: 'altitude.get_unit', result: result });
  });
  self.altimeter.temperature.get_unit_async(function(ctx, led, result) {
    if (result === yapi.Y_UNIT_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'temperature.get_unit', diagnostic: 'unit invalid' });
    }

    logger.info('device/' + self.deviceID, { event: 'temperature.get_unit', result: result });
  });
  self.altimeter.pressure.get_unit_async(function(ctx, led, result) {
    if (result === yapi.Y_UNIT_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'pressure.get_unit', diagnostic: 'unit invalid' });
    }

    logger.info('device/' + self.deviceID, { event: 'pressure.get_unit', result: result });
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  setInterval(function() { self.scan(self); }, 15 * 1000);
  self.scan(self);
};
util.inherits(Sensor, climate.Device);

Sensor.prototype.scan = function(self) {
  var status = self.altimeter.module.isOnline() ? 'present' : 'absent';

  if (self.status !== status) {
    self.status = status;
    self.changed();
  }
  if (self.status !== 'present') return;

  self.altimeter.altitude.get_currentValue_async(function(ctx, led, result) {
    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'altitude currentValue invalid' });
    }

    self.update(self, { altitude: result, lastSample: new Date().getTime() });
  });

  self.altimeter.temperature.get_currentValue_async(function(ctx, led, result) {
    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'temperature currentValue invalid' });
    }

    self.update(self, { temperature: result, lastSample: new Date().getTime() });
  });

  self.altimeter.pressure.get_currentValue_async(function(ctx, led, result) {
    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'pressure currentValue invalid' });
    }

    self.update(self, { pressure: result, lastSample: new Date().getTime() });
  });
};

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

Sensor.prototype.perform = function(self, taskID, perform, parameter) {
  var params, result;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.ikon) self.setIkon(params.ikon, taskID);

  result = self.altimeter.module.set_logicalName(params.name);
  if (result === yapi.YAPI_SUCCESS) return self.setName(params.name, taskID);

  logger.error('device/' + self.deviceID, { event: 'set_logicalName', result: result });
  return false;
};


exports.start = function() {
  steward.actors.device.sensor.yoctopuce = steward.actors.device.sensor.yoctopuce ||
      { $info     : { type: '/device/sensor/yoctopuce' } };

  steward.actors.device.sensor.yoctopuce.altimeter =
      { $info     : { type       : '/device/sensor/yoctopuce/altimeter'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'present', 'absent' ]
                                   , lastSample  : 'timestamp'
                                   , altitude    : 'meters'
                                   , temperature : 'celsius'
                                   , pressure    : 'millibars'
                                   }
                    }
      , $validate : {  perform   : hub.validate_perform }
      };
  devices.makers['/device/sensor/yoctopuce/altimeter'] = Sensor;

  hub.register('Yocto-Altimeter', '/device/sensor/yoctopuce/altimeter');
};
