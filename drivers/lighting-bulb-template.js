// lighting bulb template -- start with this when each bulb can be managed independently (controller may be present, but hidden)
// search for TBD to see what to change

// load the module that knows how to discovery/communicate with a bulb
var TBD         = require('TBD')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;

// define the prototype that will be instantiated when a bulb is discovered
// later, we will create a ...perform function, and a ...update function.
var TBD = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.bulb = info.bulb;
// TBD: invoked by the lower-level bulb driver whenever a bulb changes state. You probably
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
/* TBD: update self.state and self.info accordingly

  self.status = ... ? 'on' : 'off';
  self.info = { color      : { model: 'rgb', rgb: { r: 0, g: 0, b: 0 } }
              , brightness : 0
              };
 */
};

// handle the calls from the steward to change things.
// set: set the internal name of the bulb.
// off: turn the bulb off.
// on: turn the bulb on and set its bulb to the 'color' and 'brightness' parameter.
TBD.prototype.perform = function(self, taskID, perform, parameter) {
  var color, f, params, state;

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

    if ((!!params.brightness) && (lighting.validBrightness(params.brightness))) state.brightness = params.brightness;

/* TBD: if a brightness of zero means that the bulb is off, remember that.

     state.on = false;
 */
  }

  logger.info('device/' + self.deviceID, { perform: state });

// TBD: here is the meat of our driver. We call into the low-level hardware driver to turn the bulb on and off,
// set the brightness, and/or set the color.
  if (!state.on) self.bulb.turnOff();
  else {
    f = function() { self.bulb.setState(state); };

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
    info.deviceType = 'TBD';
    info.deviceType2 = 'urn:schemas-upnp-org:device:Basic:1';
    info.id = info.device.unit.udn;
    if (!!devices.devices[info.id]) return;

    logger2.info(info.device.name, info.device);
    devices.discover(info);
  }).on('error', function(err) {
    logger2.error('TBD', { diagnostic: err.message });
  }).logger = logger2;
};
