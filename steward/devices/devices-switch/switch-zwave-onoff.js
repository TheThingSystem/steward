// Z-wave on/off switches

var registrar
  , utility     = require('./../../core/utility')
  ;

try {
  registrar = require('./../devices-gateway/gateway-openzwave-usb');
  if (!registrar.pair) throw new Error('openzwave-usb gateway unable to start');
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing zwave-onoff switch (continuing)', { diagnostic: ex.message });
}

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var ZWave_OnOff = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = info.peripheral.classes[0x25][0].value ? 'on' : 'off';
  self.changed();
  self.driver = info.driver;
  self.peripheral = info.peripheral;
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.driver.enablePoll(self.peripheral.nodeid, 0x25);
  self.driver.enablePoll(self.peripheral.nodeid, 0x32);
};
util.inherits(ZWave_OnOff, plug.Device);


ZWave_OnOff.prototype.update = function(self, event, comclass, value) {
  if (event === 'value added') event = 'value changed';

  var f = { 'value changed' :
              function() {
                var meterData = self.peripheral.classes[0x32];
                if (!!meterData) {
                  if (!!meterData[0]) self.info.dailyUsage = +meterData[0].value / 1000;
                  if (!!meterData[8]) self.info.currentUsage = +meterData[8].value;
                }

                if (!self.peripheral.classes[comclass]) self.peripheral.classes[comclass] = {};
                self.peripheral.classes[comclass][value.index] = value;
                if ((comclass !== 0x25) || (value.index !== 0)) return;

                self.status = value.value ? 'on' : 'off';
                self.changed();
              }

          , 'value removed' :
              function() {
                try { delete(self.peripheral.classes[comclass][value]); } catch(ex) {}

// TBD: something to do here?
              }

          , 'notification'  :
              function() {
                logger.warning('device/' + self.deviceID, { event: 'notification', value: value });

// TBD: something to do here?
              }
  };
  if (!!f[event]) return (f[event])();

  logger.warning('device/' + self.deviceID,
    { event: event, comclass: comclass, value: value, diagnostic: 'unexpected update' });
};


ZWave_OnOff.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) self.driver.setName(self.peripheral.nodeid, params.name);
    if (!!params.physical) self.driver.setLocation(self.peripheral.nodeid, params.physical);

    return ((!params.name) || self.setName(params.name, taskID));
  }
  if ((perform !== 'on' && perform !== 'off') || perform === self.status) return false;

  logger.info('device/' + self.deviceID, { perform: { on: (perform === 'on' ? true : false) } });

  self.driver['switch' + (perform === 'on' ? 'On' : 'Off')](self.peripheral.nodeid);
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'off') return result;

  if (perform === 'set') {
    if ((!params.name) && (!params.physical)) result.requires.push('name');
    return result;
  }

  if (perform !== 'on') result.invalid.push('perform');

  return result;
};


exports.start = function() {
  steward.actors.device['switch'].zwave = steward.actors.device['switch'].zwave ||
      { $info     : { type: '/device/switch/zwave' } };

  steward.actors.device['switch'].zwave.onoff =
      { $info     : { type       : '/device/switch/zwave/onoff'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name     : true
                                   , status   : [ 'on', 'off' ]
                                   , physical : true
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/switch/zwave/onoff'] = ZWave_OnOff;
  registrar.pair(0x25, '/device/switch/zwave/onoff');  // COMMAND_CLASS_SWITCH_BINARY
};
