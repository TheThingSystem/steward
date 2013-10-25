// blink(1): http://thingm.com/products/blink-1.html

var util        = require('util')
  , blink1      = require('node-blink1')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var Blink1 = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();
  self.led = info.led;
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.led.setRGB(255, 255, 255, function () {
    self.status = 'on';
    self.info.color = { model: 'rgb', rgb: { r: 255, g: 255, b: 255 } };
    self.changed();
  });
};
util.inherits(Blink1, lighting.Device);


Blink1.prototype.perform = function(self, taskID, perform, parameter) {
  var color, params, state;

  state = {};
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return self.setName(params.name, taskID);

  state.color = [ 0, 0, 0 ];
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return;
  else {
    state.on = true;

    color = params.color;
    if ((!!color) && (color.model === 'rgb') && lighting.validRGB(color.rgb)) {
      state.color = [ color.rgb.r, color.rgb.g, color.rgb.b ];
    }
  }
  if ((state.color[0] + state.color[1] + state.color[2]) === 0) state.on = false;

  logger.info('device/' + self.deviceID, { perform: state });

  self.led.setRGB(state.color[0], state.color[1], state.color[2], function () {
    self.status = state.on ? 'on' : 'off';
    self.info.color = { model: 'rgb', rgb: { r: state.color[0], g: state.color[1], b: state.color[2] } };
    self.changed();
  });

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

  if (perform !== 'on') result.invalid.push('perform');

  color = params.color;
  if (!color) result.requires.push('color');
  else {
    if (color.model !== 'rgb') result.invalid.push('color');
    else if (!lighting.validRGB(color.rgb)) result.invalid.push('color.rgb');
  }

  return result;
};


var scan = function() {
  var i, info, led, serial, serials, udn;

  serials = blink1.devices();
  for (i = 0; i < serials.length; i++) {
    serial = serials[i];
    udn = 'blink1:' + serial;
    if (devices.devices[udn]) continue;

    led = new blink1.Blink1(serial);

    info = { source: 'node-blink1', led: led };
    info.device = { url          : null
                  , name         : 'Blink1 #' + serial
                  , manufacturer : 'ThingM'
                  , model        : { name        : 'blink(1)'
                                   , description : 'A fully-controllable, full color RGB LED USB light'
                                   , number      : ''
                                   }
                  , unit         : { serial      : serial
                                   , udn         : udn
                                   }
                  };
      info.url = info.device.url;
      info.deviceType = '/device/lighting/blink1/led';
      info.id = info.device.unit.udn;
      if (devices.devices[info.id]) return;

      devices.discover(info);
  }
};


exports.start = function() {
  steward.actors.device.lighting.blink1 = steward.actors.device.lighting.blink1 ||
      { $info     : { type: '/device/lighting/blink1' } };

  steward.actors.device.lighting.blink1.led =
      { $info     : { type       : '/device/lighting/blink1/led'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , color      : { model: [ { rgb         : { r: 'u8', g: 'u8', b: 'u8' } }
                                                           ]
                                                  }
                                   }
                    }
      , $validate : {  perform   : validate_perform }
      };
  devices.makers['/device/lighting/blink1/led'] = Blink1;

  scan();
  setInterval(scan, 30 * 1000);
};
