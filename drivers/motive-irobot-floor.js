// +++ under development
// iRobot series of robots for the floor

exports.start = function() {};
if (true) return;

var irobot      = require('irobot')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , lighting    = require('./../device-lighting')
  , motive      = require('./../device-motive')
  ;


// var logger   = motive.logger;
var logger2  = utility.logger('discovery');

var Floor = exports.device = function(deviceID, deviceUID, info) {
  var self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.robot = info.robot;
  self.events = {};

  self.info = {};

  self.status = 'waiting';

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

  self.robot.on('ready', function() {
    self.status = 'idle';
    self.info.lastSample = new Date().getTime();
console.log('READY');
setTimeout(function() { self.robot.demo(irobot.demos.SpotCover); }, 1000);
  }).on('sensordata', function (data) {
    var angle, percent, updateP;

    console.log('SENSOR DATA', JSON.stringify(data));
    updateP = false;

    if (!!data.state) {
// need to set velocity

      angle = parseInt(data.date.angle);
      if (!isNaN(angle) && (self.info.heading !== angle)) {
        self.info.heading = angle;
        updateP = true;
      }
    }

    if ((!!data.battery) && (!!data.battery.capacity) && (!!data.battery.capacity.percent)) {
      percent = data.batter.capacity.percent;

      if (self.info.batteryLevel !== percent) {
        self.info.batteryLevel = percent;
        updateP = true;
      }
    }

   if ((!!data.cliff_sensors)
           && ((data.cliff_sensors.left.detecting) || (data.cliff_sensors.front_left.detecting)
                   || (data.cliff_sensors.right.detecting) || (data.cliff_sensors.front_right.detecting))) {
     self.observe(self, 'cliff');
   }
   if ((!!data.bumpers) && (data.bumpers.both.activated)) self.observe(self, 'obstacle');
   if (((!!data.wall_sensor) && (data.wall_sensor.detecting))
           || ((!!data.virtual_wall_sensor) && (data.virtual_wall_sensor.detecting))) self.observe(self, 'wall');

   if (updateP) self.changed();
  })
.on('bump', function (e) { console.log('BUMP', e); })
.on('button', function (e) { console.log('BUTTON', e); })
.on('cliff', function (e) { console.log('CLIFF', e); })
.on('ir', function (e) { console.log('IR', e); })
.on('mode', function (e) { console.log('MODE', e); })
.on('overcurrent', function (e) { console.log('OVERCURRENT', e); })
.on('virtualwall', function (e) { console.log('VIRTUALWALL', e); })
.on('wall', function (e) { console.log('WALL', e); })
.on('wheeldrop', function (e) { console.log('WHEELDROP', e); })
.on('change', function (e) { console.log('CHANGE', e); });

};
util.inherits(Floor, motive.Device);


Floor.prototype.observe = function(self, observation) {
  var eventID;

  for (eventID in self.events) {
    if ((!self.events.hasOwnProperty(eventID)) && (self.events[eventID].observe === observation)) steward.observed(eventID);
  }
};

var validate_observe = function(observe, parameter) {/* jshint unused: false */
  var result = { invalid: [], requires: [] };

  if (observe.charAt(0) === '.') return result;

  if ((observe !== 'cliff') && (observe !== 'obstacle') || (observe !== 'wall')) result.invalid.push('observe');

  return result;
};


Floor.prototype.perform = function(self, taskID, perform, parameter) {
  var f, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  f = { set    : function() { return self.setName(params.name);                  }
      , wake   : function() { return self.wake();                                }

      , halt   : function() { return self.robot.halt();                          }
      , cover  : function() { return self.robot.demo(irobot.demos.Cover);        }
      , spot   : function() { return self.robot.demo(irobot.demos.SpotCover);    }
      , dock   : function() { return self.robot.demo(irobot.demos.CoverAndDock); }

      , move   : function() {
                   var h, v;

                   if (!!params.velocity) {
                     v = parseFloat(params.velocity);
                     if (isNaN(v)) return false;
                   } else v = 0;

                   if (!!params.heading) {
                     h = parseFloat(params.heading);
                     if (isNaN(h) || (h < -180) || (h > 180)) return false;
                   } else h = 0;

                   if ((v === 0) && (h === 0)) return self.robot.drive(v, h);

                   if (v === 0) return self.robot.drive(v, h > 0 ? -1 : 1);

                   // meters/second to millimeters/second
                   v *= 1000;
                   if (h === 0) return self.robot.drive(v, 0);

                   // map from [-180, 180] to [-2000, 2000]
                   self.robot.drive(v, h * 100 / 9);
               }

      , motors  : function() {
                   var i, drivers, motors;

                   var g = function(x) {
                     var pct;

                     x = parseInt(x, 10);

                     if (isNaN(pct) || (pct < 0)) pct = 0; else if (pct > 100) pct = 100;
                     return devices.scaledPercentage(pct, 0, 128);
                   };

                   if ((!params.drivers) || (!util.isArray(params.drivers))) return false;
                   drivers = params.drivers;

                   if (!!self.robot.commands.LowSideDrivers)
                     return self.robot._sendCommand(irobot.commands.LowSideDrivers, g(drivers[2]), g(drivers[1]),
                                                    g(drivers[0]));
                   motors = 0;
                   for (i = 0; i < 3; i++) if (g(drivers[i]) > 0) motors |= (1 << i);
                   return self.robot.motors(motors);
                 }

      , led    : function() {
                   var intensity, color;

                   if (!!params.color) {
                     if ((!params.color.model) || (!lighting.validRGB(params.color.rgb))) return false;

                     // map from [-255, 255] to [0.0, 1.0]
                     color = ((params.color.rgb.r - params.color.rgb.g) / 510) + 0.5;
                   } else color = 0;

                   if (!!params.brightness) {
                     if (!lighting.validBrightness(params.brightness)) return false;
                     intensity = params.brightness / 100;
                   } else intensity = 1;

console.log('setPowerLed(' + intensity + ' , ' + color + ')');
                   return self.robot.setPowerLED(intensity, color);
                 }
     }[perform];
  if (!f) return false;

  return (f() && steward.performed(taskID));
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  var f = { set    : function() { if (!params.name) result.requires('name'); }
          , wake   : function() { }

          , halt   : function() { }
          , cover  : function() { }
          , spot   : function() { }
          , dock   : function() { }

          , move   : function() {
                       var h, v;

                       if (!!params.velocity) {
                         v = parseFloat(params.velocity);
                         if (isNaN(v)) result.invalid('velocity');
                       }

                       if (!!params.heading) {
                         h = parseFloat(params.heading);
                         if (isNaN(h) || (h < -180) || (h > 180)) result.invalid('heading');
                       }
                     }

          , motors : function() {
                       var drivers, i, pct;

                            if (!params.drivers) result.requires('drivers');
                       else if (!util.isArray(params.drivers)) result.invalid('drivers');
                       else {
                         drivers = params.drivers;

                         for (i = 0; i< drivers.length; i++) {
                           pct = parseInt(drivers[i], 10);
                           if (isNaN(pct) || (pct < 0) || (pct > 100)) result.invalid('drivers');
                         }
                       }
                     }

          , led    : function() {
                       if (!!params.color) {
                              if (!params.color.model) result.requires('color.model');
                         else if ((params.color.model !== 'rgb') || (!lighting.validRGB(params.color.rgb))) {
                           result.invalid('color.model');
                         }
                       }
                       if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) {
                         result.invalid('brightness');
                       }
                     }
         }[perform];
  if (f) f(); else result.invalid.push('perform');

  return result;
};


// called by portscanner

var pair = function(socket, ipaddr, portno, macaddr, tag) {
  irobot.roowifi.RooWifi({ socket: socket, ipaddr: ipaddr }, function(err, options) {
    var info, serialNo;

    if (!!err) return logger2.error(tag, { event: 'roowifi', diagnostic: err.message });

    options.debug = true;

    serialNo = macaddr.split(':').join('');

    info = { source: 'portscan', portscan: { ipaddr: ipaddr, portno: portno }, robot: new irobot.Robot('tcp', options) };
    info.device = { url          : 'http://' + ipaddr + ':' + portno
                  , name         : 'Roomba'
                  , manufacturer : 'iRobot'
                  , model        : { name        : 'RooWifi'
                                   , description : ''
                                   , number      : ''
                                   }
                  , unit         : { serialNo    : serialNo
                                   , udn         : 'uuid:2f402f80-da50-11e1-9b23-' + serialNo
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = '/device/motive/irobot/floor';
    info.id = info.device.unit.udn;

    if (!!devices.devices[info.id]) return;

    logger2.info(tag, { url: info.url });
    devices.discover(info);
  });
};

exports.start = function() {
if (true) return;
  steward.actors.device.motive.irobot = steward.actors.device.motive.irobot ||
      { $info     : { type: '/device/motive/irobot' } };

  steward.actors.device.motive.irobot.floor =
      { $info     : { type       : '/device/motive/irobot/floor'
                    , observe    : [ 'cliff', 'obstacle', 'wall' ]
                    , perform    : [ 'halt'
                                   , 'cover'
                                   , 'spot'
                                   , 'dock'
                                   , 'move'    // relativeHeading, velocity
                                   , 'motors'  // array
                                   , 'led'     // color: { model }, brightness: percentage
                                   , 'wake'
                                   ]
                    , properties : { name           : true
                                   , status         : [ 'waiting', 'idle', 'moving', 'charging' ]
                                   , lastSample     : 'timestamp'
                                   , heading        : 'degrees'
                                   , velocity       : 'meters/second'
                                   , batteryLevel   : 'percentage'
                                   }
                    }
      , $validate : { observe    : validate_observe
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/motive/irobot/floor'] = Floor;

  require('./../../discovery/discovery-portscan').pairing([ { prefix: '00:1e:c0', portno: 9001 } ], pair);
};
