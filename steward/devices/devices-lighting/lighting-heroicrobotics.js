// Heroic Robotics' PixelPusher -- http://www.heroicrobotics.com

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

  self.whatami = '/device/gateway/heroic-robotics/pixelpusher';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    var led;

    if (request !== 'perform') return;

    deviceID = actor.split('/')[1];
    if (self.deviceID === deviceID) return devices.perform(self, taskID, perform, parameter);
    for (led in self.strips) {
      if (!self.strips.hasOwnProperty(led)) continue;

      if (self.strips[led].deviceID === deviceID) return self.perform(self, taskID, perform, parameter, led);
    }
  });

  self.update(self, info.controller);
};
util.inherits(PixelPusher, lighting.Device);


PixelPusher.prototype.update = function(self, controller) {
  var led;

  if (self.status === 'absent') logger.warning('device/' + self.deviceID, { event: 're-acquired' });

  self.controller = controller;
  self.pixelpusher = self.controller.params.pixelpusher;
  self.status = 'ready';
  self.info = { nodeID: [ self.pixelpusher.groupNo, self.pixelpusher.controllerNo ] };
  self.changed();
  self.strips = {};

  self.controller.on('update', function() {
    self.status = 'ready';
    self.changed();
  }).on('timeout', function() {
    logger.error('device/' + self.deviceID, { event: 'timeout' });

    self.status = 'absent';
    self.changed();
  });

  for (led = 0; led < self.pixelpusher.numberStrips; led++) { self.addchild(self, led); break; }
};

PixelPusher.prototype.addchild = function(self, led) {
  var deviceUID, state, whatami;

  deviceUID = self.deviceUID + '/strips/' + led;
  whatami = '/device/lighting/heroic-robotics/rgb';
  state = { color: { model: 'rgb', rgb: { r: 0, g: 0, b: 0 } } };
  if (!!self.pixelpusher.stripFlags) {
    if (self.pixelpusher.stripFlags & 0x02) {
      whatami = '/device/lighting/heroic-robotics/rgb16';
      state = { color: { model: 'rgb16', rgb16: { r: 0, g: 0, b: 0 } } };
    } else if (self.pixelpusher.stripFlags & 0x01) {
      whatami = '/device/lighting/heroic-robotics/rgbow';
      state = { color: { model: 'rgbow', rgbow: { r: 0, g: 0, b: 0, o: 0, w: 0 } } };
    }
  }
  state.on = false;
  self.strips[led] = { whatami : whatami
                     , type    : whatami
                     , name    : 'LED strip #' + led.toString()
                     , status  : 'off'
                     , state   : state
                     , number  : self.pixelpusher.pixelsPerStrip
                     , updated : self.updated
                     };

  db.get('SELECT deviceID, deviceType, deviceName FROM devices WHERE deviceUID=$deviceUID',
         { $deviceUID: deviceUID }, function(err, row) {
    if (err) {
      logger.error('device/' + self.deviceID, { event: 'SELECT device.deviceUID for LED ' + led, diagnostic: err.message });
      return;
    }

    if (row !== undefined) {
      self.strips[led].deviceID = row.deviceID.toString();
      self.strips[led].name = row.deviceName;
      return;
    }

    db.run('INSERT INTO devices(deviceUID, parentID, childID, deviceType, deviceName, created) '
           + 'VALUES($deviceUID, $parentID, $childID, $deviceType, $deviceName, datetime("now"))',
           { $deviceUID: deviceUID, $parentID: self.deviceID, $deviceType: whatami, $deviceName: self.strips[led].name,
             $childID: led }, function(err) {
      if (err) {
        logger.error('device/' + self.deviceID,
                     { event: 'INSERT device.deviceUID for LED ' + led, diagnostic: err.message });
        return;
      }

      self.strips[led].deviceID = this.lastID.toString();
    });
  });
};


PixelPusher.prototype.children = function() {
  var self = this;

  var children, led;

  children = [];
  for (led in self.strips) if (self.strips.hasOwnProperty(led)) children.push(childprops(self, led));

  return children;
};

var childprops = function(self, led) {
  var child, props;

  props = self.strips[led];
  child = { id        : led
          , discovery : { id: led, source: 'device/' + self.deviceID  }
          , whatami   : props.type
          , whoami    : 'device/' + props.deviceID
          , name      : props.name
          , status    : props.state.on ? 'on' : 'off'
          , info      : { color: props.state.color, pps: self.pixelpusher.pixelsPerStrip }
          , deviceID  : props.deviceID
          , updated   : props.updated
          };

  child.proplist = devices.Device.prototype.proplist;
  child.setName = devices.Device.prototype.setName;

  child.perform = function(strip, taskID, perform, parameter) { return self.perform(self, taskID, perform, parameter, led); };

  return child;
};

PixelPusher.prototype.perform = function(self, taskID, perform, parameter, led) {
  var i, offset, params, pixel, pixels, props, rgb, rgb16, rgbow, state, width;

  state = {};
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  props = self.strips[led];
  if (perform === 'set') {
    if (!!params.name) return childprops(self, led).setName(params.name, taskID);

    return false;
  }

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    state.color = params.color || props.state.color;
    switch (state.color.model) {
      case 'rgb':
        if (!lighting.validRGB(state.color.rgb)) return false;
        rgb = state.color.rgb;
        if ((rgb.r === 0) && (rgb.g === 0) && (rgb.b === 0)) state.on = false;
        break;

      case 'rgb16':
        if (!lighting.validRGB16(state.color.rgb16)) return false;
        if ((state.color.rgb16.r === 0) && (state.color.rgb16.g === 0) && (state.color.rgb16.b === 0)) state.on = false;
        break;

      case 'rgbow':
        if (!lighting.validRGBOW(state.color.rgbow)) return false;
        if ((state.color.rgbow.r === 0) && (state.color.rgbow.g === 0) && (state.color.rgbow.b === 0)
                && (state.color.rgbow.o === 0) && (state.color.rgbow.w === 0)) state.on = false;
        break;

      default:
        return false;
    }
  }
  if (!state.on) state.color = { model: 'rgb', rgb: { r: 0, g: 0, b: 0 } };

  logger.info('device/' + props.deviceID, { perform: state });

  if (props.state.color.model != state.color.model) {
    if (state.color.model === 'rgb16') {
      state.color = { model: 'rgb'
                    , rgb: { r : state.color.rgb16.r >> 8, g : state.color.rgb16.g >> 8, b : state.color.rgb16.b >> 8 }
                    };
    } else if (state.color.model === 'rgbow') {
      state.color = { model: 'rgb'
                    , rgb: { r: state.color.rgbow.r,       g: state.color.rgbow.g,       b: state.color.rgbow.b       }
                    };
    }
  }

  switch (props.state.color.model) {
    case 'rgb':
      rgb = state.color.rgb;

      width = 3;
      pixel = new Buffer(width);
      pixel[0] = rgb.r; pixel[1] = rgb.g; pixel[2] = rgb.b;
      break;

    case 'rgb16':
      if (state.color.model === 'rgb') {
        state.color = { model: 'rgb16', rgb16: { r: state.color.rgb.r<<8, g: state.color.rgb.g<<8, b: state.color.rgb.b<<8 } };
      }
      rgb16 = state.color.rgb16;

      width = 6;
      pixel = new Buffer(width);
      pixel[0] = rgb16.r >> 8;   pixel[1] = rgb16.g >> 8;   pixel[2] = rgb16.b >> 8;
      pixel[3] = rgb16.r & 0xff; pixel[4] = rgb16.g & 0xff; pixel[5] = rgb16.b & 0xff;
      break;

    case 'rgbow':
      if (state.color.model === 'rgb') {
        state.color = { model: 'rgbow', rgbow: { r: state.color.rgb.r, g: state.color.rgb.g, b: state.color.rgb.b,o: 0,w: 0 } };
      }
      rgbow = state.color.rgbow;

      width = 9;
      pixel = new Buffer(width);
      pixel[0] = rgbow.r; pixel[1] = rgbow.g; pixel[2] = rgbow.b;
      pixel[3] = rgbow.o; pixel[4] = rgbow.o; pixel[5] = rgbow.o;
      pixel[6] = rgbow.w; pixel[7] = rgbow.w; pixel[8] = rgbow.w;
      break;

    default:
      return false;
  }

  pixels = new Buffer(self.pixelpusher.pixelsPerStrip * width);
  for (i = offset = 0; i < self.pixelpusher.pixelsPerStrip; i++, offset += width) pixel.copy(pixels, offset);
  self.controller.refresh([ { number: +led, data: pixels } ]);

  self.status = state.on ? 'on' : 'off';
  if (state.on) self.strips[led].state.color = state.color;
  self.changed();
  self.strips[led].updated = self.updated;

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

        case 'rgb16':
          if (!lighting.validRGB16(color.rgb)) result.invalid.push('color.rgb16');
          break;

        case 'rgbow':
          if (!lighting.validRGBOW(color.rgbow)) result.invalid.push('color.rgbow');
          break;

        default:
          result.invalid.push('color.model');
          break;
    }
  }

  return result;
};


var scan = function() {
  var logger2 = utility.logger('discovery');

  new pixelpusher().on('discover', function(controller) {
    var device, info, serialNo;

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
    if (!!devices.devices[info.id]) {
      device = devices.devices[info.id].device;
      if (!!device) device.update(device, controller);
      return;
    }

    logger2.info('UDP ' + info.device.name, { url: info.url });
    devices.discover(info);
  }).on('error', function(err) {
    logger2.error('PixelPusher', { diagnostic: err.message });
  }).logger = logger2;
};


// TBD: add automatic restoration of LED strips

exports.start = function() {
  steward.actors.device.gateway['heroic-robotics'] = steward.actors.device.gateway['heroic-robotics'] ||
      { $info     : { type: '/device/gateway/heroic-robotics' } };

  steward.actors.device.gateway['heroic-robotics'].pixelpusher =
      { $info     : { type       : '/device/gateway/heroic-robotics/pixelpusher'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'ready', 'absent' ]
                                   , nodeID : 'array'
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
                                   , pps        : 'u16'
                                   , color      : { model: [ { rgb         : { r: 'u8',  g: 'u8',  b: 'u8' } }
                                                           ]
                                                  }
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
                                   , pps        : 'u16'
                                   , color      : { model: [ { rgb         : { r: 'u8',   g: 'u8',   b: 'u8'  } }
                                                           , { rgb16       : { r: 'u16',  g: 'u16',  b: 'u16' } }
                                                           ]
                                                  }
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
                                   , pps        : 'u16'
                                   , color      : { model: [ { rgb         : { r: 'u8',  g: 'u8',  b: 'u8' } }
                                                           , { rgbow       : { r: 'u8',  g: 'u8',  b: 'u8'
                                                                             , o: 'u8',  w: 'u8' } }
                                                           ]
                                                  }
                                   }
                    }
      , $validate : { perform    : validate_perform_led }
      };

  scan();
};
