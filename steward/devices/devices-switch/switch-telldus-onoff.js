// Telldus on/off switches

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var OnOff = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = {};
  self.gateway = info.gateway;
  self.status = 'off';
  self.update(self, info.params);

  self.changed();

  broker.subscribe('actors', function(request, eventID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, perform, parameter);
  });
};
util.inherits(OnOff, plug.Device);


OnOff.prototype.update = function(self, params) {
  var status, updateP;

  self.params = params;
  updateP = false;

  if (self.params.name !== self.name) {
    self.name = self.params.name;
    updateP = true;
  }

  status = self.params.online === '0' ? 'absent' : self.params.status;
  if (status !== self.status) {
    self.status = status;
    updateP = true;
  }

  if (updateP) self.changed();
};


OnOff.prototype.perform = function(self, taskID, perform, parameter) {
  var name, params, powered;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!params.name) return false;
    if (!self.gateway.telldus) return false;

// short-ciruit round-trip time to cloud
    name = self.name;
    self.name = params.name;
    self.changed();
    self.gateway.telldus.setDeviceName(self.params, params.name, function(err, results) {
      if ((!err) && (!!results) && (!!results.error)) err = new Error(results.error);
      if (!!err) {
        self.name = name;
        self.changed();
        return logger.error('device/' + self.deviceID, { event: 'setDeviceName', diagnostic: err.message });
      }
    });

    return steward.performed(taskID);
  }

  if (!self.gateway.telldus) return false;
  if ((perform !== 'on' && perform !== 'off') || perform === self.status) return false;
  powered = perform === 'on' ? true : false;

  logger.info('device/' + self.deviceID, { perform: { on: powered } });

  self.gateway.telldus.onOffDevice(self.params, powered, function(err, results) {
    if ((!err) && (!!results) && (!!results.error)) err = new Error(results.error);
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'onOffDevice', diagnostic: err.message });

    self.params.status = powered ? 'on' : 'off';
    self.update(self, self.params);
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
    if ((!params.name) && (!params.physical)) result.requires.push('name');
    return result;
  }

  if (perform !== 'on') result.invalid.push('perform');

  return result;
};


exports.start = function() {
  steward.actors.device['switch'].telldus = steward.actors.device['switch'].telldus ||
      { $info     : { type: '/device/switch/telldus' } };

  steward.actors.device['switch'].telldus.onoff =
      { $info     : { type       : '/device/switch/telldus/onoff'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name     : true
                                   , status   : [ 'on', 'off', 'absent' ]
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/switch/telldus/onoff'] = OnOff;

  steward.actors.device['switch'].nexa = steward.actors.device['switch'].nexa || { $info: { type: '/device/switch/nexa' } };
  steward.actors.device['switch'].nexa.onoff = utility.clone(steward.actors.device['switch'].telldus.onoff);
  steward.actors.device['switch'].nexa.onoff.$info.type = '/device/switch/nexa/onoff';
  devices.makers['/device/switch/nexa/onoff'] = OnOff;
};
