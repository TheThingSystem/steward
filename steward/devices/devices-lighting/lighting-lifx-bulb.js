// LIFX - the smart wifi light bulb -- http://lifx.co

var lifx        = require('lifx')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var LIFX = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();
  self.lx = info.lx;
  self.bulb = info.bulb;
  self.info = {};

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(LIFX, lighting.Device);


// the low-level driver calls this function when its state changes.
// possibly somebody else is changing the state of the hardware directly,
// or the hardware has built-in controls, like a light switch.

/*
>>> bulbstate
{ bulb: { lifxAddress: <Buffer d0 73 d5 00 b0 05>, name: '' },
  state:
   { hue: 0,
     saturation: 0,
     brightness: 65535,
     kelvin: 3500,
     dim: 0,
     power: 65535,
     bulbLabel: '',
     tags: <Buffer 00 00 00 00 00 00 00 00> } }
 */
LIFX.prototype.update = function(self, state) {
  logger.debug('device/' + self.deviceID, { event      : 'update'
                                          , hue        : state.hue
                                          , saturation : state.saturation
                                          , brightness : state.brightness
                                          , kelvin     : state.kelvin
                                          , dim        : state.dim
                                          , power      : state.power
                                          });

  self.status = state.power ? 'on' : 'off';
  if ((state.kelvin > 0) || (state.hue > 0) || (state.saturation > 0)) {
    if ((state.kelvin > 0) && (state.hue === 0) && (state.saturation === 0)) {
      self.info.color = { model       : 'temperature'
                        , temperature : { temperature : Math.round(1000000 / state.kelvin) }
                        };
    } else {
      self.info.color = { model : 'rgb'
                        , rgb   : lighting.hsl2rgb({ hue        : devices.degreesValue(state.hue, 65535)
                                                   , saturation : devices.percentageValue(state.saturation, 65535)
                                                   , brightness : devices.percentageValue(state.brightness, 65535)
                                                   })
                        };
    }
  }
  if (!!state.brightness) self.info.brightness = devices.percentageValue(state.brightness, 65535);
  if ((!!state.bulbLabel) && (state.bulbLabel !== '')) self.setName(state.bulbLabel);

  self.changed();
};


// handle the calls from the steward to change things.
// set: set the internal name of the bulb.
// off: turn the bulb off.
// on: turn the bulb on and set its bulb to the 'color' and 'brightness' parameter.
LIFX.prototype.perform = function(self, taskID, perform, parameter) {
  var color, params, state, tc;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return devices.perform(self, taskID, perform, parameter);

  state = {};
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    if ((!!params.brightness) && (lighting.validBrightness(params.brightness))) state.brightness = params.brightness;
    if (!state.brightness) state.brightness = self.info.brightness;

    state.color = params.color || self.info.color;
    if (!state.color) state.color = { model: 'rgb', rgb: { r: 255, g: 255, b: 255 } };
    switch (state.color.model) {
      case 'temperature':
        if (!state.color.temperature) return false;
        if (!lighting.validTemperature(state.color.temperature.temperature)) return false;
        break;

      case 'hue':
        if (!state.color.hue) return false;
        if ((!lighting.validHue(state.color.hue.hue)) || (!lighting.validSaturation(state.color.hue.saturation))) return false;
        break;

      case 'rgb':
        tc = lighting.rgb2hsl(state.color.rgb);
        state.color = { model : 'hue', hue : lighting.rgb2hsl(state.color.rgb) };
        if (!params.brightness) state.brightness = state.color.hue.brightness;
        delete(state.color.hue.brightness);
        break;

      default:
        break;
    }
  }

  logger.info('device/' + self.deviceID, { perform: state });

  if (!state.on) self.lx.lightsOff(self.bulb);
  else {
    if (self.status === 'off') self.lx.lightsOn(self.bulb);

    color = { hue: 0, saturation: 0, luminance: 0, whiteColor: 0, fadeTime: 0 };

    if (state.color.model === 'hue') {
      color.hue = devices.scaledPercentage((state.color.hue.hue / 360) * 100,  0, 65535);
      color.saturation = devices.scaledPercentage(state.color.hue.saturation, 0, 65535);
    } else color.whiteColor = 1000000 / state.color.temperature.temperature;
    color.luminance = devices.scaledPercentage(state.brightness, 0, 65535);

    self.lx.lightsColour(color.hue, color.saturation, color.luminance, color.whiteColor, color.fadeTime);

    if (state.color.model === 'hue') {
      state.color = { model       : 'rgb'
                    , rgb         : lighting.hsl2rgb({ hue        : state.color.hue.hue
                                                     , saturation : state.color.hue.saturation
                                                     , brightness : state.brightness
                                                     })
                    };
    }
  }

  self.status = state.on ? 'on' : 'off';
  if (state.on) {
    self.info.color = state.color;
    self.info.brightness = state.brightness;
  }
  self.changed();

  return steward.performed(taskID);
};

// check the parameters on the perform before we even try to do it.
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
        case 'temperature':
          if (!color.temperature) { result.requires.push('color.temperature'); break; }
          if (!lighting.validTemperature(color.temperature.temperature)) result.invalid.push('color.temperature.temperature');
          break;

        case 'hue':
          if (!color.hue) { result.requires.push('color.hue'); break; }
          if (!lighting.validHue(color.hue.hue)) result.invalid.push('color.hue.hue');
          if (!lighting.validSaturation(color.hue.saturation)) result.invalid.push('color.hue.saturation');
          if (!params.brightness) result.requires.push('brightness');
          break;

        case 'rgb':
          if (!lighting.validRGB(color.rgb)) result.invalid.push('color.rgb');
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
  var lx;

  steward.actors.device.lighting.LIFX = steward.actors.device.lighting.LIFX ||
      { $info     : { type: '/device/lighting/LIFX' } };

  steward.actors.device.lighting.LIFX.bulb =
      { $info     : { type       : '/device/lighting/LIFX/bulb'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , color      : { model: [ { temperature : { temperature: 'mireds' } }
                                                           , { hue         : { hue: 'degrees', saturation: 'percentage' } }
                                                           , { rgb         : { r: 'u8', g: 'u8', b: 'u8' } }
                                                           ]
                                                  }
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/lighting/LIFX/bulb'] = LIFX;

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

    info.url = info.device.url;
    info.deviceType = '/device/lighting/LIFX/bulb';
    info.id = info.device.unit.udn;
    if (!!devices.devices[info.id]) return;

    devices.discover(info);
  }).on('bulbstate', function(bulbstate) {
    var device,  udn;

    udn = 'LIFX:' + bulbstate.bulb.lifxAddress.toString('hex');
    if (!devices.devices[udn]) return update(udn, bulbstate.state);

    device = devices.devices[udn].device;
    if (!device) return update(udn, bulbstate.state);
    device.update(device, bulbstate.state);
  }).on('bulbonoff', function(bulbonoff) {
    var device, onoff, udn;

    onoff = { power: bulbonoff.on ? 65535 : 0 };

    udn = 'LIFX:' + bulbonoff.bulb.lifxAddress.toString('hex');
     if (!devices.devices[udn]) return update(udn, onoff);

    device = devices.devices[udn].device;
    if (!device) return update(udn, onoff);
    device.update(device, onoff);
  });
  setInterval(function() { lx.findBulbs(); }, 30 * 1000);

// the LIFX stream is faster than the database on startup
  var update = function(udn, data) {
    var device;

    if ((!devices.devices[udn]) || (!devices.devices[udn].device)) return setTimeout(function() { update(udn, data); }, 10);

    device = devices.devices[udn].device;
    if (!!device) device.update(device, data);
  };
};
