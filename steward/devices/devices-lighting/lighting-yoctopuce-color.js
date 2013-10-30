// Yocto-Color: http://www.yoctopuce.com/EN/products/usb-actuators/yocto-color

var tinycolor   = require('tinycolor2')
  , util        = require('util')
  , yapi        = require('yoctolib')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , hub         = require('./../devices-gateway/gateway-yoctopuce-hub')
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var Color = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.status = 'waiting';
  self.changed();
  if (self.deviceUID.indexOf('.colorLed2') !== -1) self.ledNo = 2;
  else {
    self.ledNo = 1;

    info = utility.clone(info);
    info.device.unit.udn += '.colorLed2';
    info.id = info.device.unit.udn;
    devices.discover(info);
  }
  self.led = yapi.yFindColorLed(info.device.unit.serial + '.colorLed' + self.ledNo);
  self.info = {};

  if (self.led.isOnline()) {
    self.led.get_logicalName_async(function(ctx, led, result) {
      if (result === yapi.Y_LOGICALNAME_INVALID) {
        return logger.error('device/' + self.deviceID,  { event: 'get_logicalName', diagnostic: 'logicalName invalid' });
      }

      if ((!result) || (result.length === 0)) result = 'Yocto-Color';
      if (result === 'Yocto-Color') result += ' LED #' + self.ledNo;
      if (result === self.name) return;

      logger.info('device/' + self.deviceID, { event: 'get_logicalName', result: result });
      self.setName(result);
    });
  }

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.led.get_rgbColor_async(function(ctx, led, result) {
    if (result === yapi.Y_RGBCOLOR_INVALID) {
      return logger.error('device/' + self.deviceID,  { event: 'get_rgbColor', diagnostic: 'rgbColor invalid' });
    }

    self.info.color = { model: 'rgb', rgb: { r: (result >> 16) & 255, g: (result >> 8) & 255, b: result & 255 } };
    self.info.brightness = ((self.info.color.rgb.r !== 0) || (self.info.color.rgb.g !== 0) && (self.info.color.rgb.b !== 0))
                             ? 100 : 0;
    self.status = (self.info.brightness > 0) ? 'on' : 'off';
    self.changed();
  });
};
util.inherits(Color, lighting.Device);


Color.prototype.perform = function(self, taskID, perform, parameter) {
  var params, result, state;

  state = { color: [ 0, 0, 0 ] };
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    result = self.led.set_logicalName(params.name);
    if (result === yapi.YAPI_SUCCESS) return self.setName(params.name, taskID);

    logger.error('device/' + self.deviceID, { event: 'set_logicalName', result: result });
    return false;
  }

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    if ((!!params.brightness) && (lighting.validBrightness(params.brightness))) state.brightness = params.brightness;

    state.color = params.color || self.info.color;
    if (state.color.model === 'hue') {
      if (!!!state.brightness) return;

      state.color.model = 'rgb';
      state.color.rgb = tinycolor({ h : state.color.hue.hue
                                  , s : state.color.hue.saturation
                                  , l : state.brightness
                                  }).toRgb();
    } else if ((state.color.model !== 'rgb') || !lighting.validRGB(state.color.rgb)) return;
  }
  if ((state.color.rgb.r === 0) && (state.color.rgb.g === 0) && (state.color.rgb.b === 0)) state.on = false;

  logger.info('device/' + self.deviceID, { perform: state });

  if (self.led.set_rgbColor( (state.color.rgb.r << 16) + (state.color.rgb.g << 8) + (state.color.rgb.b))
        === yapi.Y_RGBCOLOR_INVALID) {
    logger.error('device/' + self.deviceID,  { event: 'set_rgbColor', diagnostic: 'rgbColor invalid' });
    return false;
  }

  self.status = state.on ? 'on' : 'off';
  if (state.on) self.info.color = state.color;
  self.info.brightness = state.on ? 100 : 0;
  self.changed();

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

  if (perform === 'set') return hub.validate_perform(perform, parameter);

  if (perform !== 'on') result.invalid.push('perform');

  color = params.color;
  if (!!color) {
    switch (color.model) {
        case 'hue':
          if (!lighting.validHue(color.hue)) result.invalid.push('color.hue');
          if (!lighting.validSaturation(color.saturation)) result.invalid.push('color.saturation');
          if (!params.brightness) result.requires.push('brightness');
          break;

        case 'rgb':
          if (!lighting.validRGB(color.rgb)) result.invalid.push('color.rgb');
          break;

        default:
          result.invalid.push('color.model');
          break;
    }
  } else result.requires.push('color');

  if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) result.invalid.push('brightness');

  return result;
};


exports.start = function() {
  steward.actors.device.lighting.yoctopuce = steward.actors.device.lighting.yoctopuce ||
      { $info     : { type: '/device/lighting/yoctopuce' } };

  steward.actors.device.lighting.yoctopuce.color =
      { $info     : { type       : '/device/lighting/yoctopuce/color'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , color      : { model: [ { rgb         : { r: 'u8', g: 'u8', b: 'u8' } }
                                                           , { hue         : { hue: 'degrees', saturation: 'percentage' } }
                                                           ]
                                                  }
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : {  perform   : validate_perform }
      };
  devices.makers['/device/lighting/yoctopuce/color'] = Color;

  hub.register('Yocto-Color', '/device/lighting/yoctopuce/color');
};
