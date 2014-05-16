// Insteon LED bulb: http://www.insteon.com/bulb.html

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var Insteon_LED = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();
  self.gateway = info.gateway;
  self.insteonID = info.device.unit.serial;
  self.info = { color: { model: 'rgb', rgb: { r: 255, g: 255, b: 255 }, fixed: true } };

  if (!self.gateway.roundtrip) self.light = self.gateway.insteon.light(self.insteonID);

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if (!!self.gateway.upstream) self.gateway.upstream[self.insteonID] = self;
  self.refresh(self);
  setInterval(function() { self.refresh(self); }, 30 * 1000);
};
util.inherits(Insteon_LED, lighting.Device);


Insteon_LED.prototype.refresh = function(self) {
  if (!self.light) return self.gateway.roundtrip(self.gateway, '0262' + self.insteonID + '001900');

  self.light.level(function(err, brightness) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'light.level', diagnostic: err.message });

    self.brightness(self, brightness);
  });
};

Insteon_LED.prototype.callback = function(self, messageType, message) {
  switch (message.substr(0, 4)) {
    case '0250':
      switch (message.substr(message.length - 6, 2)) {
        case '20':
          return self.brightness(self, devices.percentageValue(parseInt(message.substr(-2), 16), 255));

        default:
          break;
      }
      break;

    case '0262':
      if (message.substr(-2) !== '06') {
        return logger.error('device/' + self.deviceID, { event: 'request failed', response: message });
      }

      switch (message.substr(message.length - 8, 4)) {
        case '0011':
        case '0013':
          return self.brightness(self, devices.percentageValue(parseInt(message.substr(-4), 16), 255));

        default:
          break;
      }
      break;

    default:
      break;
  }
  return logger.warning('device/' + self.deviceID, { event: 'unexpected message', message: message });
};

Insteon_LED.prototype.brightness = function(self, brightness) {
  brightness = devices.boundedValue(brightness, 0, 100);

  if (brightness === 0) {
    if ((self.status === 'off') && (self.info.brightness === brightness)) return;

    self.status = 'off';
    self.info.brightness = 0;
    return self.changed ();
  }

  if ((self.status === 'on') && (self.info.brightness === brightness)) return;

  self.status = 'on';
  self.info.brightness = brightness;
  return self.changed ();
};


var insteonBrightness = function(pct) {
  return ('0' + devices.scaledPercentage(pct, 1,  255).toString(16)).substr(-2);
};

Insteon_LED.prototype.perform = function(self, taskID, perform, parameter) {
  var params, state;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return self.setName(params.name, taskID);

  state = {};
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    if (!params.brightness) params.brightness = self.info.brightness;
    if ((!lighting.validBrightness(params.brightness)) || (params.brightness === 0)) params.brightness = 100;
    state.brightness = insteonBrightness(params.brightness);
  }

  logger.info('device/' + self.deviceID, { perform: state });

  if (!self.light) {
    self.gateway.roundtrip(self.gateway, '0262' + self.insteonID + '00' + (state.on ? ('11' + state.brightness) : '1300'));
  } else if (state.on) {
    self.light.turnOn(params.brightness, function(err, results) {/* jshint unused: false */
      if (!!err) return logger.info('device/' + self.deviceID, { event: 'turnOn', diagnostic: err.message });

      self.brightness(self, params.brightness);
    });
  } else {
    self.light.turnOffFast(function(err, results) {/* jshint unused: false */
      if (!!err) return logger.info('device/' + self.deviceID, { event: 'turnOffFast', diagnostic: err.message });

      if (self.status !== 'off') {
        self.status = 'off';
        self.changed();
      }
    });
  }
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

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

  if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) result.invalid.push('brightness');

  return result;
};


exports.start = function() {
  var pair;

  steward.actors.device.lighting.insteon = steward.actors.device.lighting.insteon ||
      { $info     : { type: '/device/lighting/insteon' } };

  steward.actors.device.lighting.insteon.bulb =
      { $info     : { type       : '/device/lighting/insteon/bulb'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
// other Insteon devices corresponding to a single dimmable bulb may also be listed here...
  devices.makers['Insteon.013a'] = Insteon_LED;
  devices.makers['Insteon.013b'] = Insteon_LED;
  devices.makers['Insteon.013c'] = Insteon_LED;
  devices.makers['Insteon.014c'] = Insteon_LED;
  devices.makers['Insteon.014d'] = Insteon_LED;
  devices.makers['Insteon.0151'] = Insteon_LED;

  steward.actors.device.lighting.insteon.downlight = utility.clone(steward.actors.device.lighting.insteon.bulb);
  steward.actors.device.lighting.insteon.downlight.$info.type = '/device/lighting/insteon/downlight';
  devices.makers['Insteon.0149'] = Insteon_LED;
  devices.makers['Insteon.014a'] = Insteon_LED;
  devices.makers['Insteon.014b'] = Insteon_LED;
  devices.makers['Insteon.014e'] = Insteon_LED;
  devices.makers['Insteon.014f'] = Insteon_LED;


  try {
    pair = require('./../devices-gateway/gateway-insteon-automategreen').pair;

    pair ({ '/device/lighting/insteon/bulb'      : { maker   : Insteon_LED
                                                   , entries : [ '013a', '013b', '013c', '014c', '014d', '0151'  ]
                                                   }
          , '/device/lighting/insteon/downlight' : { maker   : Insteon_LED
                                                   , entries : [ '0149', '014a', '014b', '014e', '014f'          ]
                                                   }
          });
  } catch(ex) { }
};
