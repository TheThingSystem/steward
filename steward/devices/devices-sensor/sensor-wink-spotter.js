// http://www.quirky.com/shop/609-Spotter-Multipurpose-Sensors

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , sensor      = require('./../device-sensor')
  ;


var Spotter = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = {};
  self.gateway = info.gateway;
  self.update(self, info.params);

  self.status = 'quiet';
  self.changed();

  self.logger = sensor.logger;
  self.events = {};
  self.observations = {};

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if ((request === 'observe') && ({ brightness: true, loudness: true, motion: true }[observe])) {
      self.events[eventID] = { observe: observe };
      return;
    }
    if ((request === 'perform') && (observe === 'set')) return self.perform(self, eventID, observe, parameter);
  });

  setInterval(function() { self.scan(self); }, 60 * 1000);
};
util.inherits(Spotter, sensor.Device);


Spotter.prototype.scan = function(self) {
  if (!self.gateway.wink) return;

  self.gateway.wink.getDevice(self.params, function(err, params) {
    if (!!err) return self.logger.error('device/' + self.deviceID, { event: 'getDevice', diagnostic: err.message});

    if (!!params) self.update(self, params);
  });
};

Spotter.prototype.update = function(self, params) {
  var d, data, eventID, firstP, observation, now, prop, props, previous, updateP;

  firstP = !self.params;
  if (!self.observations) self.observations = {};
  self.params = params;
  updateP = false;

  data = self.params.props.last_reading;
  props = { lastSample   : 0
          , temperature  : (typeof data.temperature === 'number') ? data.temperature                : undefined
          , humidity     : (typeof data.humidity    === 'number') ? data.humidity                   : undefined
//        , noise        : (typeof data.loudness    === 'number') ? data.loudness                   : undefined
//        , light        : (typeof data.brightness  === 'number') ? data.brightness                 : undefined
          , batteryLevel : (typeof data.battery     === 'number') ? (data.battery * 100).toFixed(2) : undefined
          };

  if (self.params.name !== self.name) {
    self.name = self.params.name;
    updateP = true;
  }

  for (d in data) {
    if ((!data.hasOwnProperty(d)) || (d.indexOf('_updated_at') !== (d.length - 11)) || (typeof data[d] !== 'number')) continue;
    if (data[d] > props.lastSample) props.lastSample = data[d];
  }
  if (props.lastSample === 0) return;
  props.lastSample *= 1000;

  for (prop in props) {
    if ((!props.hasOwnProperty(prop)) || (!props[prop]) || (self.info[prop] === props[prop])) continue;

    self.info[prop] = props[prop];
    updateP = true;
  }

  if (updateP) {
    self.info = props;
    self.changed();
    sensor.update(self.deviceID, props);
    updateP = false;
  }

  data = self.params.props.last_event;
  now = new Date();
  previous = self.status;
  for (d in data) {
    if ((!data.hasOwnProperty(d)) || (d.indexOf('_occurred_at') !== (d.length - 12)) || (typeof data[d] !== 'number')) continue;

    observation = d.slice(0, -12);
    if (observation === 'vibration') observation = 'motion';
    if ((!!self.observations[observation]) && (data[d] <= self.observations[observation])) continue;

    self.observations[observation] = data[d];
    if (firstP) continue;

    self.status = observation;
    self.info.lastSample = now;
    for (eventID in self.events) {
      if ((!self.events.hasOwnProperty(eventID)) && (self.events[eventID].observe === observation)) steward.observed(eventID);
    }
    updateP = true;
  }

  if (!updateP) self.status = 'quiet';

  if (self.status != previous) self.changed(now);
};

Spotter.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if ((perform !== 'set') || (!params.name)) return false;
  if (!self.gateway.wink) return false;

// short-ciruit round-trip time to cloud
  self.name = params.name;
  self.changed();
  self.gateway.wink.setDevice(self.params, { name: params.name }, function(err, params) {
    if (!!err) return self.logger.error('device/' + self.deviceID, { event: 'setDevice', diagnostic: err.message});

    if (!!params) self.update(self, params);
  });

  return steward.performed(taskID);
};

var validate_observe = function(observe, parameter) {/* jshint unused: false */
  var result = { invalid: [], requires: [] };

  if (observe.charAt(0) === '.') return result;

  if (!{ brightness: true, loudness: true, motion: true }[observe]) result.invalid.push('observe');

  return result;
};


exports.start = function() {
  steward.actors.device.sensor.wink = steward.actors.device.sensor.wink ||
      { $info     : { type: '/device/sensor/wink' } };

  steward.actors.device.sensor.wink.spotter =
      { $info     : { type       : '/device/sensor/wink/spotter'
                    , observe    : [ 'brightness', 'loudness', 'motion' ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'quiet', 'bright', 'loud', 'motion' ]
                                   , lastSample   : 'timestamp'
                                   , temperature  : 'celsius'
                                   , humidity     : 'percentage'
//                                 , noise        : 'decibels'
//                                 , light        : 'lux'
                                   , batteryLevel : 'percentage'
                                   }
                    }
      , $validate : { observe    : validate_observe
                    , perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/sensor/wink/spotter'] = Spotter;
};
