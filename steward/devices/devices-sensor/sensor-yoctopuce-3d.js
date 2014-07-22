// Yocto-3D: http://www.yoctopuce.com/EN/products/usb-sensors/yocto-3D

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

  self.info = { heading: null, acceleration: null, magnetism: null, orientation: null, lastSample: new Date().getTime() };
  for (param in info.params) if (info.params.hasOwnProperty(param)) self.info[param] = info.params[param];
  sensor.update(self.deviceID, info.params);

  self.status = 'waiting';
  self.threeD = { module        : info.module
                , accelerometer : yapi.yFindAccelerometer(info.device.unit.serial + '.accelerometer')
                , compass       : yapi.yFindCompass(info.device.unit.serial + '.compass')
                , gyro           : yapi.yFindGyro(info.device.unit.serial + '.gyro')
                , magnetometer  : yapi.yFindMagnetometer(info.device.unit.serial + '.magnetometer')
                };

  if (self.threeD.module.isOnline()) {
     self.status = 'present';

    self.threeD.module.get_logicalName_async(function(ctx, led, result) {
      if (result === yapi.Y_LOGICALNAME_INVALID) {
        return logger.error('device/' + self.deviceID, { event: 'get_logicalName', diagnostic: 'logicalName invalid' });
      }

      if ((!result) || (result.length === 0) || (result === self.name)) return;

      logger.info('device/' + self.deviceID, { event: 'get_logicalName', result: result });
      self.setName(result);
    });
  } else self.status = 'absent';
  self.changed();

  self.threeD.accelerometer.get_unit_async(function(ctx, led, result) {
    if (result === yapi.Y_UNIT_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'accelerometer.get_unit', diagnostic: 'unit invalid' });
    }

    logger.info('device/' + self.deviceID, { event: 'accelerometer.get_unit', result: result });
  });
  self.threeD.compass.get_unit_async(function(ctx, led, result) {
    if (result === yapi.Y_UNIT_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'compass.get_unit', diagnostic: 'unit invalid' });
    }

    logger.info('device/' + self.deviceID, { event: 'compass.get_unit', result: result });
  });
  self.threeD.gyro.get_unit_async(function(ctx, led, result) {
    if (result === yapi.Y_UNIT_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'gyro.get_unit', diagnostic: 'unit invalid' });
    }

    logger.info('device/' + self.deviceID, { event: 'gyro.get_unit', result: result });
  });
  self.threeD.magnetometer.get_unit_async(function(ctx, led, result) {
    if (result === yapi.Y_UNIT_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'magnetometer.get_unit', diagnostic: 'unit invalid' });
    }

    logger.info('device/' + self.deviceID, { event: 'magnetometer.get_unit', result: result });
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
  var status = self.threeD.module.isOnline() ? 'present' : 'absent';

  if (self.status !== status) {
    self.status = status;
    self.changed();
  }
  if (self.status !== 'present') return;

  self.threeD.accelerometer.get_xValue_async(function(ctx, led, x) {
    if (x === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'accelerometer xValue invalid' });
    }

    self.threeD.accelerometer.get_yValue_async(function(ctx, led, y) {
      if (y === yapi.Y_LCURRENTVALUE_INVALID) {
        return logger.error('device/' + self.deviceID,
                            { event: 'get_currentValue', diagnostic: 'accelerometer yValue invalid' });
      }

      self.threeD.accelerometer.get_zValue_async(function(ctx, led, z) {
        if (z === yapi.Y_LCURRENTVALUE_INVALID) {
          return logger.error('device/' + self.deviceID,
                              { event: 'get_currentValue', diagnostic: 'accelerometer zValue invalid' });
        }

        self.update(self, { acceleration: [x, y, z], lastSample: new Date().getTime() });
      });
    });
  });

  self.threeD.compass.get_currentValue_async(function(ctx, led, result) {
    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'altitude currentValue invalid' });
    }

    self.update(self, { heading: result, lastSample: new Date().getTime() });
  });

  self.threeD.gyro.get_xValue_async(function(ctx, led, x) {
    if (x === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'accelerometer xValue invalid' });
    }

    self.threeD.gyro.get_yValue_async(function(ctx, led, y) {
      if (y === yapi.Y_LCURRENTVALUE_INVALID) {
        return logger.error('device/' + self.deviceID,
                            { event: 'get_currentValue', diagnostic: 'accelerometer yValue invalid' });
      }

      self.threeD.gyro.get_zValue_async(function(ctx, led, z) {
        if (z === yapi.Y_LCURRENTVALUE_INVALID) {
          return logger.error('device/' + self.deviceID,
                              { event: 'get_currentValue', diagnostic: 'accelerometer zValue invalid' });
        }

        self.update(self, { orientation: [x, y, z], lastSample: new Date().getTime() });
      });
    });
  });

  self.threeD.magnetometer.get_xValue_async(function(ctx, led, x) {
    if (x === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID,
                          { event: 'get_currentValue', diagnostic: 'accelerometer xValue invalid' });
    }

    self.threeD.magnetometer.get_yValue_async(function(ctx, led, y) {
      if (y === yapi.Y_LCURRENTVALUE_INVALID) {
        return logger.error('device/' + self.deviceID,
                            { event: 'get_currentValue', diagnostic: 'accelerometer yValue invalid' });
      }

      self.threeD.magnetometer.get_zValue_async(function(ctx, led, z) {
        if (z === yapi.Y_LCURRENTVALUE_INVALID) {
          return logger.error('device/' + self.deviceID,
                              { event: 'get_currentValue', diagnostic: 'accelerometer zValue invalid' });
        }

// Gauss to microTesla
        self.update(self, { magnetism: [x * 100, y * 100, z * 100], lastSample: new Date().getTime() });
      });
    });
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

  result = self.threeD.module.set_logicalName(params.name);
  if (result === yapi.YAPI_SUCCESS) return self.setName(params.name, taskID);

  logger.error('device/' + self.deviceID, { event: 'set_logicalName', result: result });
  return false;
};


exports.start = function() {
  steward.actors.device.sensor.yoctopuce = steward.actors.device.sensor.yoctopuce ||
      { $info     : { type: '/device/sensor/yoctopuce' } };

  steward.actors.device.sensor.yoctopuce['3D'] =
      { $info     : { type       : '/device/sensor/yoctopuce/3D'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'present', 'absent' ]
                                   , lastSample   : 'timestamp'
                                   , heading      : 'degrees'
                                   , acceleration : { x: 'meters/second^2', y: 'meters/second^2', z: 'meters/second^2' }
                                   , magnetism    : { x: 'microteslas',     y: 'microteslas',     z: 'microteslas'     }
                                   , orientation  : { x: 'degrees/second',  y: 'degrees/second',  z: 'degrees/second'  }
                                   }
                    }
      , $validate : {  perform   : hub.validate_perform }
      };
  devices.makers['/device/sensor/yoctopuce/3D'] = Sensor;

  hub.register('Yocto-3D', '/device/sensor/yoctopuce/3D');
};
