// Insteon ApplianceLinc: http://www.insteon.com/2456s3-appliancelinc.html

var pair
  , utility     = require('./../../core/utility')
  ;

try {
  pair = require('./../devices-gateway/gateway-insteon-automategreen').pair;
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing insteon-onoff switch (continuing)', { diagnostic: ex.message });
}

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var Insteon_OnOff = exports.Device = function(deviceID, deviceUID, info) {
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
util.inherits(Insteon_OnOff, plug.Device);


Insteon_OnOff.prototype.refresh = function(self) {
  self.light.level(function(err, brightness) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'light.level', diagnostic: err.message });

    self.onoff(self, brightness > 0);
  });
};

Insteon_OnOff.prototype.callback = function(self, messageType, message) {
  switch (message.substr(0, 4)) {
    case '0250':
      switch (message.substr(message.length - 6, 2)) {
        case '20':
          return self.onoff(self, message.substr(-2) !== '00');

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
          return self.onoff(self, message.substr(-4) !== '00');

        default:
          break;
      }
      break;

    default:
      break;
  }
  return logger.warning('device/' + self.deviceID, { event: 'unexpected message', message: message });
};

Insteon_OnOff.prototype.onoff = function(self, onoff) {
  onoff = onoff ? 'on' : 'off';

  if (self.status === onoff) return;

  self.status = onoff;
  return self.changed ();
};


Insteon_OnOff.prototype.perform = function(self, taskID, perform, parameter) {
  var event, params, state;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return devices.perform(self, taskID, perform, parameter);

  state = {};
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else state.on = true;

  logger.info('device/' + self.deviceID, { perform: state });

  event = state.on ? 'turnOnFast' : 'turnOffFast';
  self.light[event](function(err, results) {/* jshint unused: false */
    if (!!err) return logger.info('device/' + self.deviceID, { event: event, diagnostic: err.message });

    self.onoff(self, state.on);
  });
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

  return result;
};


exports.start = function() {
  steward.actors.device['switch'].insteon = steward.actors.device['switch'].insteon ||
      { $info     : { type: '/device/switch/insteon' } };

  steward.actors.device['switch'].insteon.onoff =
      { $info     : { type       : '/device/switch/insteon/onoff'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name   : true
                                   , status : [ 'waiting', 'on', 'off' ]
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
// other Insteon devices corresponding to an on/off switch may also be listed here...
  devices.makers['Insteon.0209'] = Insteon_OnOff;
  devices.makers['Insteon.022d'] = Insteon_OnOff;
  devices.makers['Insteon.0230'] = Insteon_OnOff;
  devices.makers['Insteon.0235'] = Insteon_OnOff;
  devices.makers['Insteon.0236'] = Insteon_OnOff;
  devices.makers['Insteon.0237'] = Insteon_OnOff;
  devices.makers['Insteon.0238'] = Insteon_OnOff;

  pair ({ '/device/switch/insteon/onoff' : { maker   :   Insteon_OnOff
                                           , entries : [ '0209', '022d', '0230', '0235', '0236', '0237', '0238' ]
                                           }
        });
};
