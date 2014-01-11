// lighting gateway template -- start with this when you have a controller that manages multiple bulbs
// search for TBD to see what to change

// load the module that knows how to discover/communicate with the lighting gateway
var TBD         = require('TBD')
  , util        = require('util')
  , db          = require('./../../core/database').db
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


// define the prototype that will be instantiated when a controller is discovered
var TBD = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'ready';

  self.info = {};

  self.controller = info.controller;
// TBD: this assumes that the controller has an function to do logging...
  self.controller.logger = utility.logfnx(logger, 'device/' + self.deviceID);
  self.controller.tag = 'device/' + self.deviceID;
  self.controller.removeAllListeners().on('update', function() {
    self.update(self);
  }).on('error', function(err) {
    logger.error('device/' + self.deviceID, { event: 'error', diagnostic: err.message });

    self.status = 'error';
    self.changed();
  });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    var led;

    if (request !== 'perform') return;

    deviceID = actor.split('/')[1];
// TBD: this assumes that the controller doesn't have anything interesting to set...
    if (self.deviceID === deviceID) return devices.perform(self, taskID, perform, parameter);
    for (led in self.bulbs) {
      if (!self.bulbs.hasOwnProperty(led)) continue;

      if (self.bulbs[led].deviceID === deviceID) return self.perform(self, taskID, perform, parameter, led);
    }
  });

  self.update(self);
};
// have the prototype inherit properties from a generic lighting device
util.inherits(TBD, lighting.Device);


// this is invoked whenever the gateway regains connectiivty
TBD.prototype.update = function(self) {
  var d, devices;

  self.status = 'ready';
  self.changed();

  self.bulbs = {};

// TBD: this assumes that the controller will emit an 'update' event whenever it has a state change to the bulbs it knows about
  devices = self.controller.devices;
  for (d in devices) if (devices.hasOwnProperty(d)) self.addchild(self, devices[d]);
  self.changed();
};

/* these properties are expected in a bulb (you may need to change the names):
     { did      : unique-identifier (usually an integer)
     , name     : 'string'
     , state    : 0: off, 1: on
     , color    : [ r, g, b ]
// the following three are for bulbs that may be dimmed
     , level    : current value
     , rangemin : minimum value
     , rangemax : maximum value
     }

 */
TBD.prototype.addchild = function(self, device) {
  var deviceUID, led, whatami;

  led = device.did;

  deviceUID = self.deviceUID + '/bulbs/' + led;
// if multiple bulb types, set the correct deviceType here...
// for each deviceType, you must have a corresponding entry in the start() function
  whatami = '/device/lighting/TBD/led';
  self.bulbs[led] = { whatami  : whatami
                     , type    : whatami
                     , name    : device.name
                     , state   : { on         : device.state === 1
                                 , color      : { model : 'rgb'
                                                , rgb   : { r: device.color.r, g: device.color.g, b: device.color.b }
                                                }
                                 , brightness : { min   : device.rangemin
                                                , level : devices.scaledLevel(device.level, device.rangemin, device.rangemax)
                                                , max   : device.rangemax
                                                }
                                 }
                     , updated : self.updated
                     };

  db.get('SELECT deviceID, deviceType, deviceName FROM devices WHERE deviceUID=$deviceUID',
         { $deviceUID: deviceUID }, function(err, row) {
    if (err) {
      logger.error('device/' + self.deviceID, { event: 'SELECT device.deviceUID for LED ' + led, diagnostic: err.message });
      return;
    }

    if (row !== undefined) {
      self.bulbs[led].deviceID = row.deviceID.toString();
      self.bulbs[led].name = row.deviceName;
      return;
    }

    db.run('INSERT INTO devices(deviceUID, parentID, childID, deviceType, deviceName, created) '
           + 'VALUES($deviceUID, $parentID, $childID, $deviceType, $deviceName, datetime("now"))',
           { $deviceUID: deviceUID, $parentID: self.deviceID, $deviceType: whatami, $deviceName: self.bulbs[led].name,
             $childID: led }, function(err) {
      if (err) {
        logger.error('device/' + self.deviceID,
                     { event: 'INSERT device.deviceUID for LED ' + led, diagnostic: err.message });
        return;
      }

      self.bulbs[led].deviceID = this.lastID.toString();
    });
  });
};


TBD.prototype.children = function() {
  var self = this;

  var children, led;

  children = [];
  for (led in self.bulbs) if (self.bulbs.hasOwnProperty(led)) children.push(childprops(self, led));

  return children;
};

var childprops = function(self, led) {
  var child, props;

  props = self.bulbs[led];
  child = { id        : led
          , discovery : { id: led, source: 'device/' + self.deviceID  }
          , whatami   : props.type
          , whoami    : 'device/' + props.deviceID
          , name      : props.name
          , status    : props.state.on ? 'on' : 'off'
          , info      : { color: props.state.color, brightness: props.state.brightness.level }
          , deviceID  : props.deviceID
          , updated   : props.updated
          };

  child.proplist = devices.Device.prototype.proplist;
  child.setName = devices.Device.prototype.setName;

  child.perform = function(strip, taskID, perform, parameter) { return self.perform(self, taskID, perform, parameter, led); };

  return child;
};

TBD.prototype.perform = function(self, taskID, perform, parameter, led) {
  var color, f, params, props, state;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  props = self.bulbs[led];
  if (perform === 'set') {
    if (!params.name) return false;

    self.controller.setBulbName(led, params.name);

    return steward.performed(taskID);
  }

  state = {};
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    color = params.color;
    if (!!color) {
      switch (color.model) {
        case 'rgb':
// TBD: map to native model
          break;

// TBD: other models, mapped to native model, go here...

        default:
          break;
      }
      state.color = color;
    }

    if ((!!params.brightness) && (!!props.state.brightness.min) && (!!props.state.brightness.max)) {
      if (!lighting.validBrightness(params.brightness)) return false;
      state.brightness = devices.scaledPercentage(params.brightness, props.state.brightness.min,  props.state.brightness.max);
    }

/* TBD: est for all dark here, if so:

     state.on = false;
 */
  }

  logger.notice('device/' + self.deviceID, { perform: state });

  self.controller.setBulb(led, state.on, state.color, state.brightness);

  if (!state.on) self.controller.turnOff(led);
  else {
    f = function() { self.controller.setState(led, state); };

    if (self.state !== 'on') self.controller.turnOn(led, f); else f();
  }

  self.bulbs[led].state.on = state.on;
  self.bulbs[led].state.color = state.color;
  self.bulbs[led].state.brightness.level = state.brightness;
  self.bulbs[led].updated = new Date().getTime();
  self.changed();

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var color
    , params = {}
    , result = { invalid: [], requires: [] };

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'off') return result;

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
    return result;
  }

  if (perform !== 'on') {
    result.invalid.push('perform');
    return result;
  }

  color = params.color;
  if (!!color) {
    switch (color.model) {
        case 'rgb':
          if (!lighting.validRGB(color.rgb)) result.invalid.push('color.rgb');
          break;

// TBD: other color models validated here...

        default:
          result.invalid.push('color.model');
          break;
    }
  }

  if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) result.invalid.push('brightness');

  return result;
};


/* these are properties are expected in a controller (you may need to change the names):
     { mac      : '01:23:45:67:89:ab'
     , name     : 'string'
     , serialNo : serial number
     }
 */
var scan = function () {
  var logger2 = utility.logger('discovery');

// this assumes that after creating a new discovery object, it will emit a 'discover' event whenever it finds a new controller
  new TBD().on('discover', function(controller) {
    controller.on('update', function() {
      var info, serialNo;

      serialNo = controller.mac.split(':').join('');
      info = { source     : 'mdns'
             , controller : controller
             , device     : { url          : null
                            , name         : controller.name
                            , manufacturer : ''
                            , model        : { name        : controller.name
                                             , description : ''
                                             , number      : ''
                                             }
                            , unit         : { serial      : controller.serialNo
                                             , udn         : 'uuid:2f402f80-da50-11e1-9b23-'
                                                               + controller.mac.split(':').join('').toLowerCase()
                                             }
                            }
             , deviceType : steward.actors.device.gateway.TBD.$info.type
           };
      info.url = info.device.url;
      info.deviceType = '/device/gateway/TBD/lighting/';
      info.id = info.device.unit.udn;
      if (!!devices.devices[info.id]) return;

      logger2.info(info.device.name, { url: info.url });
      devices.discover(info);
    }).on('error', function(err) {
      logger2.error(controller.name, { diagnostic: err.message });
    });
  }).on('error', function(err) {
    logger2.error('TBD', { diagnostic: err.message });
  }).logger = logger2;
};


exports.start = function() {
  steward.actors.device.gateway.TBD = steward.actors.device.gateway.TBD ||
      { $info     : { type: '/device/gateway/TBD' } };

  steward.actors.device.gateway.TBD.lighting =
      { $info     : { type       : '/device/gateway/TBD/lighting'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'ready', 'error' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers.TBD = TBD;

  steward.actors.device.lighting.TBD = steward.actors.device.lighting.TBD ||
      { $info     : { type: '/device/lighting/TBD' } };

  steward.actors.device.lighting.TBD.led =
      { $info     : { type       : '/device/lighting/TBD/led'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'on', 'off' ]
                                   , color        : { model: [ { rgb : { r: 'u8',  g: 'u8',  b: 'u8' } }
// TBD: other color models go here, but RGB is mandatory
                                                             ]
                                                    }
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };

/* if multiple bulb types, define additional deviceTypes here, e.g.,

  steward.actors.device.lighting.TBD.downlight = utility.clone(steward.actors.device.lighting.TBD.led);
  steward.actors.device.lighting.TBD.downlight.$info.type = '/device/lighting/TBD/downlight';
 */

  scan();
};
