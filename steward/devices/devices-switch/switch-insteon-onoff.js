// Insteon ApplianceLinc: http://www.insteon.com/2456s3-appliancelinc.html

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
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

  if (!self.gateway.roundtrip) self.light = self.gateway.insteon.light(self.insteonID);

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
  if (!self.light) return self.gateway.roundtrip(self.gateway, '0262' + self.insteonID + '001900');

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

  if (perform === 'set') return self.setName(params.name, taskID);

  state = {};
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else state.on = true;

  logger.info('device/' + self.deviceID, { perform: state });

  if (!self.light) {
    self.gateway.roundtrip(self.gateway, '0262' + self.insteonID + '00' + (state.on ? '12FF' : '1400'));
  } else {
    event = state.on ? 'turnOnFast' : 'turnOffFast';
    self.light[event](function(err, results) {/* jshint unused: false */
      if (!!err) return logger.info('device/' + self.deviceID, { event: event, diagnostic: err.message });

      self.onoff(self, state.on);
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

  return result;
};


exports.start = function() {
  var pair;

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

  try {
    pair = require('./../devices-gateway/gateway-insteon-automategreen').pair;

    pair ({ '/device/switch/insteon/onoff' : { maker   :   Insteon_OnOff
                                             , entries : [ '0209', '022d', '0230', '0235', '0236'  ]
                                             }
          });
  } catch(ex) { }
};
