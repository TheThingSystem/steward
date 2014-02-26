var geocoder    = require('geocoder')
  , util        = require('util')
  , devices     = require('./../core/device')
  , places      = require('./../actors/actor-place')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('motive');


exports.start = function() {
  steward.actors.device.motive = { $info: { type: '/device/motive' }};

  utility.acquire(logger, __dirname + '/devices-motive', /^motive-.*\.js$/, 7, -3, ' driver');
};


var Motive = exports.Device = function() {
  var self = this;

  self.whatami = '/device/motive';
};
util.inherits(Motive, devices.Device);


var geocache = {};

Motive.prototype.reverseGeocode = function(self) {
  var key, location;

  if (!util.isArray(self.info.location)) return;

  location = self.info.location;
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
