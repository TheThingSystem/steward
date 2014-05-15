// Telldus dimmer switches

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var Dimmer = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = { level: '0' };
  self.gateway = info.gateway;
  self.status = 'off';
  self.update(self, info.params);

  self.changed();

  broker.subscribe('actors', function(request, eventID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, perform, parameter);
  });
};
util.inherits(Dimmer, plug.Device);


Dimmer.prototype.update = function(self, params) {
  var level, status, updateP;

  self.params = params;
  updateP = false;

  if (self.params.name !== self.name) {
    self.name = self.params.name;
    updateP = true;
  }

  status = self.params.online === '0' ? 'absent' : self.params.status;

  if (status === 'dim') {
    level = Math.round((1 - (255 - self.params.statevalue) / 255) * 100);
    status = level > 0 ? 'on' : 'off';
    if (level !== self.info.level) {
      self.info.level = level;
      updateP = true;
    }
  }

  if (status !== self.status) {
    self.status = status;
    updateP = true;
  }

  if (updateP) self.changed();
};


Dimmer.prototype.perform = function(self, taskID, perform, parameter) {
  var level, name, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!params.name) return false;
    if (!self.gateway.telldus) return false;

// short-ciruit round-trip time to cloud
    self.name = params.name;
    self.changed();
    self.gateway.telldus.setDeviceName(self.params, params.name, function(err, results) {
      if ((!err) && (!!results) && (!!results.error)) err = new Error(results.error);
      if (!!err) {
        name = self.name;
        self.changed();
        return logger.error('device/' + self.deviceID, { event: 'setDeviceName', diagnostic: err.message });
      }
    });

    return steward.performed(taskID);
  }

  if (!self.gateway.telldus) return false;

  if ((perform !== 'on' && perform !== 'off') || perform === self.status) return false;

console.log('>>> telldus previous setting ' + JSON.stringify({ status: self.params.status, level: self.params.statevalue }));
console.log('>>> dimmer  previous setting ' + JSON.stringify({ status: self.status, level: self.info.level }));
  if (perform === 'off') params.level = 0;
  else if (perform === 'on') {
    if (!params.level) params.level = self.info.level;
    if ((!plug.validLevel(params.level)) || (params.level === 0)) params.level = 100;
  }
  level = devices.scaledPercentage(params.level, 0, 255);

  logger.info('device/' + self.deviceID, { perform: { level: params.level } });

console.log('>>> dimmer perform command ' + JSON.stringify({ perform: perform, level: level }));
  self.gateway.telldus.dimDevice(self.params, level, function(err, results) {
    if ((!err) && (!!results) && (!!results.error)) err = new Error(results.error);
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'dimDevice', diagnostic: err.message });

    self.params.status = level > 0 ? 'on' : 'off';
    if (perform === 'on') self.params.statevalue = level;
console.log('>>> telldus current  setting ' + JSON.stringify({ status: self.params.status, level: self.params.statevalue }));
    self.update(self, self.params);
console.log('>>> dimmer  current  setting ' + JSON.stringify({ status: self.status, level: self.info.level }));
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

  if ((!!params.level) && (!plug.validLevel(params.level))) result.invalid.push('level');

  return result;
};


exports.start = function() {
  steward.actors.device['switch'].telldus = steward.actors.device['switch'].telldus ||
      { $info     : { type: '/device/switch/telldus' } };

  steward.actors.device['switch'].telldus.dimmer =
      { $info     : { type       : '/device/switch/telldus/dimmer'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name     : true
                                   , status   : [ 'on', 'off', 'absent' ]
                                   , level    : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/switch/telldus/dimmer'] = Dimmer;

  steward.actors.device['switch'].nexa = steward.actors.device['switch'].nexa || { $info: { type: '/device/switch/nexa' } };
  steward.actors.device['switch'].nexa.dimmer = utility.clone(steward.actors.device['switch'].telldus.dimmer);
  steward.actors.device['switch'].nexa.dimmer.$info.type = '/device/switch/nexa/dimmer';
  devices.makers['/device/switch/nexa/dimmer'] = Dimmer;
};
