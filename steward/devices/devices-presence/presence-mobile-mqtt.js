// http://mqttitude.org

var geocoder    = require('geocoder')
  , googlemaps  = require('googlemaps')
  , util        = require('util')
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
  var i, key, location, markers, param, updateP;

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
    if ((!!places.place1.info.location)
            && (self.info.location[0] === places.place1.info.location[0])
            && (self.info.location[1] === places.place1.info.location[1])) {
      geocache[key] = places.place1.info.physical;
    }
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

// TBD: should just report the points and let the client do the needful; but for now, we'll just cook up a static map
    if (self.points.length > 0) {
      location = self.points[self.points.length - 1].split(',');
      i = getDistanceFromLatLonInKm(self.info.location[0], self.info.location[1], location[0], location[1]);
      if (i >= 0.4) {
        self.points.push(self.info.location.slice(0, 2).join(','));
        if (self.points.length > 50) self.points.splice(0, 50);
        markers = [];
        for (i = 0; i < self.points.length; i++) markers.push({ location: self.points[i], color: 'red', shadow: 'false' });

        self.info.staticmap = googlemaps.staticMap(self.points[0], '', '250x250', false, false, 'roadmap', markers,
           [ { feature: 'road',   element: 'all', rules: { hue: '0x16161d' } } ]
           [ { color: '0x0000ff', weight: '5',    points: self.points        } ]);
        if (self.info.staticmap.indexOf('http://') === 0) self.info.staticmap = 'https' + self.info.staticmap.slice(4);
      }
    }
    else self.points.push(self.info.location.slice(0, 2).join(','));
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
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/presence/mobile/mqtt'] = Mobile;

  steward.actors.device.presence.mobile.mqttitude = utility.clone(steward.actors.device.presence.mobile.mqtt);
  steward.actors.device.presence.mobile.mqttitude.$info.type = '/device/presence/mobile/mqttitude';
  devices.makers['/device/presence/mobile/mqttitude'] = Mobile;
};
