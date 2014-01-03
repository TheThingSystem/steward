// Z-wave sensor template
// search for "template" to see what to change...

var registrar
  , utility     = require('./../../core/utility')
  ;

try {
  registrar = require('./../devices-gateway/gateway-openzwave-usb');
  if (!registrar.pair) throw new Error('openzwave-usb gateway unable to start');
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing zwave-template sensor (continuing)', { diagnostic: ex.message });
}

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , sensor      = require('./../device-sensor')
  ;


var logger = sensor.logger;


var ZWave_Template = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'quiet';
  self.changed();
  self.driver = info.driver;
  self.peripheral = info.peripheral;
  self.info = { lastSample: null };
  self.events = {};

  utility.broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      if (observe === 'template') self.events[eventID] = { observe: observe, parameter: parameter };
      return;
    }
    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });


/* change to correct value(s) to monitor
  self.driver.enablePoll(self.peripheral.nodeid, 0x25);
 */
};
util.inherits(ZWave_Template, sensor.Device);


ZWave_Template.prototype.update = function(self, event, comclass, value) {
  if (event === 'value added') event = 'value changed';

  var f = { 'value changed' :
              function() {
                var eventID, now, templateP;

// see if the monitored value changed, if so:
                now = new Date();
                if (templateP) {
                  self.status = 'template';
                  self.info.lastSample = now;
                  for (eventID in self.events) if (self.events.hasOwnProperty(eventID)) steward.observed(eventID);
                  self.changed();
                 } else self.status = 'quiet';
                 self.changed(now);
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


ZWave_Template.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) self.driver.setName(self.peripheral.nodeid, params.name);
    if (!!params.physical) self.driver.setLocation(self.peripheral.nodeid, params.physical);

    return ((!params.name) || self.setName(params.name, taskID));
  }

  if ((perform !== 'on' && perform !== 'off') || perform === self.status) return false;

  logger.info('device/' + self.deviceID, { perform: { on: (perform === 'on' ? true : false) } });
/*
  self.driver['switch' + (perform === 'on' ? 'On' : 'Off')](self.peripheral.nodeid);
 */

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'off') return result;

  if (perform === 'set') {
    if ((!params.name) && (!params.physical)) result.requires.push('name');
    return result;
  }

  if (perform !== 'on') result.invalid.push('perform');

  return result;
};


var validate_observe = function(observe, parameter) {/* jshint unused: false */
  var result = { invalid: [], requires: [] };

  if (observe.charAt(0) === '.') return result;

  if (observe !== 'template') result.invalid.push('observe');

  return result;
};


var manufacturers =
{ 
};

exports.start = function() {
  steward.actors.device.sensor.zwave = steward.actors.device.sensor.zwave ||
      { $info     : { type: '/device/sensor/zwave' } };

  steward.actors.device.sensor.zwave.template =
      { $info     : { type       : '/device/sensor/zwave/template'
                    , observe    : [ 'template' ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'template', 'quiet' ]
                                   , physical   : true
                                   , lastSample : 'timestamp'
                                   }
                    }
      , $validate : { observe    : validate_observe
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/sensor/zwave/template'] = ZWave_Template;
/*
  registrar.pair(0x25, '/device/sensor/zwave/template');  // COMMAND_CLASS_SWITCH_BINARY
 */

  registrar.register(ZWave_Template, '/device/sensor/zwave/template', manufacturers);
};
