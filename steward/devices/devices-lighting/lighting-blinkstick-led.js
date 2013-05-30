// blinkstick: http://www.blinkstick.com

var util        = require('util')
  , blinkstick  = require('blinkstick')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var Blinkstick = exports.Device = function(deviceID, deviceUID, info) {
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
    if (request === 'ping') {
      logger.info('device/' + self.deviceID, { status: self.status });
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;
    else if (request === 'perform') self.perform(self, taskID, perform, parameter);
  });

// NEED: get name from DB...

  self.led.getColor(function(err, r, g, b) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'getColor', diagnostic: err.message });

    self.status = 'on';
    self.info.color = { model: 'rgb', rgb: { r: r, g: g, b: b } };
    self.changed();
  });
};
util.inherits(Blinkstick, lighting.Device);


Blinkstick.prototype.perform = function(self, taskID, perform, parameter) {
  var color, params, state;

  state = {};
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return self.setName(params.name);

  state.color = [ 0, 0, 0];
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

  self.led.setColor(state.color[0], state.color[1], state.color[2], function(err) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'setColor', state: state, diagnostic: err.message });

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
    if (!lighting.validRGB(color.rgb)) result.invalid.push('color.rgb');
  }

  return result;
};


var scan = function() {
  var i, info, led, serial, serials, udn;

  serials = blinkstick.findAllSerials();
  for (i = 0; i < serials.length; i++) {
    serial = serials[i];
    udn = 'blinkstick:' + serial;
    if (devices.devices[udn]) continue;

    led = new blinkstick.findBySerial(serial);

    info = { source: 'blinkstick', led: led };
    info.device = { url          : null
                  , name         : 'Blinkstick #' + serial
                  , manufacturer : led.getManufacturer()
                  , model        : { name        : 'Blinkstick'
                                   , description : led.getDescription()
                                   , number      : ''
                                   }
                  , unit         : { serial      : serial
                                   , udn         : udn
                                   }
                  };
      info.url = info.device.url;
      info.deviceType = '/device/lighting/blinkstick/led';
      info.id = info.device.unit.udn;
      if (devices.devices[info.id]) return;

      devices.discover(info);
  }
};


exports.start = function() {
  steward.actors.device.lighting.blinkstick = steward.actors.device.lighting.blinkstick ||
      { $info     : { type: '/device/lighting/blinkstick' } };

  steward.actors.device.lighting.blinkstick.led =
      { $info     : { type       : '/device/lighting/blinkstick/led'
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
  devices.makers['/device/lighting/blinkstick/led'] = Blinkstick;

  scan();
  setInterval(scan, 30 * 1000);
};
