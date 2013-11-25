// http://mqttitude.org

var geocoder    = require('geocoder')
  , googlemaps  = require('googlemaps')
  , util        = require('util')
  , winston     = require('winston')
  , db          = require('./../../core/database').db
  , devices     = require('./../../core/device')
  , places      = require('./../../actors/actor-place')
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
  self.points = [];
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

  utility.broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
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
    , result = { invalid: [], requires: [] };

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') result.invalid.push('perform');

  if ((!!params.priority) && (!winston.config.syslog.levels[params.priority])) result.invalid.push('priority');

  return result;
};


Mobile.prototype.update = function(self, params, status) {
  var entry, i, markers, param, updateP;

  updateP = false;
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }
  if (updateP) self.changed();

  entry = self.info.location.slice(0, 2).join(',');
  if (self.points.length === 0) {
    self.points.push(entry);
    return;
  }
  if (entry === self.points[self.points.length - 1]) return;

  self.points.push(entry);
// derived experientially: 28 appears to be the limit
  if (self.points.length > 24) {
    if (!self.timer) self.timer = setTimeout (function() { self.balance(self, 24); }, 0);
    return;
  }

  markers = [];
  for (i = 0; i < self.points.length; i++) markers.push({ location: self.points[i], color: 'red', shadow: 'false' });

  try {
    self.info.staticmap = googlemaps.staticMap(self.points[0], '', '250x250', false, false, 'roadmap', markers,
                                               [ { feature: 'road',   element: 'all', rules: { hue: '0x16161d' } } ]
                                               [ { color: '0x0000ff', weight: '5',    points: self.points        } ]);
    if (self.info.staticmap.indexOf('http://') === 0) self.info.staticmap = 'https' + self.info.staticmap.slice(4);
  } catch(ex) {
    return logger.error('device/' + self.deviceID, { event: 'staticMap', dignostic: ex.message, size: self.points.length });
  }
};

Mobile.prototype.balance = function(self, max) {
  var d, i, location, points, previous, q;

  self.timer = null;
  if (self.points.length <= max) return;

  if (self.points.length > max) self.points.splice (0, self.points.length - max);
  q = Math.round(max / 4);
  self.points.splice(0, q);

  d = [];
  for (i = 1, previous = self.points[0].split(','); i < self.points.length - 1; i++, previous = location) {
    location = self.points[i].split(',');
    d.push([ i, self.points[i], getDistanceFromLatLonInKm(location[0], location[1], previous[0], previous[1]) ]);
  }
  d.sort(function(a,b) { return (b[2] - a[2]); });
  d.splice(0, q);

  points = [];
  d.sort(function(a,b) { return (b[0] - a[0]); });
  for (i = 0; i < d.length; i++) points.push(d[i][1]);
  points.push(self.points[self.points.length - 1]);

  self.points = points;
};

Mobile.prototype.detail = function(self, params) {/* jshint unused: false */};

Mobile.prototype.reverseGeocode = function(self) {
  var key, location;

  if (self.points.length < 1) return;

  location = self.points[self.points.length - 1].split(',');
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

// from http://stackoverflow.com/questions/27928/how-do-i-calculate-distance-between-two-latitude-longitude-points

var getDistanceFromLatLonInKm = function (lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
};

var deg2rad = function(deg) {
  return deg * (Math.PI/180);
};


exports.start = function() {
  steward.actors.device.presence.mobile = steward.actors.device.presence.mobile ||
      { $info     : { type: '/device/presence/mobile' } };

  steward.actors.device.presence.mobile.mqtt =
      { $info     : { type       : '/device/presence/mobile/mqtt'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name      : true
                                   , status    : [ 'present', 'recent', 'absent' ]
                                   , location  : 'coordinates'
                                   , accuracy  : 'meters'
                                   , physical  : true
                                   , staticmap : 'url'
                                   , priority : utility.keys(winston.config.syslog.levels)
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/presence/mobile/mqtt'] = Mobile;

  steward.actors.device.presence.mobile.mqttitude = utility.clone(steward.actors.device.presence.mobile.mqtt);
  steward.actors.device.presence.mobile.mqttitude.$info.type = '/device/presence/mobile/mqttitude';
  devices.makers['/device/presence/mobile/mqttitude'] = Mobile;
};
