// Yocto-PowerColor: http://www.yoctopuce.com

var util        = require('util')
  , yapi        = require('yoctolib')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var PowerColor = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.status = 'waiting';
  self.changed();
  self.led = yapi.yFindColorLed(info.device.unit.serial + '.colorLed1');
  self.info = {};

  if (self.led.isOnline()) {
    self.led.get_logicalName_async(function(ctx, result, message) {
console.log('>>> result=' + JSON.stringify(result) + ' message=' + message);
      if (result !== yapi.YAPI_SUCCESS) {
        return logger.error('device/' + self.deviceID,  { event: 'get_logicalName', diagnostic: message });
      }

/*
      if ((!result) || (result.length === 0) || (result === self.name)) return;
        
      logger.info('device/' + self.deviceID, { event: 'get_logicalName', result: result });
      self.setName(result);
*/
    });
  }

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.led.get_rgbColor_async(function(ctx, result, message) {
console.log('>>> result=' + JSON.stringify(result) + ' message=' + message);
    if (result !== yapi.YAPI_SUCCESS) {
      return logger.error('device/' + self.deviceID,  { event: 'get_rgbColor', diagnostic: message });
    }

/*
    self.status = 'on';
    self.info.color = { model: 'rgb', rgb: { r: r, g: g, b: b } };
    self.changed();
*/
  });
};
util.inherits(PowerColor, lighting.Device);


PowerColor.prototype.perform = function(self, taskID, perform, parameter) {
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
    else if (!lighting.validRGB(color.rgb)) result.invalid.push('color.rgb');
  }

  return result;
};


exports.start = function() {
  steward.actors.device.lighting.yoctopuce = steward.actors.device.lighting.yoctopuce ||
      { $info     : { type: '/device/lighting/yoctopuce' } };

  steward.actors.device.lighting.yoctopuce.powercolor =
      { $info     : { type       : '/device/lighting/yoctopuce/powercolor'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , color      : { model: [ { rgb         : { r: 'u8', g: 'u8', b: 'u8' } }
                                                           , { hue         : { hue: 'degrees', saturation: 'percentage' } }
                                                           ]
                                                  }
                                   }
                    }
      , $validate : {  perform   : validate_perform }
      };
  devices.makers['/device/lighting/yoctopuce/powercolor'] = PowerColor;
};
