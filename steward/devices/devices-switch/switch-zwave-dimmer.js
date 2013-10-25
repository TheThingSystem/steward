// Z-wave dimmer switches

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var ZWave_Dimmer = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  var bri, level;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  bri = info.peripheral.classes[0x26][0];
  level = devices.percentageValue(bri.value, bri.max);

  self.status = level > 0 ? 'on' : 'off';
  self.changed();
  self.driver = info.driver;
  self.peripheral = info.peripheral;
  self.info = { level: level };

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.driver.enablePoll(self.peripheral.nodeid, 0x26);
};
util.inherits(ZWave_Dimmer, plug.Device);


ZWave_Dimmer.prototype.update = function(self, event, comclass, value) {
  if (event === 'value added') event = 'value changed';

  var f = { 'value changed' :
              function() {
                var bri, level;

                if (!self.peripheral.classes[comclass]) self.peripheral.classes[comclass] = {};
                self.peripheral.classes[comclass][value.index] = value;
                if ((comclass !== 0x26) || (value.index !== 0)) return;
                bri = value;

                level = devices.percentageValue(bri.value, bri.max);

                self.status = level > 0 ? 'on' : 'off';
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


ZWave_Dimmer.prototype.perform = function(self, taskID, perform, parameter) {
  var bri, params, state;

  state = {};
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) self.driver.setName(self.peripheral.nodeid, params.name);
    if (!!params.physical) self.driver.setLocation(self.peripheral.nodeid, params.physical);

    return ((!params.name) || self.setName(params.name, taskID));
  }

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return;
  else {
    state.on = true;

    if (!params.level) params.level = self.info.level;
    if (params.level <= 0) params.level = 100;
    state.level = params.level;
  }

  logger.info('device/' + self.deviceID, { perform: state });

  bri = self.peripheral.classes[0x26][0];
  if (state.on) {
    if ((self.status === 'on') && (self.info.level === state.level)) return;
    self.status = 'on';

    bri.value = devices.scaledPercentage(state.level, bri.min, bri.max);
// TBD: turn it on and set it to bri.value
  } else {
    if ((self.status === 'off') && (self.info.level === state.level)) return;
    self.status = 'off';

    bri.value = bri.min;
// TBD: turn it off
  }
  self.peripheral.classes[0x26][0] = bri;
  self.info.level = state.level;

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

  if ((!!params.level) && (!plug.validLevel(params.level))) result.invalid.push('level');

  return result;
};


var manufacturers =
{ '001a' : { '0003' : { name: 'Aspire RF Dimmer',                    deviceType: '/device/switch/cooper/dimmer' } }
, '0063' : { '3030' : { name: 'Lamp Dimmer/Plugin Appliance Module', deviceType: '/device/switch/ge/dimmer'     } }
};

exports.start = function() {
  var registrar =   require('./../devices-gateway/gateway-openzwave-usb');

  steward.actors.device['switch'].zwave = steward.actors.device['switch'].zwave ||
      { $info     : { type: '/device/switch/zwave' } };

  steward.actors.device['switch'].zwave.dimmer =
      { $info     : { type       : '/device/switch/zwave/dimmer'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name     : true
                                   , status   : [ 'on', 'off' ]
                                   , physical : true
                                   , level    : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/switch/zwave/dimmer'] = ZWave_Dimmer;
  registrar.pair(0x26, '/device/switch/zwave/dimmer'); // COMMAND_CLASS_SWITCH_MULTILEVEL

  registrar.register(ZWave_Dimmer, '/device/switch/zwave/dimmer', manufacturers);
};
