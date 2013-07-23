//
// http://www.ti.com/ww/en/wireless_connectivity/sensortag/index.shtml?INTC=SensorTag&HQS=sensortag-bt1

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , tricorder   = require('./../device-tricorder')
  ;

var logger = tricorder.logger;

var SensorTag = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'present';
  self.changed();
  self.peripheral = info.peripheral;
  self.ble = info.ble;
  self.info = {};

  self.peripheral.on('connect', function() {
    self.peripheral.updateRssi();
  });

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

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};

util.inherits(SensorTag, tricorder.Device);


SensorTag.prototype.observe = function(self, eventID, observe, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  switch (observe) {
    case 'buttons':
      steward.report(eventID);
      break;

    default:
      break;
  }

};

SensorTag.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) {
                self.setName(params.name);
        }
    return steward.performed(taskID);
  }

  if (perform === 'accelerometer') {

    return steward.performed(taskID);
  }

  return false;
};


var validate_observe = function(observe, parameter) {
  var result = { invalid: [], requires: [] };

  if (observe !== 'buttons') result.invalid.push('observe');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}, result = { invalid: [], requires: [] };

  if ((perform !== 'set') && (perform !== 'accelerometer')) result.invalid.push('perform');

  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }
  try {
        params = JSON.parse(parameter);
  } catch(ex) {
        result.invalid.push('parameter');
  }

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
  }

  return result;
};


exports.start = function() {
  steward.actors.device.tricorder['texas-instruments'] = steward.actors.device.tricorder['texas-instruments'] ||
      { $info     : { type       : '/device/tricorder/texas-instruments' } };

  steward.actors.device.tricorder['texas-instruments'].sensortag =
      { $info     : { type       : '/device/tricorder/texas-instruments/sensortag'
                    , observe    : [ 'buttons' ]
                    , perform    : [ 'accelerometer' ]
                    , properties : { name   : true
                                   , status : [ 'present', 'absent', 'idle' ]
                                   , rssi   : 's8'
                                                                   , lastSample: 'timestamp'
                                                                   , accelerometer: 'meters/second'
                                   }
                    }
                , $observe : { observe    : validate_observe }
                , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/tricorder/texas-instruments/sensortag'] = SensorTag;

  require('./../../discovery/discovery-ble').register(
    { 'Texas Instruments'       : { '2a00' : { 'TI BLE Sensor Tag' : { type : '/device/tricorder/texas-instruments/sensortag' }
                                             }
                                  }
    });
};
