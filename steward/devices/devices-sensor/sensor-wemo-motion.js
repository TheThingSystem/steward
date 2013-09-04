// Wemo Motion: http://www.belkin.com/us/wemo-motion

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , sensor      = require('./../device-sensor')
  ;


var WeMo_Motion = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/sensor/wemo/motion';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'waiting';
  self.changed();
  self.info = { lastSample: null };
  self.sid = null;
  self.seq = 0;
  self.logger = sensor.logger;
  self.events = {};

  utility.broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      if (observe === 'motion') self.events[eventID] = { observe: observe, parameter: parameter };
      return;
    }
    if ((request === 'perform') && (observe === 'set')) return devices.perform(self, eventID, observe, parameter);
  });

  utility.broker.subscribe('discovery', function(method, headers, content) {
    if (method === 'notify') self.notify(self, headers, content);
  });

  self.jumpstart(self);
  self.primer(self);
};
util.inherits(WeMo_Motion, sensor.Device);
util.inherits(WeMo_Motion, require('./../devices-switch/switch-wemo-onoff').Device);


WeMo_Motion.prototype.observe = function(self, results) {
  var eventID, i, motion, now, onoff, previous;

  now = new Date();

  previous = self.status;
  if (self.status === 'waiting') self.changed(now);
  self.status = 'busy';
  if (!util.isArray(results)) return;

  for (i = 0; i < results.length; i++) {
    onoff = results[i].BinaryState;
    if (!util.isArray(onoff)) continue;

    motion = parseInt(onoff[0], 10);
    if (motion) {
      self.status = 'motion';
      self.info.lastSample = now;
      for (eventID in self.events) if (self.events.hasOwnProperty(eventID)) steward.observed(eventID);
      self.changed();
    } else self.status = 'quiet';
    break;
  }

  if (self.status != previous) self.changed(now);
};


var validate_observe = function(observe, parameter) {/* jshint unused: false */
  var result = { invalid: [], requires: [] };

  if (observe.charAt(0) === '.') return result;

  if (observe !== 'motion') result.invalid.push('observe');

  return result;
};


exports.start = function() {
  steward.actors.device.sensor.wemo = steward.actors.device.sensor.wemo ||
      { $info     : { type: '/device/sensor/wemo' } };

  steward.actors.device.sensor.wemo.motion =
      { $info     : { type       : '/device/sensor/wemo/motion'
                    , observe    : [ 'motion' ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'busy', 'motion', 'quiet' ]
                                   , lastSample : 'timestamp'
                                   }
                    }
      , $validate : { observe    : validate_observe
                    , perform    : devices.validate_perform
                    }
      };
  devices.makers['urn:Belkin:device:sensor:1'] = WeMo_Motion;
};
