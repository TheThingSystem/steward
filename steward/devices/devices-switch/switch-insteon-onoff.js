// Insteon ApplianceLinc: http://www.insteon.com/2456s3-appliancelinc.html

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var Insteon = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/switch/insteon/onoff';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'waiting';
  self.gateway = info.gateway;
  self.insteon = info.device.unit.serial;

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
          return self.onoff(self, message.substr(-2));

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
          return self.onoff(self, message.substr(-4));

        default:
          break;
      }
      break;

    default:
      break;
  }
  return logger.warning('device/' + self.deviceID, { event: 'unexpected message', message: message });
};

Insteon.prototype.onoff = function(self, octets) {
  var onoff = (octets !== '00') ? 'on' : 'off';

  if (self.status === onoff) return;

  self.status = onoff;
  return self.changed ();
};


Insteon.prototype.perform = function(self, taskID, perform, parameter) {
  var params, state;

  state = {};
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return self.setName(params.name);

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return;
  else state.on = true;

  logger.info('device/' + self.deviceID, { perform: state });

  self.gateway.roundtrip(self.gateway, '0262' + self.insteon + '00' + (state.on ? '12FF' : '1400'));
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (perform === 'set') {
    if (!parameter) {
      result.requires.push('parameter');
      return result;
    }
    try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

    if (!params.name) result.requires.push('name');
  } else if ((perform !== 'on') && (perform !== 'off')) result.invalid.push('perform');

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
  devices.makers['Insteon.0209'] = Insteon;
  devices.makers['Insteon.022d'] = Insteon;
  devices.makers['Insteon.0230'] = Insteon;
  devices.makers['Insteon.0235'] = Insteon;
  devices.makers['Insteon.0236'] = Insteon;
};
