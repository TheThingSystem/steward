// tabu Lumen BLE bulb: http://tabuproducts.com/shop/lumen-bulb/

var lumen
  , utility     = require('./../../core/utility')
  ;

try {
  lumen   = require('node-lumen');
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing tabu-lumen lighting (continuing)', { diagnostic: ex.message });
}

var colorconv   = require('color-convert')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var Lumen = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();
  self.peripheral = info.peripheral;
  self.info = { color      : { model: 'rgb', rgb: { r: 0, g: 0, b: 0 } }
              , brightness : 0
              , rssi       : self.peripheral.rssi
              };


  self.peripheral.on('disconnect', function() {
console.log('>>> ' + self.name + ' callback: disconnect');
    logger.info('device/' + self.deviceID, { status: self.status });
// TBD: handle connection timeout...

    self.lumen = null;
    setTimeout(function() { self.status = 'waiting'; self.changed(); self.connect(self); }, 1 * 1000);
  }).on('rssiUpdate', function(rssi) {
console.log('>>> ' + self.name + ' callback: rssiUpdate rssi='+rssi);
    self.info.rssi = rssi;
    self.refresh(self);
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.refresh(self);
  setInterval(function() { self.heartbeat(self); }, 30 * 1000);
};
util.inherits(Lumen, lighting.Device);


Lumen.prototype.connect = function(self) {
console.log('>>> ' + self.name + ' invoke: connect');
  self.peripheral.connect(function(err) {
    var bulb;

console.log('>>> ' + self.name + ' callback: connect !!err='+ (!!err));
    if (err) return logger.error('device/' + self.deviceID, { event: 'connect', diagnostic: err.message });

console.log('>>> ' + self.name + ' invoke new Lumen()');
    bulb = new lumen(self.peripheral);

console.log('>>> ' + self.name + ' invoke: discoverServicesAndCharacteristics');
    bulb.discoverServicesAndCharacteristics(function(err) {
console.log('>>> ' + self.name + ' callback: discoverServicesAndCharacteristics');
      if (err) return logger.error('device/' + self.deviceID,
                                   { event: 'discoverServicesAndCharacteristics', diagnostic: err.message });

      self.lumen = bulb;
      self.refresh(self);
    });
  });
};

Lumen.prototype.heartbeat = function(self) {
  if (self.status !== 'waiting') self.refresh(self); else self.connect(self);
};

Lumen.prototype.refresh = function(self) {
  if (!self.lumen) return;

console.log('>>> invooke: readDeviceName');
  self.lumen.readDeviceName(function(lightName) {
console.log('>>> callback: readDeviceName lightName='+lightName);
    if (self.name !== lightName) {
      self.name = lightName;
      self.changed();
    }
  });

  self.lumen.readState(function(state) {
    var onoff   = state.on ? 'on' : 'off'
      , states  = { warmWhite: function() {
                                 var brightness = parseInt(state.warmPercentageWhite, 10);

                                 if (isNaN(brightness)) brightness = 1;
                                 if (self.info.brightness !== brightness) {
                                   self.info.brightness = brightness;
                                   updateP = true;
                                 }

                               }
                  , color     : function() {
                                  var rgb = colorconv.cmyk2rgb([ state.colorC * 100
                                                               , state.colorM * 100
                                                               , state.colorY * 100
                                                               , (1.0 - state.colorW) * 100]);

console.log('>>> rgb=' + JSON.stringify(rgb));
                                  if ((self.info.color.rgb.r !== rgb[0])
                                          || (self.info.color.rgb.g !== rgb[1])
                                          || (self.info.color.rgb.b !== rgb[2])) {
                                    self.info.color.rgb = { r: rgb[0], g: rgb[1], b: rgb[2] };
                                    updateP = true;
                                  }
                                }
                  }
      , updateP = false
      ;

console.log('>>> state=' + JSON.stringify(state));
    if (self.status !== onoff) {
      self.status = onoff;
      updateP = true;
    }

    if (states[state.mode]) (states[state.mode])();
    else logger.info('device/' + self.deviceID, { event: 'readState', state: state });

    if (updateP) self.changed();
  });
};


Lumen.prototype.perform = function(self, taskID, perform, parameter) {
  var color, params, refresh, state;

  if (!self.lumen) return false;

  state = { color: self.info.color, brightness: state.info.brightness };
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  refresh = function() { setTimeout (function() { self.refresh(self); }, 0); };

  if (perform === 'set') {
    if (!params.name) return false;

    return self.setName(params.name, taskID);
  }

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    color = params.color;
    if ((!!color) && (color.model === 'rgb') && lighting.validRGB(color.rgb)) {
      state.color = [ color.rgb.r, color.rgb.g, color.rgb.b ];
    }
    if (!!params.brightness) state.brightness = params.brightness;
  }
  if ((state.color[0] === 0) && (state.color[1] === 0) && (state.color[2] === 0)) state.on = false;

  logger.info('device/' + self.deviceID, { perform: state });

  if (!state.on) self.lumen.turnOff(refresh);
  else {
    if ((state.color[0] === 255) && (state.color[1] === 255) && (state.color[2] === 255)) {
      self.lumen.warmWhite(state.brightness, refresh);
    } else {
      self.lumen.turnOn(function() {
        var cmyk = colorconv.rgb2cmyk(state.color);

        self.lumen.color(cmyk[0] / 100, cmyk[1] / 100, cmyk[2] / 100, 1.0 - (cmyk[3] / 100), refresh);
      });
    }
  }

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
        case 'cmyw':
          if (!lighting.validCMYW(color.cmyw)) result.invalid.push('color.cmyw');
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
  steward.actors.device.lighting.tabu = steward.actors.device.lighting.tabu ||
      { $info     : { type: '/device/lighting/tabu' } };

  steward.actors.device.lighting.tabu.lumen =
      { $info     : { type       : '/device/lighting/tabu/lumen'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'on', 'off' ]
                                   , color        : { model: [ { rgb : { r: 'u8',  g: 'u8',  b: 'u8' } }
                                                             , { cmyw : { c : 'percentage'
                                                                        , m : 'percentage'
                                                                        , y : 'percentage'
                                                                        , w : 'percentage'
                                                                        }
                                                               }
                                                             ]
                                                    }
                                   , brightness   : 'percentage'
                                   , rssi         : 's8'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/lighting/tabu/lumen'] = Lumen;

  require('./../../discovery/discovery-ble').register('/device/lighting/tabu/lumen', 'iSmartLight Bough', [ 'fff0' ]);
};
