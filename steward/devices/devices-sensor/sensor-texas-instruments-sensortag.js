// http://www.ti.com/ww/en/wireless_connectivity/sensortag/index.shtml?INTC=SensorTag&HQS=sensortag-bt1

/*
temperature
ir temperature
humidity
pressure

acceleration [meters/second^2]3
magnetic [microTesla]3
gyro [degrees/second]3

 */

var sensortag   = require('sensortag')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , sensor      = require('./../device-sensor')
  ;


var logger = sensor.logger;


var SensorTag = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.status = 'present';
  self.changed();
  self.peripheral = info.peripheral;
  self.sensor = new sensortag(self.peripheral);
  self.info = { rssi: self.peripheral.rssi };

  self.peripheral.connect();

  self.peripheral.on('disconnect', function() {
    self.status = 'idle';
    self.changed();

    logger.info('device/' + self.deviceID, { status: self.status });
// TBD: handle connection timeout...
    setTimeout(function() { self.status = 'absent'; self.changed(); self.peripheral.connect(); }, 120 * 1000);
  });
  self.peripheral.on('rssiUpdate', function(rssi) {
    self.status = 'present';
    self.info.rssi = rssi;
    self.changed();

    logger.info('device/' + self.deviceID, { status: self.status });
  });

  self.sensor.discoverServicesAndCharacteristics(function() {
    var feature, features;

    features =
      { Humidity           : function(temperature, humidity) {
                               var didP   = false
                                 , params = { lastSample: new Date().getTime() }
                                 ;

                               if (self.info.temperature !== temperature) {
                                 didP = true;
                                 params.temperature = self.info.temperature = temperature;
                               }
                               humidity = humidity.toFixed(0);
                               if (self.info.humidity !== humidity) {
                                 didP = true;
                                 params.humidity = self.info.humidity = humidity;
                               }
                               self.info.lastSample = params.lastSample;
                               if (didP) return self.update(self, params);
                             }
      , BarometricPressure :
                             function(pressure) {
                               var didP   = false
                                 , params = { lastSample: new Date().getTime() }
                                 ;

                               pressure = pressure.toFixed(0);
                               if (self.info.pressure !== pressure) {
                                 didP = true;
                                 params.pressure = self.info.pressure = pressure;
                               }
                               self.info.lastSample = params.lastSample;
                               if (didP) return self.update(self, params);
                             }
      , Accelerometer      :
                             function(x, y, z) {
                               var didP = false;

                               // convert to m/s^2
                               x = (x * 9.80665).toFixed(2); y = (y * 9.80665).toFixed(2); z = (z * 9.80665).toFixed(2);
                               if (!self.info.acceleration) self.info.acceleration = {};
                               if (self.info.acceleration.x != x) { didP = true; self.info.acceleration.x = x; }
                               if (self.info.acceleration.y != y) { didP = true; self.info.acceleration.y = y; }
                               if (self.info.acceleration.z != z) { didP = true; self.info.acceleration.z = z; }
                               self.info.lastSample = new Date().getTime();
                               if (didP) self.changed();
                             }
      , Magnetometer       :
                             function(x, y, z) {
                               var didP = false;

                               x = x.toFixed(0); y = y.toFixed(0); z = z.toFixed(0);
                               if (!self.info.magnetism) self.info.magnetism = {};
                               if (self.info.magnetism.x != x) { didP = true; self.info.magnetism.x = x; }
                               if (self.info.magnetism.y != y) { didP = true; self.info.magnetism.y = y; }
                               if (self.info.magnetism.z != z) { didP = true; self.info.magnetism.z = z; }
                               self.info.lastSample = new Date().getTime();
                               if (didP) self.changed();
                             }
      , Gyroscope          :
                             function(x, y, z) {
                               var didP = false;

                               x = x.toFixed(2); y = y.toFixed(2); z = z.toFixed(2);
                               if (!self.info.orientation) self.info.orientation = {};
                               if (self.info.orientation.x != x) { didP = true; self.info.orientation.x = x; }
                               if (self.info.orientation.y != y) { didP = true; self.info.orientation.y = y; }
                               if (self.info.orientation.z != z) { didP = true; self.info.orientation.z = z; }
                               self.info.lastSample = new Date().getTime();
                               if (didP) self.changed();
                             }
      };
    for (feature in features) if (features.hasOwnProperty(feature)) self.monitor(self, feature, features[feature]);

//    self.ready(self);
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(SensorTag, sensor.Device);

SensorTag.prototype.monitor = function(self, feature, callback) {
  self.sensor['enable' + feature](function(err) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'enable' + feature, diagnostic: err.message });

    self.sensor['read' + feature](callback);
    self.sensor.on(feature.substring(0, 1).toLowerCase() + feature.substring(1) + 'Change', callback);
    self.sensor['notify' + feature](function(err) {
      if (!!err) return logger.error('device/' + self.deviceID, { event: 'notify' + feature, diagnostic: err.message });
    });
  });
};

SensorTag.prototype.update = function(self, params) {
  sensor.update(self.deviceID, params);
  self.changed();
};


exports.start = function() {
  steward.actors.device.sensor['texas-instruments'] = steward.actors.device.sensor['texas-instruments'] ||
      { $info     : { type       : '/device/sensor/texas-instruments' } };

  steward.actors.device.sensor['texas-instruments'].sensortag =
      { $info     : { type       : '/device/sensor/texas-instruments/sensortag'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name          : true
                                   , status        : [ 'present', 'absent', 'idle' ]
                                   , rssi          : 's8'
                                   , lastSample    : 'timestamp'
                                   , temperature   : 'celsius'
                                   , humidity      : 'percentage'
                                   , pressure      : 'millibars'
                                   , acceleration  : { x: 'meters/second^2', y: 'meters/second^2', z: 'meters/second^2' }
                                   , magnetism     : { x: 'microteslas',     y: 'microteslas',     z: 'microteslas'     }
                                   , orientation   : { x: 'degrees/second',  y: 'degrees/second',  z: 'degrees/second'  }
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/sensor/texas-instruments/sensortag'] = SensorTag;

  require('./../../discovery/discovery-ble').register('/device/sensor/texas-instruments/sensortag', 'SensorTag');
};
