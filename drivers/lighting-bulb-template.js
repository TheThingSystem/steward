// lighting bulb template -- start with this when each bulb can be managed independently (controller may be present, but hidden)
// search for TBD to see what to change

// load the module that knows how to discover/communicate with the bulb
var TBD         = require('TBD')
  , tinycolor   = require('tinycolor2')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;

// define the prototype that will be instantiated when the bulb is discovered
// later, we will create a ...perform function, and a ...update function.
var TBD = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.bulb = info.bulb;
// TBD: invoked by the lower-level bulb driver whenever the bulb changes state. You probably
// have to set the name of the event to whatever the bulb driver emits when its state changes.
  self.bulb.on('stateChange', function(state) { self.update(self, state); });
  self.update(self, self.bulb.state);
  self.changed();

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
// have the prototype inherit properties from a generic lighting device
util.inherits(TBD, lighting.Device);

// the low-level driver calls this function when its state changes.
// possibly somebody else is changing the state of the hardware directly,
// or the hardware has built-in controls, like a light switch.
TBD.prototype.update = function(self, state) {
  /* TBD: update self.state and self.info accordingly */
  self.status = state ? 'on' : 'off';
  self.info = { color      : { model: 'rgb', rgb: { r: 0, g: 0, b: 0 } }
              , brightness : 0
              };
 
};


// handle the calls from the steward to change things.
// set: set the internal name of the bulb.
// off: turn the bulb off.
// on: turn the bulb on and set its bulb to the 'color' and 'brightness' parameter.
TBD.prototype.perform = function(self, taskID, perform, parameter) {
  var color, f, hsl, kelvin, params, state;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!params.name) return false;

    return self.setName(params.name, taskID);
  }

  state = { color: self.info.color, brightness: self.info.brightness };
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    color = params.color;
    if (!!color) {
      if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) return false;
      state.brightness = params.brightness || self.brightness;

      switch (color.model) {
        case 'rgb':
// TBD: map to native model (we'll assume either hue or temperature)
          if ((color.rgb.r === 255) && (color.rgb.g === 255) && (color.rgb.b === 255)) {
            state.color = { model: 'temperature', temperature: color.temperature };
          } else {
            hsl = tinycolor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b}).toHsl();
            state.color = { model: 'hue', hue: { hue: hsl.h, saturation: hsl.s * 100 } };
            state.brightness = hsl.l * 100;
          }
          break;

// TBD: other models, mapped to native model, go here...
        case 'hue':
        case 'temperature':
          break;

        default:
          return false;
      }
      state.color = color;
    }

    if (state.brightness === 0) state.on = false;
  }

  logger.info('device/' + self.deviceID, { perform: state });

// TBD: here is the meat of our driver. We call into the low-level hardware driver to turn the bulb on and off,
// set the brightness, and/or set the color.
  if (!state.on) self.bulb.turnOff();
  else {
    f = function() { self.bulb.setState(state); };

/*   
    f = function() {
// assuming 16-bits each for hue, saturation, luminance, and whitecolor
      if (state.color.model === 'hue') {
        self.bulb.setState(led, devices.scaledPercentage(state.color.model.hue.h / 360, 0, 0xffff),
                                devices.scaledPercentage(state.color.model.hue.h,       0, 0xffff),
                                devices.scaledPercentage(state.brightness,              0, 0xffff),
                                0);
      } else {
        kelvin = 1000000 / state.color.model.temperature.temperature;
        self.bulb.setState(led, 0x0000, 0x0000, devices.scaledPercentage(state.brightness, 0, 0xffff),
                           devices.scaledPercentage(devices.scaledLevel(kelvin, 2000, 6500), 0, 0xffff));
      }
    };
 */

    if (self.state !== 'on') self.bulb.turnOn(f); else f();
  }

// rely on bulb to emit a 'stateChange' event to update internal state

  return steward.performed(taskID);
};

// check the parameters on the perform before we even try to do it.
// TBD: if you have an RGB bulb, you'll need all of these checks.
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

  steward.actors.device.lighting.TBD = steward.actors.device.lighting.TBD ||
      { $info     : { type: '/device/lighting/TBD' } };

  steward.actors.device.lighting.TBD.led =
      { $info     : { type       : '/device/lighting/TBD/led'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name         : true
                                   , status       : [ 'on', 'off' ]
                                   , color        : { model: [ { rgb : { r: 'u8',  g: 'u8',  b: 'u8' } }
// TBD: other color models go here, but RGB is mandatory
                                                             , { hue         : { hue: 'degrees', saturation: 'percentage' } }
                                                             , { temperature : { temperture: 'mireds' } }
                                                             ]
                                                    }
                                   , brightness   : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/lighting/TBD/led'] = TBD;

/* if multiple bulb types, define additional deviceTypes here, e.g.,

  steward.actors.device.lighting.TBD.downlight = utility.clone(steward.actors.device.lighting.TBD.led);
  steward.actors.device.lighting.TBD.downlight.$info.type = '/device/lighting/TBD/downlight';
 */

// TBD: when the hardware driver discovers a new bulb, it will call us.
// TBD: or if the low-level driver needs to be polled, then create a 'scan' function and call it periodically.
  new TBD().on('discover', function(bulb) {
    var info;

    info = { source     : 'TBD'
           , bulb       : bulb
           , device     : { url          : null
                          , name         : bulb.name
                          , manufacturer : bulb.manufacturer
                          , model        : { name        : bulb.name
                                           , description : bulb.description
                                           , number      : bulb.number
                                           }
                          , unit         : { serial      : bulb.serialNo
                                           , udn         : 'TBD:' + bulb.serialNo.toLowerCase()
                                           }
                          }
           , deviceType : '/device/lighting/TBD/led'
         };
// if multiple bulb types, update info.deviceType as appropriate
    info.url = info.device.url;
    info.deviceType = '/device/lighting/TBD/led';
    info.id = info.device.unit.udn;
    if (!!devices.devices[info.id]) return;

    logger2.info(info.device.name, info.device);
    devices.discover(info);
  }).on('error', function(err) {
    logger2.error('TBD', { diagnostic: err.message });
  }).logger = logger2;
};
