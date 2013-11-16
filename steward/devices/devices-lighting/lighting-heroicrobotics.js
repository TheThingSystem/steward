// +++ under development
// Heroic Robotics' PixelPusher -- http://www.heroicrobotics.com

exports.start = function() {};
return;


var pixelpusher = require('pixelpusher')
  , util        = require('util')
  , db          = require('./../../core/database').db
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var PixelPusher = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  var id;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.controller = info.controller;
  self.pixelpusher = self.controller.params.pixelpusher;
  self.status = 'ready';
  self.info = { controller: self.pixelpusher.controllerNo, group: self.pixelpusher.groupNo };
  self.changed();
  self.lights = {};

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    var light;

    if (request !== 'perform') return;

    deviceID = actor.split('/')[1];
    if (self.deviceID === deviceID) return devices.perform(self, taskID, perform, parameter);
    for (light in self.lights) {
      if (!self.lights.hasOwnProperty(light)) continue;

      if (self.lights[light].deviceID === deviceID) return self.perform(self, taskID, perform, parameter, light);
    }
  });

  for (id = 0; id < self.pixelpusher.numberStrips; id++) self.addchild(self, id);
};
util.inherits(PixelPusher, lighting.Device);


PixelPusher.prototype.addchild = function(self, id) {
  var deviceUID, state, whatami;

  deviceUID = self.deviceUID + '/strips/' + id;
  whatami = '/device/lighting/heroic-robotics/rgb';
  state = { color: { model: 'rgb', rgb: { r: 0, g: 0, b: 0 } }, brightness: 0 };
  if (!!self.pixelpusher.stripFlags) {
    if (self.pixelpusher.stripFlags & 0x01) {
      whatami = '/device/lighting/heroic-robotics/rgbow';
      state = { color: { model: 'rgbow', rgbow: { r: 0, g: 0, b: 0, o: 0, w: 0 } }, brightness: 0 };
    } else if (self.pixelpusher.stripFlags & 0x02) {
      whatami = '/device/lighting/heroic-robotics/rgb16';
      state = { color: { model: 'rgb16', rgb16: { r: 0, g: 0, b: 0 } }, brightness: 0 };
    }
  }
  state.on = false;
  self.lights[id] = { whatami : whatami
                    , name    : id.toString()
                    , status  : 'off'
                    , state   : state
                    };

  db.get('SELECT deviceID, deviceType, deviceName FROM devices WHERE deviceUID=$deviceUID',
         { $deviceUID: deviceUID }, function(err, row) {
    if (err) {
      logger.error('device/' + self.deviceID, { event: 'SELECT device.deviceUID for light ' + id, diagnostic: err.message });
      return;
    }

    if (row !== undefined) {
      self.lights[id].deviceID = row.deviceID.toString();
      self.lights[id].type = row.deviceType;
      self.lights[id].name = row.deviceName;
      return;
    }

    db.run('INSERT INTO devices(deviceUID, parentID, childID, deviceType, created) '
           + 'VALUES($deviceUID, $parentID, $childID, $deviceType, datetime("now"))',
           { $deviceUID: deviceUID, $parentID: self.deviceID, $deviceType: whatami, $childID: id }, function(err) {
      if (err) {
        logger.error('device/' + self.deviceID,
                     { event: 'INSERT device.deviceUID for light ' + id, diagnostic: err.message });
        return;
      }

      self.lights[id].deviceID = this.lastID.toString();
      self.lights[id].type = whatami;
    });
  });
};


PixelPusher.prototype.children = function() {
  var self = this;

  var children, light;

  children = [];
  for (light in self.lights) if (self.lights.hasOwnProperty(light)) children.push(childprops(self, light));

  return children;
};

var childprops = function(self, light) {
  var child, prop, props;

  child = {};
  props = self.lights[light];
  for (prop in props) if (props.hasOwnProperty(prop)) child[prop] = props[prop];

  child.id = light;
  child.discovery = { id: child.id, source: 'device/' + self.deviceID, deviceType: child.type };
  child.whoami = 'device/' + child.deviceID;

  if (!!child.state) {
    child.status = child.state.on ? 'on' : 'off';
    child.info = { color: child.state.color, brightness: child.state.on ? 100 : 0 };
    child.updated = props.updated;
  }

  child.proplist = devices.Device.prototype.proplist;

  child.perform = function(led, taskID, perform, parameter) { return self.perform(self, taskID, perform, parameter, light); };

  return child;
};

PixelPusher.prototype.perform = function(self, taskID, perform, parameter, light) {
  var i, offset, params, pixel, pixels, rgb, rgbow, rgb16, state, width;

  state = { };
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return devices.perform(self.lights[light], taskID, perform, parameter);

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) return false;

    state.color = params.color || self.info.color;
    switch (state.color) {
      case 'rgb':
        if (!lighting.validRGB(state.color.rgb)) return false;
        rgb = state.color.rgb;
        if ((rgb.r === 0) && (rgb.g === 0) && (rgb.b === 0)) state.on = false;
        break;

      case 'rgbow':
        if (!lighting.validRGBOW(state.color.rgbow)) return false;
        if ((state.color.rgbow.r === 0) && (state.color.rgbow.g === 0) && (state.color.rgbow.b === 0)
                && (state.color.rgbow.o === 0) && (state.color.rgbow.w === 0)) state.on = false;
        break;

      case 'rgb16':
        if (!lighting.validRGB16(state.color.rgb16)) return false;
        if ((state.color.rgb16.r === 0) && (state.color.rgb16.g === 0) && (state.color.rgb16.b === 0)) state.on = false;
        break;

      default:
        return false;
    }
  }
  if (!state.on) state.color = { model: 'rgb', rgb: { r: 0, g: 0, b: 0 } };

  logger.info('device/' + self.lights[light].deviceID, { perform: state });

  if (self.lights[light].state.color.model != state.color.model) {
    if (state.color.model === 'rgbow') {
      state.color = { model: 'rgb', rgb: { r: state.color.rgbow.r, g: state.color.rgbow.g, b: state.color.rgbow.b } };
    } else if (state.color.model === 'rgb16') {
      state.color = { model: 'rgb', rgb: { r : state.color.rgb16.r >> 8
                                         , g : state.color.rgb16.g >> 8
                                         , b : state.color.rgb16.b >> 8
                                         } };
    }
  }

  switch (self.lights[light].state.color.model) {
    case 'rgb':
      rgb = state.color.rgb;

      pixel = new Buffer(width = 3);
      pixel.data[0] = rgb.r;
      pixel.data[1] = rgb.r;
      pixel.data[2] = rgb.r;
      break;

    case 'rgbow':
      if (state.color.model === 'rgb') {
        state.color = { model: 'rgbow', rgbow: { r: state.color.rgb.r, g: state.color.rgb.g, b: state.color.rgb.b,
                                                 o: 0,                 w: 0
                                               } };
      }
      rgbow = state.color.rgbow;

      pixel = new Buffer(width = 9);
      pixel.data[0] = rgbow.r;
      pixel.data[1] = rgbow.g;
      pixel.data[2] = rgbow.b;
      pixel.data[3] = rgbow.o;
      pixel.data[4] = rgbow.o;
      pixel.data[5] = rgbow.o;
      pixel.data[6] = rgbow.w;
      pixel.data[7] = rgbow.w;
      pixel.data[8] = rgbow.w;
      break;

    case 'rgb16':
      if (state.color.model === 'rgb') {
        state.color = { model: 'rgb16', rgb16: { r: state.color.rgb.r << 8
                                               , g: state.color.rgb.g << 8
                                               , b: state.color.rgb.b << 8
                                               } };
      }
      rgb16 = state.color.rgb16;

      pixel = new Buffer(width = 6);
      pixel.data[0] = rgb16.r >> 8;
      pixel.data[1] = rgb16.g >> 8;
      pixel.data[2] = rgb16.b >> 8;
      pixel.data[3] = rgb16.r & 0xff;
      pixel.data[4] = rgb16.g & 0xff;
      pixel.data[5] = rgb16.b & 0xff;
      break;

    default:
      return false;
  }

  pixels = new Buffer(self.pixelpusher.pixelsPerStrip * width);
  for (i = offset = 0; i < self.pixelpusher.pixelsPerStrip; i++, offset += width) pixel.copy(pixels, offset);
  self.controller.refresh([ { number: 0, data: pixels } ]);

  self.status = state.on ? 'on' : 'off';
  if (state.on) self.info.color = state.color;
  self.info.brightness = state.on ? 100 : 0;
  self.changed();

  return steward.performed(taskID);
};


var validate_perform_led = function(perform, parameter) {
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
  if (!!color) {
    switch (color.model) {
        case 'rgb':
          if (!lighting.validRGB(color.rgb)) result.invalid.push('color.rgb');
          break;

        case 'rgbow':
          if (!lighting.validRGBOW(color.rgbow)) result.invalid.push('color.rgbow');
          break;

        case 'rgb16':
          if (!lighting.validRGB16(color.rgb)) result.invalid.push('color.rgb16');
          break;

        default:
          result.invalid.push('color.model');
          break;
    }
  }

  if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) result.invalid.push('brightness');

  return result;
};


var scan = function() {
  var logger2 = utility.logger('discovery');

  new pixelpusher().on('discover', function(controller) {
    var info, serialNo;

    serialNo = controller.params.macAddress.split(':').join('');
    info = { source     : 'UDP'
           , controller : controller
           , device     : { url          : 'udp://' + controller.params.ipAddress + ':' + controller.params.pixelpusher.myPort
                          , name         : 'Heroic Robotics PixelPusher (' + controller.params.ipAddress + ')'
                          , manufacturer : 'Heroic Robotics'
                          , model        : { name        : 'Heroic Robotics PixelPusher'
                                           , description : controller.params.hardwareRev+ ' / ' +controller.params.softwareRev
                                           , number      : controller.params.vendorID   + ' / ' + controller.params.productID
                                           }
                          , unit         : { serial      : serialNo
                                           , udn         : 'uuid:2f402f80-da50-11e1-9b23-' + serialNo
                                           }
                          }
           , deviceType : steward.actors.device.lighting['heroic-robotics'].$info.type
           };
    info.url = info.device.url;
    info.deviceType = info.device.model.name;
    info.deviceType2 = 'urn:schemas-upnp-org:device:Basic:1';
    info.id = info.device.unit.udn;
    if (devices.devices[info.id]) return;

    logger2.info('UDP ' + info.device.name, { url: info.url });
    devices.discover(info);
  }).on('error', function(err) {
    logger2.error('PixelPusher', { diagnostic: err.message });
  });
};


// TBD: add automatic restoration of LED strips

exports.start = function() {
  steward.actors.device.gateway['heroic-robotics'] = steward.actors.device.gateway['heroic-robotics'] ||
      { $info     : { type: '/device/gateway/heroic-robotics' } };

  steward.actors.device.gateway['heroic-robotics'].bridge =
      { $info     : { type       : '/device/gateway/heroic-robotics/pixelpusher'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'ready' ]
                                   , controller : 's32'
                                   , group      : 's32'
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['Heroic Robotics PixelPusher'] = PixelPusher;

  steward.actors.device.lighting['heroic-robotics'] = steward.actors.device.lighting['heroic-robotics'] ||
      { $info     : { type: '/device/lighting/heroic-robotics' } };

  steward.actors.device.lighting['heroic-robotics'].rgb =
      { $info     : { type       : '/device/lighting/heroic-robotics/rgb'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'on', 'off' ]
                                   , pixels     : 'u16'
                                   , color      : { model: [ { rgb         : { r: 'u8',  g: 'u8',  b: 'u8' } }
                                                           ]
                                                  }
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform_led }
      };

  steward.actors.device.lighting['heroic-robotics'].rgbow =
      { $info     : { type       : '/device/lighting/heroic-robotics/rgbow'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'on', 'off' ]
                                   , pixels     : 'u16'
                                   , color      : { model: [ { rgb         : { r: 'u8',  g: 'u8',  b: 'u8' } }
                                                           , { rgbow       : { r: 'u8',  g: 'u8',  b: 'u8'
                                                                             ,  o: 'u8',  w: 'u8' } }
                                                           ]
                                                  }
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform_led }
      };

  steward.actors.device.lighting['heroic-robotics'].rgb16 =
      { $info     : { type       : '/device/lighting/heroic-robotics/rgb16'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'on', 'off' ]
                                   , pixels     : 'u16'
                                   , color      : { model: [ { rgb         : { r: 'u8',   g: 'u8',   b: 'u8'  } }
                                                           , { rgb16       : { r: 'u16',  g: 'u16',  b: 'u16' } }
                                                           ]
                                                  }
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform_led }
      };

  scan();
};
