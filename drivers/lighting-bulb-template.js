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
var TBD = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.bulb = info.bulb;
// TBD: invoked whenever a bulb changes state (the event may be named/parameterized differently)
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

TBD.prototype.update = function(self, state) {
/* TBD: update self.state and self.info accordingly

  self.status = ... ? 'on' : 'off';
  self.info = { color      : { model: 'rgb', rgb: { r: 0, g: 0, b: 0 } }
              , brightness : 0
              };
 */
};


TBD.prototype.perform = function(self, taskID, perform, parameter) {
  var color, f, params, state;

  state = { color: self.info.color, brightness: self.info.brightness };
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!params.name) return false;

    return self.setName(params.name, taskID);
  }

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

/* TBD: test for all dark here, if so:

     state.on = false;
 */
  }

  logger.info('device/' + self.deviceID, { perform: state });

// TBD: these calls may be named/parameterized differently
  if (!state.on) self.bulb.turnOff();
  else {
    f = function() { self.bulb.setState(state); };

    if (self.state !== 'on') self.bulb.turnOn(f); else f();
  }

// rely on bulb to emit a 'stateChange' event to update internal state

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var color
    , params = {}
    , result = { invalid: [], requires: [] };

  if (perform === 'off') return result;

  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }
  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

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
  } else result.requires.push('color');

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

// create a discovery object to find the bulbs, listen for discovery events (the event may be named/parameterized differently)
// and set its logging function
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
