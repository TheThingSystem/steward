// Yocto-4-20mA-Rx: http://www.yoctopuce.com/EN/products/usb-electrical-sensors/yocto-4-20ma-rx

var util        = require('util')
  , yapi        = require('yoctolib')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , hub         = require('./../devices-gateway/gateway-yoctopuce-hub')
  , sensor      = require('./../device-sensor')
  ;


var logger = sensor.logger;


var Sensor = exports.Device = function(deviceID, deviceUID, info) {
  var param;

  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = { lastSample: new Date().getTime() };
  for (param in info.params) if (info.params.hasOwnProperty(param)) self.info[param] = info.params[param];
  sensor.update(self.deviceID, info.params);

  self.status = 'waiting';
  self.rx = yapi.yFindGenericSensor(info.device.unit.serial);
  self.sensorQ = info.sensorQ;

  if (self.rx.isOnline()) {
    self.status = 'present';

    self.rx.get_logicalName_async(function(ctx, led, result) {
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

  setInterval(function() { self.scan(self); }, 2 * 1000);
  self.scan(self);
};
util.inherits(Sensor, sensor.Device);

Sensor.prototype.scan = function(self) {
  var status = self.rx.isOnline() ? 'present' : 'absent';

  if (self.status !== status) {
    self.status = status;
    self.changed();
  }
  if (self.status !== 'present') return;

  self.rx.get_currentValue_async(function(ctx, led, result) {
    var params;

    if (result === yapi.Y_LCURRENTVALUE_INVALID) {
      return logger.error('device/' + self.deviceID, { event: 'get_currentValue', diagnostic: 'currentValue invalid' });
    }

    params = { lastSample : new Date().getTime() };
    params[self.sensorQ] = (isNaN(result) || result < 0) ? 0 : result;
    self.update(self, params);
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

  result = self.rx.set_logicalName(params.name);
  if (result === yapi.YAPI_SUCCESS) return self.setName(params.name, taskID);

  logger.error('device/' + self.deviceID, { event: 'set_logicalName', result: result });
  return false;
};


exports.prime = function(sensorQ) {
  steward.actors.device.sensor.yoctopuce = steward.actors.device.sensor.yoctopuce ||
      { $info     : { type: '/device/sensor/yoctopuce' } };

  if (!!steward.actors.device.sensor.yoctopuce[sensorQ]) return;

  steward.actors.device.sensor.yoctopuce[sensorQ] =
      { $info     : { type       : '/device/sensor/yoctopuce/' + sensorQ
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'present', 'absent' ]
                                   , lastSample : 'timestamp'
                                   }
                    }
      , $validate : {  perform   : hub.validate_perform }
      };
  steward.actors.device.sensor.yoctopuce[sensorQ].$info.properties[sensorQ] = 'ppm';
  devices.makers['/device/sensor/yoctopuce/' + sensorQ] = Sensor;
};

exports.start = function() {};
