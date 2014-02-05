// BLE: http://developer.bluetooth.org/gatt/services/Pages/ServiceViewer.aspx?u=org.bluetooth.service.immediate_alert.xml

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , presence    = require('./../device-presence')
  ;


var levels = { none: 0x00, mild: 0x01, high: 0x02 };

var logger = presence.logger;


var Fob = exports.Device = function(deviceID, deviceUID, info) {
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
util.inherits(Fob, presence.Device);


Fob.prototype.connect = function(self) {
  self.peripheral.connect(function(err) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'connect', diagnostic: err.message });

    self.peripheral.discoverSomeServicesAndCharacteristics([ '1802' ], [ '2a06' ], function(err, services, characteristics) {
      if (err) return logger.error('device/' + self.deviceID, { event: 'discover', diagnostic: err.message });

      self.alert = characteristics[0];
    });
  });
};

Fob.prototype.perform = function(self, taskID, perform, parameter) {
  var level, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return self.setName(params.name, taskID);
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

  steward.actors.device.presence.ble = steward.actors.device.presence.ble ||
      { $info     : { type: '/device/presence/ble' } };

  steward.actors.device.presence.ble.fob =
      { $info     : { type       : '/device/presence/ble/fob'
                    , observe    : [ ]
                    , perform    : [ 'alert' ]
                    , properties : { name   : true
                                   , status : [ 'present', 'absent', 'recent' ]
                                   , rssi   : 's8'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/presence/ble/fob'] = Fob;

  steward.actors.device.presence.hone = utility.clone(steward.actors.device.presence.ble);
  steward.actors.device.presence.hone.$info.type = '/device/presence/hone';
  steward.actors.device.presence.hone.fob = utility.clone(steward.actors.device.presence.ble.fob);
  steward.actors.device.presence.hone.fob.$info.type = '/device/presence/hone/fob';
  devices.makers['/device/presence/hone/fob'] = Fob;
  register('/device/presence/hone/fob', 'Hone', [ '1802' ]);

  steward.actors.device.presence.inrange = utility.clone(steward.actors.device.presence.ble);
  steward.actors.device.presence.inrange.$info.type = '/device/presence/inrange';
  steward.actors.device.presence.inrange.fob = utility.clone(steward.actors.device.presence.ble.fob);
  steward.actors.device.presence.inrange.fob.$info.type = '/device/presence/inrange/fob';
  devices.makers['/device/presence/inrange/fob'] = Fob;
  register('/device/presence/inrange/fob', 'Philips AEA1000', [ '1802', '1803' ]);

  steward.actors.device.presence.chipolo = utility.clone(steward.actors.device.presence.ble);
  steward.actors.device.presence.chipolo.$info.type = '/device/presence/chipolo';
  steward.actors.device.presence.chipolo.fob = utility.clone(steward.actors.device.presence.ble.fob);
  steward.actors.device.presence.chipolo.fob.$info.type = '/device/presence/chipolo/fob';
  devices.makers['/device/presence/chipolo/fob'] = Fob;
  register('/device/presence/chipolo/fob', 'Chipolo', [ '451085d6f8334f7783d44f9438894ed5' ]);
};
