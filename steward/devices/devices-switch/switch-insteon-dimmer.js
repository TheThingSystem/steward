// Insteon LampLinc: http://www.insteon.com/2457D2-lamplinc-dual-band.html

var pair
  , utility     = require('./../../core/utility')
  ;

try {
  pair = require('./../devices-gateway/gateway-insteon-automategreen').pair;
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing insteon-dimmer switch (continuing)', { diagnostic: ex.message });
}

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var Insteon_Dimmer = exports.Device = function(deviceID, deviceUID, info) {
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
  self.info = {};

  self.light = self.gateway.insteon.light(self.insteonID);

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if (!!self.gateway.upstream) self.gateway.upstream[self.insteonID] = self;
  self.refresh(self);
  setInterval(function() { self.refresh(self); }, 30 * 1000);
};
util.inherits(Insteon_Dimmer, plug.Device);


Insteon_Dimmer.prototype.refresh = function(self) {
  self.light.level(function(err, level) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'light.level', diagnostic: err.message });

    self.level(self, level);
  });
};

Insteon_Dimmer.prototype.callback = function(self, messageType, message) {
  switch (message.substr(0, 4)) {
    case '0250':
      switch (message.substr(message.length - 6, 2)) {
        case '20':
          return self.level(self, devices.percentageValue(parseInt(message.substr(-2), 16), 255));

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
          return self.level(self, devices.percentageValue(parseInt(message.substr(-4), 16), 255));

        default:
          break;
      }
      break;

    default:
      break;
  }
  return logger.warning('device/' + self.deviceID, { event: 'unexpected message', message: message });
};

Insteon_Dimmer.prototype.level = function(self, level) {
  level = devices.boundedValue(level, 0, 100);

  if (level === 0) {
    if ((self.status === 'off') && (self.info.level === level)) return;

    self.status = 'off';
    self.info.level = 0;
    return self.changed ();
  }

  if ((self.status === 'on') && (self.info.level === level)) return;

  self.status = 'on';
  self.info.level = level;
  return self.changed ();
};


var insteonLevel = function(pct) {
  return ('0' + devices.scaledPercentage(pct, 1,  255).toString(16)).substr(-2);
};

Insteon_Dimmer.prototype.perform = function(self, taskID, perform, parameter) {
  var params, state;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return self.setName(params.name, taskID);

  state = {};
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    if (!params.level) params.level = self.info.level;
    if ((!plug.validLevel(params.level)) || (params.level === 0)) params.level = 100;
    state.level = insteonLevel(params.level);
  }

  logger.info('device/' + self.deviceID, { perform: state });

  if (state.on) {
    self.light.turnOn(params.level, function(err, results) {/* jshint unused: false */
      if (!!err) return logger.info('device/' + self.deviceID, { event: 'turnOn', diagnostic: err.message });

      self.level(self, params.level);
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

  if (perform !== 'on') result.invalid.push('perform');

  if ((!!params.level) && (!plug.validLevel(params.level))) result.invalid.push('level');

  return result;
};


exports.start = function() {
  steward.actors.device['switch'].insteon = steward.actors.device['switch'].insteon ||
      { $info     : { type: '/device/switch/insteon' } };

  steward.actors.device['switch'].insteon.dimmer =
      { $info     : { type       : '/device/switch/insteon/dimmer'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , level      : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
// other Insteon devices corresponding to a dimmable switch may also be listed here...
  devices.makers['Insteon.0100'] = Insteon_Dimmer;
  devices.makers['Insteon.010e'] = Insteon_Dimmer;
  devices.makers['Insteon.010f'] = Insteon_Dimmer;
  devices.makers['Insteon.0111'] = Insteon_Dimmer;
  devices.makers['Insteon.0112'] = Insteon_Dimmer;
  devices.makers['Insteon.01ef'] = Insteon_Dimmer;
  devices.makers['Insteon.0120'] = Insteon_Dimmer;

  pair ({ '/device/switch/insteon/dimmer'      : { maker   : Insteon_Dimmer
                                                 , entries : [ '0100', '010e', '010f', '0111', '0112', '01ef', '0120'  ]
                                                 }
        });
};
