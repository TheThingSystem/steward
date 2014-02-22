// lighting bulb template -- start with this when each bulb can be managed independently (controller may be present, but hidden)
// search for LIFX to see what to change

// load the module that knows how to discover/communicate with the bulb
var lifx        = require('lifx')
  , util        = require('util')
  , tinycolor   = require('tinycolor2')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;

var lx;

// define the prototype that will be instantiated when the bulb is discovered
// later, we will create a ...perform function, and a ...update function.
var LIFX = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.bulb = info.bulb;
  self.lx = info.lx

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
// have the prototype inherit properties from a generic lighting device
util.inherits(LIFX, lighting.Device);

// the low-level driver calls this function when its state changes.
// possibly somebody else is changing the state of the hardware directly,
// or the hardware has built-in controls, like a light switch.
LIFX.prototype.update = function(self, state) {
    logger.info("LIFX update", state.power, state.hue, state.saturation, state.brightness);
  self.status = state.power ? 'on' : 'off';
  tc = tinycolor({ h: state.hue * 360.0 / 65535.0, s: state.saturation / 655.350, l: state.brightness / 655.350 });
  self.info = { color      : { model: [ { 'rgb': tc.toRgb() }
                                      , { 'hue': { hue: state.kelvin, saturation: state.saturation / 655.350 } }
                                      ]
                             }
              , brightness : state.brightness
              };
  logger.info("LIFX updated", self.info.color, self.info.brightness, self.status);
};


// handle the calls from the steward to change things.
// set: set the internal name of the bulb.
// off: turn the bulb off.
// on: turn the bulb on and set its bulb to the 'color' and 'brightness' parameter.
LIFX.prototype.perform = function(self, taskID, perform, parameter) {
  var color, f, params, state;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!params.name) return false;

    return self.setName(params.name, taskID);
  }

  if (!self.info.color) {
    self.lx.findBulbs();
    return;
  }
  logger.info("LIFX perform",self.info);
  state = { color: self.info.color, brightness: self.info.brightness };
  if (perform === 'off') state.power = 0;
  else if (perform !== 'on') return false;
  else {
    state.power = 65535;

    color = params.color;
    if (!!color) {
      switch (color.model) {
        case 'rgb':
          tc = tinycolor(color.model.rgb);
          break;

// LIFX: other models, mapped to native model, go here...
        case 'hue':
          tc = tinycolor(color.model.hue);

        default:
          break;
      }
      state.color = color;
    }

    if ((!!params.brightness) && (lighting.validBrightness(params.brightness))) state.brightness = params.brightness;

/* LIFX: if a brightness of zero means that the bulb is off, remember that.

     state.on = false;
 */
  }

  logger.info('device/' + self.deviceID, { perform: state });

// LIFX: here is the meat of our driver. We call into the low-level hardware driver to turn the bulb on and off,
// set the brightness, and/or set the color.
  if (!state.on) self.lx.lightsOff(self.bulb);
  else {
    self.lx.lightsOn(self.bulb);
// assuming 16-bits each for hue, saturation, luminance, and whitecolor
      if (state.color.model === 'hue') {
        self.lx.lightsColour(devices.scaledPercentage(state.color.model.hue.h / 360, 0, 0xffff),
                                devices.scaledPercentage(state.color.model.hue.h,       0, 0xffff),
                                devices.scaledPercentage(state.brightness,              0, 0xffff),
                                0, 0, self.bulb);
      } else {
        kelvin = 1000000 / state.color.model.temperature.temperature;
        self.lx.lightsColour(0x0000, 0x0000, devices.scaledPercentage(state.brightness, 0, 0xffff),
                           devices.scaledPercentage(devices.scaledLevel(kelvin, 2000, 6500), 0, 0xffff),
                           0, self.bulb);
      }
  }

// rely on bulb to emit a 'stateChange' event to update internal state

  return steward.performed(taskID);
};

// check the parameters on the perform before we even try to do it.
// LIFX: if you have an RGB bulb, you'll need all of these checks.
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

// LIFX: other color models validated here...
        case 'hue':
          if (!lighting.validHue(color.hue)) result.invalid.push('color.hue');
          if (!lighting.validSaturation(color.saturation)) result.invalid.push('color.saturation');
          if (!params.brightness) result.requires.push('brightness');
          break;

        case 'temperature':
          if (!lighting.validTemperature(color.temperature)) result.invalid.push('color.temperature');
          break;

        default:
          result.invalid.push('color.model');
          break;
    }
  }

  if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) result.invalid.push('brightness');

  return result;
};

exports.start = function() {
  var logger2 = utility.logger('discovery');

  steward.actors.device.lighting.LIFX = steward.actors.device.lighting.LIFX ||
      { $info     : { type: '/device/lighting/LIFX' } };

  steward.actors.device.lighting.LIFX.bulb =
      { $info     : { type       : '/device/lighting/LIFX/bulb'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , color      : { model: [ { rgb         : { r: 'u8', g: 'u8', b: 'u8' } }
                                                           , { hue         : { hue: 'degrees', saturation: 'percentage' } }
                                                           , { temperature : { temperture: 'mireds' } }
                                                           ]
                                                  }
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/lighting/LIFX/bulb'] = LIFX;

// LIFX: when the hardware driver discovers a new bulb, it will call us.
// LIFX: or if the low-level driver needs to be polled, then create a 'scan' function and call it periodically.
  lx = lifx.init().on('bulb', function(bulb) {
        var info;

 info = { source     : 'LIFX'
           , lx         : lx
           , bulb       : bulb
           , device     : { url          : null
                          , name         : bulb.name
                          , manufacturer : "LIFX"
                          , model        : { name        : bulb.name
                                           , description : ''
                                           , number      : ''
                                           }
                          , unit         : { serial      : bulb.lifxAddress.toString('hex')
                                           , udn         : 'LIFX:' + bulb.lifxAddress.toString('hex')
                                           }
                          }
           }; 

// if multiple bulb types, update info.deviceType as appropriate
    info.url = info.device.url;
    info.deviceType = '/device/lighting/LIFX/bulb';
    info.id = info.device.unit.udn;
    if (!!devices.devices[info.id]) return;

    devices.discover(info);
  }).on('bulbstate', function(bulbstate) {
    var dev,  udn;

    udn = 'LIFX:' + bulbstate.bulb.lifxAddress.toString('hex');
    if (!devices.devices[udn]) return;
    dev = devices.devices[udn].device;
    if (!dev) return;
    console.log("bulbstate 2", devices.devices[udn].device, bulbstate);
    dev.update(dev, bulbstate.state);
  }).on('bulbonoff', function(bulbonoff) {
    console.log("bulbonoff", bulbonoff);
    var dev,  udn;

    udn = 'LIFX:' + bulbonoff.bulb.lifxAddress.toString('hex');
    if (!devices.devices[udn]) return;
    dev = devices.devices[udn].device;
    dev.logger(dev);
    //dev.update(dev, { power: bulbonoff.on ? 65535 : 0 }); 
  }).logger = logger2;
};

