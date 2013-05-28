// Insteon LampLinc: http://www.insteon.com/2457D2-lamplinc-dual-band.html

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var Insteon = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/switch/insteon/dimmer';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'waiting';
  self.gateway = info.gateway;
  self.insteon = info.device.unit.serial;
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'ping') {
      logger.info('device/' + self.deviceID, { status: self.status });
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') self.perform(self, taskID, perform, parameter);
  });

  self.gateway.upstream[self.insteon] = self;
  self.refresh(self);
  setInterval(function() { self.refresh(self); }, 30 * 1000);
};
util.inherits(Insteon, plug.Device);


Insteon.prototype.refresh = function(self) {
  self.gateway.roundtrip(self.gateway, '0262' + self.insteon + '001900');
};

Insteon.prototype.callback = function(self, messageType, message) {
  switch (message.substr(0, 4)) {
    case '0250':
      switch (message.substr(message.length - 6, 2)) {
        case '20':
          return self.level(self, message.substr(-2));

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
          return self.level(self, message.substr(-4));

        default:
          break;
      }
      break;

    default:
      break;
  }
  return logger.warning('device/' + self.deviceID, { event: 'unexpected message', message: message });
};

Insteon.prototype.level = function(self, lvl) {
  var level = devices.percentageValue(parseInt(lvl, 16), 255);

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

Insteon.prototype.perform = function(self, taskID, perform, parameter) {
  var params, state;

  state = {};
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return self.setName(params.name);

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return;
  else {
    state.on = true;

    if (!params.level) params.level = self.info.level;
    if (params.level <= 0) params.level = 100;
    state.level = insteonLevel(params.level);
  }

  logger.info('device/' + self.deviceID, { perform: state });

  self.gateway.roundtrip(self.gateway, '0262' + self.insteon + '00' + (state.on ? ('11' + state.level) : '1300'));
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
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
  devices.makers['Insteon.010e'] = Insteon;
  devices.makers['Insteon.010f'] = Insteon;
  devices.makers['Insteon.0111'] = Insteon;
  devices.makers['Insteon.0112'] = Insteon;
  devices.makers['Insteon.01ef'] = Insteon;
};
