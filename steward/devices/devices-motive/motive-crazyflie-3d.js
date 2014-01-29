// +++ under development
// The Crazyflie Nano Quadcopter -- http://www.bitcraze.se/crazyflie/

exports.start = function() {};
if (true) return;

var aerogel     = require('aerogel')
  , underscore  = require('underscore')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , motive      = require('./../device-motive')
  ;


// var logger   = motive.logger;
var logger2  = utility.logger('discovery');

var driver;

var QuadCopter = exports.device = function(deviceID, deviceUID, info) {
  var self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.thrust = { min: 10001, max: 60000 };

  self.info = { thrust: 0 };

  self.status = 'waiting';
  self.changed();

  self.copter = new aerogel.Copter(driver);
  self.copter.on('stabilizer', function(data) {
    var stabilizer, thrust, updateP;

    updateP = false;
    thrust = devices.scaledLevel(Math.abs(data.thrust), self.thrust.min, self.thrust.max);
    if (self.info.thrust !== thrust) {
      self.info.thrust = thrust;
      updateP = true;
    }

    delete(data.thrust);
    stabilizer = f2(data);
    if (!underscore.isEqual(self.info.stabilizer, stabilizer)) {
      self.info.stabilizer = stabilizer;
      updateP = true;
    }

    if (updateP) self.changed();
  }).on('accelerometer', function(data) {
    var accelerometer = f2(data);

    if (!underscore.isEqual(self.info.acceleration, accelerometer)) {
      self.info.acceleration = accelerometer;
      self.changed();
    }
  }).on('gyroscope', function(data) {
    var gyroscope = f2(data);

    if (!underscore.isEqual(self.info.orientation, gyroscope)) {
      self.info.orientation = gyroscope;
      self.changed();
    }
  });
  self.copter.connect(info.radio).then(function() { self.status = 'ready'; self.changed(); }).done();

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      if ((observe === 'cliff') || (observe === 'obstacle') || (observe === 'wall')) {
        self.events[eventID] = { observe: observe };
      }
      return;
    }
    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });
};
util.inherits(QuadCopter, motive.Device);

var f2 = function(data) {
  var prop, props;

  props = {};
  for (prop in data) if (data.hasOwnProperty(prop)) props[prop] = data[prop].toFixed(2);

  return props;
};


QuadCopter.prototype.perform = function(self, taskID, perform, parameter) {
  var f, g, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  g = function(dof) {
        var degrees, duration;

        degrees = parseFloat(params.degrees);
        if (isNaN(degrees) || (degrees < -180) || (degrees > 180)) return false;
        duration = parseInt(params.duration, 10);
        if (isNaN(duration) || (duration < 0) || (duration > 1000)) duration = 250;

        self.copter[dof](degrees);
        self.status = 'busy';
        setTimeout(function() { self.copter[dof](0); self.status = 'ready'; }, duration);

        return true;
      };

  f = { set     : function() {
                    return self.setName(params.name);
                  }

      , takeoff : function() {
                    self.copter.takeoff().then(function() {
                      self.copter.hover();
                      self.copter.setPitch(0);
                      self.copter.setRoll(0);
                      self.info.thrust = 40;
                      self.copter.setThrust(devices.scaledPercentage(self.info.thrust, self.thrust.min, self.thrust.max));

                      self.status = 'hovering';
                      self.changed();
                    });

                    self.changed();
                    return true;
                  }

      , hover   : function() {
                    self.copter.hover();

                    self.status = 'hovering';
                    self.changed();
                    return true;
                  }

      , land    : function() {
                    self.copter.land().then(function() {
                      self.status = 'ready';
                      self.changed();
                    });

                    self.status = 'landing';
                    self.changed();
                    return true;
                  }

      , halt    : function() {
                    self.copter.land().then(function() {
                      self.copter.shutdown();

                      self.status = 'down';
                      self.changed();
                    });

                    self.status = 'landing';
                    self.changed();
                    return true;
                  }

      , pitch   : function() {
                    return g('setPitch');
                  }

      , roll    : function() {
                    return g('setRoll');
                  }

      , yaw     : function() {
                    return g('setYaw');
                  }

      , thrust  : function() {
                    var thrust;

                    if (!params.value) return false;
                    thrust = parseInt(params.value, 10);
                    if ((thrust < 1) || (thrust > 100)) return false;

                    self.info.thrust = thrust;
                    self.copter.setThrust(devices.scaledPercentage(self.info.thrust, self.thrust.min, self.thrust.max));
                    self.changed();
                  }
     }[perform];
  if (!f) return false;

  return (f() && steward.performed(taskID));
};

exports.validThurst  = function(thrust)  { return ((0 <= thrust) && (thrust <= 100)); };

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  var g = function(dof) {
            var degrees;

            if (!!params.degrees) {
              degrees = parseFloat(params.degrees);
              if (isNaN(degrees) || (degrees < -180) || (degrees > 180)) result.invalid.push(dof + '.degrees');
            } else result.requires.push(dof + '.degrees');

          };

  var f = { set     : function() { if (!params.name) result.requires('name'); }

          , takeoff : function() { }
          , hover   : function() { }
          , land    : function() { }
          , halt    : function() { }

          , pitch   : function() { g('pitch'); }
          , roll    : function() { g('roll'); }
          , yaw     : function() { g('yaw'); }

          , thrust  : function() {
                        var thrust;

                        if (!!params.value) {
                          thrust = parseInt(params.value, 10);
                          if ((thrust < 1) || (thrust > 100)) result.invalid.push('thrust.value');
                        } else result.requires.push('thrust.value');
                      }
         }[perform];
  if (f) f(); else result.invalid.push('perform');

  return result;
};


var uris = {};

var scan = function() {
  driver.findCopters().then(function(copters) {
    var i, info, uri;

    for (i = 0; i < copters.length; i++) {
      uri = copters[i];
      if (!!uris[uri]) continue;
      uris[uri] = true;

      info = { source: 'aerogel', radio: uri };
      info.device = { url          : null
                    , name         : ''
                    , manufacturer : 'Bitcraze'
                    , model        : { name        : 'Crazyflie'
                                     , description : 'Nano Quadcopter'
                                     , number      : ''
                                     }
                    , unit         : { serialNo    : uri
                                     , udn         : 'crazyradio:' + uri
                                     }
                    };
      info.url = info.device.url;
      info.deviceType = '/device/motive/crazyflie/3d';
      info.id = info.device.unit.udn;

      if (!!devices.devices[info.id]) return;

      logger2.info('crazyflie-3d', { url: info.url });
      devices.discover(info);
    }

    setTimeout(scan, 30 * 1000);
  }).done();
};


exports.start = function() {
  steward.actors.device.motive.crazyflie = steward.actors.device.motive.crazyflie ||
      { $info     : { type: '/device/motive/crazyflie' } };

  steward.actors.device.motive.crazyflie['3d'] =
      { $info     : { type       : '/device/motive/crazyflie/3d'
                    , observe    : [ ]
                    , perform    : [ 'takeoff'
                                   , 'hover'
                                   , 'land'
                                   , 'halt'
                                   , 'pitch'      // degrees: -180(down)..+180(up)           duration: milli-seconds
                                   , 'roll'       // degrees: +180(left)..-180(right)        duration: milli-seconds
                                   , 'yaw'        // degrees/second: +180(left)..-180(right) duration: milli-seconds
                                   , 'thrust'     // value: 0..100
                                   ]
                    , properties : { name          : true
                                   , status        : [ 'waiting', 'busy', 'ready', 'hovering', 'landing', 'down' ]
                                   , stabilizer    : { roll: 'degrees',      pitch: 'degrees',     yaw: 'degrees/second' }
                                   , acceleration  : { x: 'meters/second^2', y: 'meters/second^2', z: 'meters/second^2'  }
                                   , orientation   : { x: 'degrees/second',  y: 'degrees/second',  z: 'degrees/second'   }
                                   , thrust        : 'percentage'
                                   , batteryLevel  : 'percentage'
                                  }
                    }
      , $validate : { perform: validate_perform }
      };
  devices.makers['/device/motive/crazyflie/3d'] = QuadCopter;

  driver = new aerogel.CrazyDriver();
  scan();
};
