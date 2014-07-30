// Leap Motion: https://www.leapmotion.com
// TODO: - determine minimally-invasive discovery algorithm
//       - determine why event handler so sluggish

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , sensor      = require('./../device-sensor')
  ;


var logger = sensor.logger;

var gestures = [ 'stop'
               , 'circle-finger-clockwise'
               , 'circle-finger-counter-clockwise'
               , 'up'
               , 'down'
               , 'clockwise'
               , 'counter-clockwise'
               , 'forward'
               , 'backward'
               , 'left'
               , 'right'
               ];

var Leap_Motion = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = self.initInfo({ status: 'stop', lastSample: new Date().getTime() });
  self.events = {};

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      if ((observe === 'gesture') && (gestures.indexOf(parameter) !== -1)) {
        self.events[eventID] = { observe: observe, parameter: parameter };
      }
      return;
    }
    if ((request === 'perform') && (observe === 'set')) return devices.perform(self, eventID, observe, parameter);
  });

  self.controller = require('nodecopter-leap');

// the logic in nodecopter-leap's logging example is well-suited
  [ 'stop'
  , 'takeoff'
  , 'land'
  , 'up'
  , 'down'
  , 'clockwise'
  , 'counterClockwise'
  , 'front'
  , 'back'
  , 'left'
  , 'right'
  ].forEach(function (cmd) {
    self.controller.on(cmd, function (value, duration) {
      var eventID, now;

      var status = { takeoff          : 'circle-finger-clockwise'
                   , land             : 'circle-finger-counter-clockwise'
                   , front            : 'forward'
                   , back             : 'backward'
                   , counterClockwise : 'counter-clockwise' }[cmd] || cmd;
      if (status === self.status) return;

logger.notice('device/' + self.deviceID, { status: status, value: value, duration: duration });
      self.status = status;
      now = new Date();
      self.info.lastSample = now.getTime();
      for (eventID in self.events) {
        if ((self.events.hasOwnProperty(eventID))
                && (self.events[eventID].observe === 'gesture')
                && (self.events[eventID].parameter === status)) steward.observed(eventID);
      }
      self.changed(now);
    });
  });

  self.controller.start();
};
util.inherits(Leap_Motion, sensor.Device);
Leap_Motion.prototype.perform = devices.perform;


var validate_observe = function(observe, parameter) {/* jshint unused: false */
  var result = { invalid: [], requires: [] };

  if (observe.charAt(0) === '.') return result;

  if (observe !== 'gesture') result.invalid.push('observe');

  return result;
};


exports.start = function() {
  steward.actors.device.sensor.leapmotion = steward.actors.device.sensor.leapmotion ||
      { $info     : { type: '/device/sensor/leapmotion' } };

  steward.actors.device.sensor.leapmotion.gesture =
      { $info     : { type       : '/device/sensor/leapmotion/gesture'
                    , observe    : [ 'gesture' ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : gestures
                                   , lastSample : 'timestamp'
                                   }
                    }
      , $validate : { observe    : validate_observe
                    , perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/sensor/leapmotion/gesture'] = Leap_Motion;
};
