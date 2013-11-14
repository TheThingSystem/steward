// http://mqttitude.org

var geocoder    = require('geocoder')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , presence    = require('./../device-presence')
  ;


var logger   = presence.logger;

var geocache = {};


var Mobile = exports.Device = function(deviceID, deviceUID, info) {
  var param, self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = {};
  if (!!info.params.status) {
    self.status = info.params.status;
    delete(info.params.status);
  } else self.status = 'present';
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  self.update(self, info.params);

  self.events = {};

  utility.broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      return;
    }
    if (request === 'perform') return devices.perform(self, eventID, observe, parameter);
  });
};
util.inherits(Mobile, presence.Device);


Mobile.prototype.update = function(self, params, status) {
  var key, location, param, updateP;

  updateP = false;
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  location = self.info.location;
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }

  if ((!location) || array_cmp (self.info.location, location)) {
    key = parseFloat(self.info.location[0]).toFixed(3) + ',' + parseFloat(self.info.location[1]).toFixed(3);
    self.info.physical = geocache[key] || '';
    if (!self.info.physical) {
      location = self.info.location;
      geocoder.reverseGeocode(location[0], location[1], function(err, result) {
        if (!!err) return logger.error('device/' + self.deviceID, { event      : 'reverseGeocode'
                                                                  , location   : location
                                                                  , diagnostic : err.message });
        if (result.status !== 'OK') return logger.warning('device/' + self.deviceID, { event      : 'reverseGeocode'
                                                                                     , location   : location
                                                                                     , diagnostic : result.status });
        if (result.results.length < 1) return;
        geocache[key] = result.results[0].formatted_address;
        self.info.physical = result.results[0].formatted_address;
        self.changed();
      });
    }
  }

  if (updateP) self.changed();
};

Mobile.prototype.detail = function(self, params) {/* jshint unused: false */};

var array_cmp = function(a, b) {
  var i;

  if (!a) return (!(!!b));
  if (!util.isArray(a) || !util.isArray(b) || (a.length != b.length)) return false;
  for (i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};


exports.start = function() {
  steward.actors.device.presence.mobile = steward.actors.device.presence.mobile ||
      { $info     : { type: '/device/presence/mobile' } };

  steward.actors.device.presence.mobile.mqtt =
      { $info     : { type       : '/device/presence/mobile/mqtt'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name     : true
                                   , status   : [ 'present', 'recent', 'absent' ]
                                   , location : 'coordinates'
                                   , accuracy : 'meters'
                                   , physical : true
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/presence/mobile/mqtt'] = Mobile;

  steward.actors.device.presence.mobile.mqttitude = utility.clone(steward.actors.device.presence.mobile.mqtt);
  steward.actors.device.presence.mobile.mqttitude.$info.type = '/device/presence/mobile/mqttitude';
  devices.makers['/device/presence/mobile/mqttitude'] = Mobile;
};
