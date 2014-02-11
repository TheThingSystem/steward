// http://owntracks.org

var geocoder    = require('geocoder')
  , util        = require('util')
  , winston     = require('winston')
  , db          = require('./../../core/database').db
  , devices     = require('./../../core/device')
  , places      = require('./../../actors/actor-place')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
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
  self.info.locations = [];
  self.timer = null;
  self.update(self, info.params);

  self.events = {};

  db.get('SELECT value FROM deviceProps WHERE deviceID=$deviceID AND key=$key',
               { $deviceID: self.deviceID, $key: 'info' }, function(err, row) {
    var params;

    if (err) {
      logger.error('device/' + self.deviceID, { event: 'SELECT info for ' + self.deviceID, diagnostic: err.message });
      return;
    }

    params = {};
    if (!!row) try { params = JSON.parse(row.value); } catch(ex) {}
    self.priority = winston.config.syslog.levels[params.priority || 'notice'] || winston.config.syslog.levels.notice;
    self.info.priority = utility.value2key(winston.config.syslog.levels, self.priority);
    self.changed();
  });

  broker.subscribe('actors', function(request, eventID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, perform, parameter);
  });

  setInterval(function() { self.reverseGeocode(self); }, 60 * 1000);
};
util.inherits(Mobile, presence.Device);


Mobile.prototype.perform = function(self, taskID, perform, parameter) {
  var param, params, updateP;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return;

  if (!!params.name) {
    self.setName(params.name);
    delete(params.name);
  }

  updateP = false;
  for (param in params) {
   if ((!params.hasOwnProperty(param)) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }
  if (updateP) self.setInfo();

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform !== 'set') result.invalid.push('perform');

  if ((!!params.priority) && (!winston.config.syslog.levels[params.priority])) result.invalid.push('priority');

  return result;
};


Mobile.prototype.update = function(self, params, status) {
  var entry, param, updateP;

  updateP = false;
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    if (param === 'location') {
      if (!places.place1.info.location) delete(self.info.distance);
      else self.info.distance = Math.round(utility.getDistanceFromLatLonInKm(self.info.location[0], self.info.location[1],
                                                                             places.place1.info.location[0],
                                                                             places.place1.info.location[1]));
    }
    updateP = true;
  }
  if (updateP) self.changed();

  if (!self.info.location) return;
  entry = self.info.location.slice(0, 2).join(',');
  if (self.info.locations.length === 0) {
    self.info.locations.push(entry);
    return;
  }
  if (entry === self.info.locations[self.info.locations.length - 1]) return;

  self.info.locations.push(entry);
// derived experientially: 28 appears to be the limit
  if ((self.info.locations.length > 24) && (!self.timer)) self.timer = setTimeout (function() { self.balance(self, 24); }, 0);
};

Mobile.prototype.balance = function(self, max) {
  var d, i, location, points, previous, q;

  self.timer = null;
  if (self.info.locations.length <= max) return;

  if (self.info.locations.length > max) self.info.locations.splice (0, self.info.locations.length - max);
  q = Math.round(max / 4);
  self.info.locations.splice(0, q);

  d = [];
  for (i = 1, previous = self.info.locations[0].split(','); i < self.info.locations.length - 1; i++, previous = location) {
    location = self.info.locations[i].split(',');
    d.push([ i
           , self.info.locations[i],
           , utility.getDistanceFromLatLonInKm(location[0], location[1], previous[0], previous[1])
           ]);
  }
  d.sort(function(a,b) { return (b[2] - a[2]); });
  d.splice(0, q);

  points = [];
  d.sort(function(a,b) { return (b[0] - a[0]); });
  for (i = 0; i < d.length; i++) points.push(d[i][1]);
  points.push(self.info.locations[self.info.locations.length - 1]);

  self.info.locations = points;
};

Mobile.prototype.detail = function(self, params) {/* jshint unused: false */};

Mobile.prototype.reverseGeocode = function(self) {
  var key, location;

  if (self.info.locations.length < 1) return;

  location = self.info.locations[self.info.locations.length - 1].split(',');
  key = parseFloat(location[0]).toFixed(3) + ',' + parseFloat(location[1]).toFixed(3);

  if ((!!places.place1.info.location)
          && (location[0] === places.place1.info.location[0])
          && (location[1] === places.place1.info.location[1])) {
    geocache[key] = places.place1.info.physical;
  }
  if (!!geocache[key]) {
    if (self.info.physical !== geocache[key]) {
      self.info.physical = geocache[key];
      self.changed();
    }

    return;
  }

  geocoder.reverseGeocode(location[0], location[1], function(err, result) {
    if (!!err) return logger.error('device/' + self.deviceID, { event      : 'reverseGeocode'
                                                              , location   : location
                                                              , diagnostic : err.message });
    if (result.status !== 'OK') return logger.warning('device/' + self.deviceID, { event      : 'reverseGeocode'
                                                                                 , location   : location
                                                                                 , diagnostic : result.status });
    if (result.results.length < 1) return;

    geocache[key] = result.results[0].formatted_address;
    self.info.physical = geocache[key];
    self.changed();
  });
};


exports.start = function() {
  steward.actors.device.presence.mqtt = steward.actors.device.presence.mqtt ||
      { $info     : { type: '/device/presence/mqtt' } };

  steward.actors.device.presence.mqtt.mobile =
      { $info     : { type       : '/device/presence/mqtt/mobile'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name      : true
                                   , status    : [ 'present', 'recent', 'absent' ]
                                   , location  : 'coordinates'
                                   , accuracy  : 'meters'
                                   , physical  : true
                                   , distance  : 'kilometers'  // technically, it should be client-derived
                                   , priority : utility.keys(winston.config.syslog.levels)
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/presence/mqtt/mobile'] = Mobile;

  steward.actors.device.presence.mqttitude = utility.clone(steward.actors.device.presence.mqtt);
  steward.actors.device.presence.mqttitude.$info.type = '/device/presence/mqttitude';
  steward.actors.device.presence.mqttitude.mobile = utility.clone(steward.actors.device.presence.mqtt.mobile);
  steward.actors.device.presence.mqttitude.mobile.$info.type = '/device/presence/mqttitude/mobile';
  devices.makers['/device/presence/mqttitude/mobile'] = Mobile;

  steward.actors.device.presence.owntracks = utility.clone(steward.actors.device.presence.mqtt);
  steward.actors.device.presence.owntracks.$info.type = '/device/presence/owntracks';
  steward.actors.device.presence.owntracks.mobile = utility.clone(steward.actors.device.presence.mqtt.mobile);
  steward.actors.device.presence.owntracks.mobile.$info.type = '/device/presence/owntracks/mobile';
  devices.makers['/device/presence/owntracks/mobile'] = Mobile;
};
