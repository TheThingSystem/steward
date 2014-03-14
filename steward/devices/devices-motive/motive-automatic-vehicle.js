// automatic - an auto accessory to make you a smarter driver: http://www.automatic.com

var polyline    = require('polyline-encoded')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , motive      = require('./../device-motive')
  ;


// var logger   = motive.logger;


var Vehicle = exports.device = function(deviceID, deviceUID, info) {
  var param, self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = { locations: [] };
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }

  self.status = 'present';
  self.changed();

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Vehicle, motive.Device);
Vehicle.prototype.perform = devices.perform;


Vehicle.prototype.update = function(self, params, status) {
  var param, updateP;

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
};

Vehicle.prototype.webhook = function(self, event, data) {/* jshint unused: false */
console.log(util.inspect(data, { depth: null }));
  var ignition, updateP;

  updateP = false;

  if ((util.isArray(self.info.location)) && (data.type === 'trip:summary')) return;
  if (!!data.path) updateP = self.addpath(self, polyline.decode(data.path));

  if (!!data.location) {
    if (!util.isArray(self.info.location)) {
      self.info.location = [ 0, 0 ];
      self.info.accuracy = data.location.accuracy_m;
      setInterval(function() { self.reverseGeocode(self); }, 60 * 1000);
      setTimeout(function() { self.reverseGeocode(self); }, 0);
    }
    if ((self.info.location[0] != data.location.lat) || (self.info.location[1] != data.location.lon)) {
      self.info.location[0] = data.location.lat;
      self.info.location[1] = data.location.lon;
      self.info.accuracy = data.location.accuracy_m;
      self.addlocation(self);
      updateP = true;
    }
  }

  if ((!!data.created_at) && ((!self.info.lastSample) || (data.created_at > self.info.lastSample))) {
    self.info.lastSample = data.created_at;
    updateP = true;
  }

  if ((data.type === 'parking:changed') || (data.type === 'ignition:off')) {
    if (self.info.velocity !== 0) {
      self.info.velocity = 0;
      updateP = true;
    }
  }

/*
  if ((data.type === 'ignition:on') || (data.type === 'ignition:off')) {
    ignition = data.type === 'ignition:on' ? 'true' : 'false';

    if (self.info.ignition != ignition) {
      self.info.ignition = ignition;
      updateP = true;
    }
  }
 */

  if (updateP) self.changed();
};

exports.start = function() {
  steward.actors.device.motive.automatic = steward.actors.device.motive.automatic ||
      { $info     : { type: '/device/motive/automatic' } };

  steward.actors.device.motive.automatic.vehicle =
      { $info     : { type       : '/device/motive/automatic/vehicle'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name           : true
                                   , status         : [ 'ready', 'reset', 'waiting' ]
                                   , lastSample     : 'timestamp'

                                   , location       : 'coordinates'
                                   , accuracy       : 'meters'
                                   , physical       : true
                                   , distance       : 'kilometers'
//                                 , ignition       : [ 'true', 'false' ]
/* NB: these really ought to be provided by the Automatic API
                                   , heading        : 'degrees'
                                   , velocity       : 'meters/second'
                                   , odometer       : 'kilometers'
                                   , range          : 'kilometers'
 */
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/motive/automatic/vehicle'] = Vehicle;
};
