// Z-wave on/off switches

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
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
};
util.inherits(ZWave_OnOff, plug.Device);


ZWave_OnOff.prototype.update = function(self, event, comclass, value) {
  if (event === 'value added') event = 'value changed';

  var f = { 'value changed' :
              function() {
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

  if ((perform !== 'on' && perform !== 'off') || perform === self.status) return;

  logger.info('device/' + self.deviceID, { perform: { on: (perform === 'on' ? true : false) } });
  self.driver['switch' + (perform === 'on' ? 'On' : 'Off')](self.peripheral.nodeid);
  self.changed();

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  if (perform === 'off') return result;

  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }
  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if ((!params.name) && (!params.physical)) result.requires.push('name');
    return result;
  }

  if (perform !== 'on') result.invalid.push('perform');

  return result;
};


var manufacturers =
{ '0063' : { '3130' : { name: 'Outdoor Module',                      deviceType: '/device/switch/ge/onoff'      } }
, '0086' : { '0006' : { name: 'Smart Energy Switch',                 deviceType: '/device/switch/aeotec/onoff'  } }
};

exports.start = function() {
  var registrar =   require('./../devices-gateway/gateway-openzwave-usb');

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

  registrar.register(ZWave_OnOff, '/device/switch/zwave/onoff', manufacturers);
};
