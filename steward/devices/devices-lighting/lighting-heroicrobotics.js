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

  self.whatami = info.deviceType;
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

  for (led = 0; led < self.pixelpusher.numberStrips; led++) { self.addchild(self, led); }
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
                     , state   : state
                     , pps     : self.pixelpusher.pixelsPerStrip
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
          , info      : { color: props.state.color, pps: props.pps }
          , deviceID  : props.deviceID
          , updated   : props.updated
          };

  child.proplist = devices.Device.prototype.proplist;

  child.perform = function(strip, taskID, perform, parameter) { return self.perform(self, taskID, perform, parameter, led); };

  return child;
};

PixelPusher.prototype.perform = function(self, taskID, perform, parameter, led) {
  var i, params, pixels, props, state, width;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  props = self.strips[led];
  if (perform === 'set') {
    if (!params.name) return false;

    if (props.name === params.name) return steward.performed(taskID);

    db.run('UPDATE devices SET deviceName=$deviceName WHERE deviceID=$deviceID',
           { $deviceName: params.name, $deviceID : props.deviceID }, function(err) {
      if (err) {
        return logger.error('devices', { event: 'UPDATE device.deviceName for ' + props.deviceID, diagnostic: err.message });
      }

      props.name = params.name;
      props.updated = new Date().getTime();
      self.changed();
    });

    return steward.performed(taskID);
  }

  if (!!props.timer) {
    clearInterval(props.timer);
    props.timer = null;
  }

  if (perform === 'off') {
    width = { rgb: 3, rgb16: 6, rgbow: 9 }[props.state.color.model];
    if (!width) return false;
  } else if (perform === 'pixels') return self.pixels(self, taskID, true, params, led);
  else if (perform === 'program') return self.program(self, taskID, params, led);
  else if (perform !== 'on') return false;
  else {
    state = { color: params.color || props.state.color, pixels: {} };
    state.pixels['0-' + (props.pps - 1)] = state.color[state.color.model];
    return self.pixels(self, taskID, true, { color: { model: state.color.model, pixels: state.pixels } }, led);
  }

  logger.info('device/' + props.deviceID, { on: false });
  pixels = new Buffer(props.pps * width);
  for (i = 0; i < pixels.length; i++) pixels[i] = 0;
  self.controller.refresh([ { number: +led, data: pixels } ]);

  self.strips[led].state.on = false;
  self.strips[led].updated = new Date().getTime();
  self.changed();

  return steward.performed(taskID);
};

/*
  range syntax:
    terms = term [',' terms]
    term  = digits | ( digits '-' digits ( '/' digits )

  e.g.,
    0-79   : 0, 1, ..., 79
    0-78/2 : 0, 2, ..., 78
 */

PixelPusher.prototype.pixels = function(self, taskID, performP, params, led) {
  var black, color, first, i, offset, p, pixel, pixels, props, q, r, rgb, rgb16, rgbow, state, strip, width;

  var set = function(color, lo, hi, dx) {
    lo = parseInt(lo, 10);
    hi = parseInt(hi, 10);
    dx = parseInt(dx, 10);
    if (isNaN(lo) || (lo < 0) || isNaN(hi) || (hi >= strip.length) || (lo > hi) || isNaN(dx) || (dx < 1)) return false;

    for (; lo <= hi; lo += dx) strip[lo] = color;
    return true;
  };

  if ((!params.color) || (!params.color.model) || (!params.color.pixels)) return false;
  state = { on: true, color: params.color };
  black = { rgb   : { r: 0, g: 0, b: 0             }
          , rgb16 : { r: 0, g: 0, b: 0             }
          , rgbow : { r: 0, g: 0, b: 0, o: 0, w: 0 }
          }[state.color.model];
  if (!black) return false;

  props = self.strips[led];
  strip = [];
  for (i = 0; i < props.pps; i++) strip.push(black);

  pixels = state.color.pixels;
  for (pixel in pixels) {
    if (!pixels.hasOwnProperty(pixel)) continue;

    color = pixels[pixel];
    if (!first) first = color;
    switch (state.color.model) {
      case 'rgb':
        if (!lighting.validRGB(color)) return false;
        break;

      case 'rgb16':
        if (!lighting.validRGB16(color)) return false;
        break;

      case 'rgbow':
        if (!lighting.validRGBOW(color)) return false;
        break;
    }
    if (props.state.color.model != state.color.model) {
      if (state.color.model === 'rgb16') {
        color = { r : color.r >> 8, g : color.g >> 8, b : color.b >> 8 };
      } else if (state.color.model === 'rgbow') {
        color = { r: color.r,       g: color.g,       b: color.b       };
      }
        state.color = { model: 'rgb', rgb: color };
    }

    p = pixel.split(',');
    for (i = 0; i < p.length; i++) {
      q = p[i].split('-');
      if (q.length > 2) return false;
      r = q[1].split('/');
      if (!set(color, q[0], r[0], r[1] || 1)) return false;
    }
  }
  if (!first) return false;
  if (!performP) return true;

  switch (props.state.color.model) {
    case 'rgb':
      width = 3;
      pixel = new Buffer(width);
      pixels = new Buffer(strip.length * width);
      for (i = offset = 0; i < strip.length; i++, offset += width) {
        rgb = strip[i];
        if (i === 0) first = rgb;

        pixel[0] = rgb.r; pixel[1] = rgb.g; pixel[2] = rgb.b;
        pixel.copy(pixels, offset);
      }
      break;

    case 'rgb16':
      width = 6;
      pixel = new Buffer(width);
      pixels = new Buffer(strip.length * width);
      for (i = offset = 0; i < strip.length; i++, offset += width) {
        rgb16 = strip[i];
        if (state.color.model === 'rgb') rgb16 = { r: rgb16.r << 8, g: rgb16.g << 8, b: rgb16.b << 8 };
        if (i === 0) first = rgb16;

        pixel[0] = rgb16.r >> 8;   pixel[1] = rgb16.g >> 8;   pixel[2] = rgb16.b >> 8;
        pixel[3] = rgb16.r & 0xff; pixel[4] = rgb16.g & 0xff; pixel[5] = rgb16.b & 0xff;
        pixel.copy(pixels, offset);
      }
      break;

    case 'rgbow':
      width = 9;
      pixel = new Buffer(width);
      pixels = new Buffer(strip.length * width);
      for (i = offset = 0; i < strip.length; i++, offset += width) {
        rgbow = strip[i];
        if (state.color.model === 'rgb') rgbow.o = rgbow.w = 0;
        if (i === 0) first = rgbow;

        pixel[0] = rgbow.r; pixel[1] = rgbow.g; pixel[2] = rgbow.b;
        pixel[3] = rgbow.o; pixel[4] = rgbow.o; pixel[5] = rgbow.o;
        pixel[6] = rgbow.w; pixel[7] = rgbow.w; pixel[8] = rgbow.w;
      }
      break;
  }
  state.color.pixels = {};
  logger.info('device/' + props.deviceID, { perform: state });
  self.controller.refresh([ { number: +led, data: pixels } ]);

  self.strips[led].state.on = true;
  self.strips[led].state.color[props.state.color.model] = first;
  self.strips[led].updated = new Date().getTime();
  self.changed();

  return steward.performed(taskID);
};

var red    = { r: 255, g:   0, b:   0 }
  , orange = { r: 255, g: 165, b:   0 }
  , yellow = { r: 255, g: 255, b:   0 }
  , green  = { r:   0, g: 255, b:   0 }
  , blue   = { r:   0, g:   0, b: 255 }
  , indigo = { r:  75, g:   0, b: 130 }
// , violet = { r: 143, g:   0, b: 255 }
//, black  = { r:   0, g:   0, b:   0 }
//, white  = { r: 255, g: 255, b: 255 }
  , colors = [ red, green, blue, orange, indigo, yellow /* , violet, black, white */ ]
  ;

PixelPusher.prototype.program = function(self, taskID, params, led) {
  var iter, interval, props;

  if ((!!params.pattern) && (params.pattern !== 'spiral')) return false;
  if (!!params.interval) interval = parseInt(params.interval, 10);
  if (isNaN(interval) || (interval < 250)) interval = 250;

  iter = 0;
  props = self.strips[led];
  props.timer = (props.pps === 240) ? setInterval(function() {
    self.pixels(self, taskID, true,
                { color : { model : 'rgb'
                          , pixels: {   '0-25'  : colors[(iter + 14) % colors.length]
                                    ,  '26-47'  : colors[(iter + 13) % colors.length]
                                    ,  '48-68'  : colors[(iter + 12) % colors.length]
                                    ,  '69-88'  : colors[(iter + 11) % colors.length]
                                    ,  '89-107' : colors[(iter + 10) % colors.length]
                                    , '108-125' : colors[(iter +  9) % colors.length]
                                    , '126-142' : colors[(iter +  8) % colors.length]
                                    , '143-158' : colors[(iter +  7) % colors.length]
                                    , '159-173' : colors[(iter +  6) % colors.length]
                                    , '172-185' : colors[(iter +  5) % colors.length]
                                    , '186-198' : colors[(iter +  4) % colors.length]
                                    , '199-210' : colors[(iter +  3) % colors.length]
                                    , '211-222' : colors[(iter +  2) % colors.length]
//                                  , '223-232' : colors[(iter +  1) % colors.length]
//                                  , '233-239' : colors[(iter +  0) % colors.length]
                                    }
                          }
                }, led);
      iter++;
  }, interval) : setInterval(function() {
    var i, len, n, pixels;

    len = props.pps - 1;
    pixels = {};
    n = colors.length;
    for (i = 0; i < colors.length; i++) {
      pixels[i.toString() + '-' + len + '/' + n.toString()] = colors[(iter + i) % colors.length];
    }
    self.pixels(self, taskID, true, { color : { model: 'rgb', pixels: pixels } }, led);
    iter++;
  }, interval);


  return true;
};


var validate_perform_led = function(perform, parameter) {
  var color
    , interval
    , params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'off') return result;

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
    return result;
  }

  if (perform === 'pixels') {
// TBD: figure out how to check this easily...
    return result;
  }

  if (perform === 'program') {
    if ((!!params.pattern) && (params.pattern !== 'spiral')) result.invalid.push('pattern');
    if (!!params.interval) {
      interval = parseInt(params.interval, 10);
      if (isNaN(interval) || (interval < 250)) result.invalid.push('interval');
    }

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
    info.deviceType = '/device/gateway/heroic-robotics/pixelpusher';
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
                    , perform    : [ 'wake' ]
                    , properties : { name   : true
                                   , status : [ 'ready', 'absent' ]
                                   , nodeID : 'array'
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/heroic-robotics/pixelpusher'] = PixelPusher;

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
                    , perform    : [ 'off', 'on', 'pixels' ]
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
