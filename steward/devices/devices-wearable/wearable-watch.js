// BLE: http://developer.bluetooth.org/gatt/services/Pages/ServiceViewer.aspx?u=org.bluetooth.service.immediate_alert.xml

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , wearable    = require('./../device-wearable')
  ;


var levels = { none: 0x00, mild: 0x01, high: 0x02 };

var logger = wearable.logger;


var Watch = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'present';
  self.changed();
  self.peripheral = info.peripheral;
  self.info = { rssi: self.peripheral.rssi };

  self.peripheral.on('disconnect', function() {
    self.alert = undefined;
    self.status = 'recent';
    self.changed();

    logger.info('device/' + self.deviceID, { status: self.status });
// TBD: handle connection timeout...
    setTimeout(function() { self.status = 'absent'; self.changed(); self.connect(self); }, 120 * 1000);
  }).on('rssiUpdate', function(rssi) {
    self.status = 'present';
    self.info.rssi = rssi;
    self.changed();

    logger.info('device/' + self.deviceID, { status: self.status });
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.connect(self);
};
util.inherits(Watch, wearable.Device);


Watch.prototype.connect = function(self) {
  self.peripheral.connect(function(err) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'connect', diagnostic: err.message });

    self.peripheral.discoverSomeServicesAndCharacteristics([ '1802' ], [ '2a06' ], function(err, services, characteristics) {
      if (err) return logger.error('device/' + self.deviceID, { event: 'discover', diagnostic: err.message });

      self.alert = characteristics[0];
    });
  });
};

Watch.prototype.perform = function(self, taskID, perform, parameter) {
  var level, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return devices.perform(self, taskID, perform, parameter);
  if (perform !== 'alert') return false;

  level = levels[params.level] || 0x00;

  try {
    self.alert.write(new Buffer([ level ]));
    setTimeout(function() { self.alert.write(new Buffer([ 0x00 ])); }, 2000);
    steward.performed(taskID);
  } catch(ex) { logger.error('device/' + self.deviceID, { event: 'perform', diagnostic: ex.message }); }

  return true;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
    return result;
  }

  if (perform === 'alert') {
    if (!params.level) result.requires.push('level');
    else if (!levels[params.level]) result.invalid.push('level');
    return result;
  }

  result.invalid.push('perform');

  return result;
};


exports.start = function() {
  var register = require('./../../discovery/discovery-ble').register;

  steward.actors.device.wearable.ble = steward.actors.device.wearable.ble ||
      { $info     : { type: '/device/wearable/ble' } };

  steward.actors.device.wearable.ble.watch =
      { $info     : { type       : '/device/wearable/ble/watch'
                    , observe    : [ ]
                    , perform    : [ 'alert' ]
                    , properties : { name   : true
                                   , status : [ 'present', 'absent', 'recent' ]
                                   , rssi   : 's8'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/wearable/ble/watch'] = Watch;

  steward.actors.device.wearable.cookoo = utility.clone(steward.actors.device.wearable.ble);
  steward.actors.device.wearable.cookoo.$info.type = '/device/wearable/cookoo';
  steward.actors.device.wearable.cookoo.watch = utility.clone(steward.actors.device.wearable.ble.watch);
  steward.actors.device.wearable.cookoo.watch.$info.type = '/device/wearable/cookoo/watch';
  devices.makers['/device/wearable/cookoo/watch'] = Watch;
  register('/device/wearable/cookoo/watch', 'COOKOO watch', [ '1802', '180a' ]);
  register('/device/wearable/cookoo/watch', 'COOKOO watch', [ '4b455254747211e1a5750002a5d58001' ]);

  steward.actors.device.wearable.metawatch = utility.clone(steward.actors.device.wearable.ble);
  steward.actors.device.wearable.metawatch.$info.type = '/device/wearable/metawatch';
  steward.actors.device.wearable.metawatch.watch = utility.clone(steward.actors.device.wearable.ble.watch);
  steward.actors.device.wearable.metawatch.watch.$info.type = '/device/wearable/metawatch/watch';
  devices.makers['/device/wearable/metawatch/watch'] = Watch;
  register('/device/wearable/metawatch/watch', 'MetaWatch 08', [ '8880' ]);
};
