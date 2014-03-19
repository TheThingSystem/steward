// http://www.quirky.com/shop/633-Pivot-Power-Genius

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

  status = self.params.props.powered ? 'on' : 'off';
  if (status !== self.status) {
    self.status = status;
    updateP = true;
  }

  if (updateP) self.changed();
};


OnOff.prototype.perform = function(self, taskID, perform, parameter) {
  var params, powered;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!params.name) return false;
    if (!self.gateway.wink) return false;

// short-ciruit round-trip time to cloud
    self.name = params.name;
    self.changed();
    self.gateway.wink.setDevice(self.params, { name: params.name }, function(err, params) {
      if (!!err) return logger.error('device/' + self.deviceID, { event: 'setDevice', diagnostic: err.message });

      if (!!params) self.update(self, params);
    });

    return steward.performed(taskID);
  }

  if ((perform !== 'on' && perform !== 'off') || perform === self.status) return false;

  powered = perform === 'on' ? true : false;
  logger.info('device/' + self.deviceID, { perform: { on: powered } });
  self.gateway.wink.setOutlet(self.params, { powered : powered }, function(err, params) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'setOutlet', diagnostic: err.message });

    if (!!params) self.update(self, params);
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
  steward.actors.device['switch'].wink = steward.actors.device['switch'].wink ||
      { $info     : { type: '/device/switch/wink' } };

  steward.actors.device['switch'].wink.onoff =
      { $info     : { type       : '/device/switch/wink/onoff'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name     : true
                                   , status   : [ 'on', 'off' ]
                                   , property : true
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/switch/wink/onoff'] = OnOff;
};
