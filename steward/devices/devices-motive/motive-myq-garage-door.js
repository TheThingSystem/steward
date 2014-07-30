// myq - MyQ Smartphone Garage Door Openers: http://www.chamberlain.com/smartphone-control-products/myq-garage/model-myq-g0201

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , motive      = require('./../device-motive')
  ;


var logger = motive.logger;


var GarageDoor = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.myqId = info.myqId;

  self.status = self.initInfo(info.params);
  self.changed();

  self.gateway = info.gateway;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(GarageDoor, motive.Device);


GarageDoor.prototype.update = function(self, params) {
  var status, updateP;

  updateP = false;

  status = params.status;
  delete(params.status);

  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  if (self.updateInfo(params)) updateP = true;

  if (updateP) self.changed();
};

GarageDoor.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  switch (perform) {
    case 'set':
      return devices.perform(self, taskID, perform, parameter);

    case 'open':
    case 'close':
      break;

    default:
      return false;
  }

  if (!self.gateway.myq) return false;

  self.gateway.myq.setDoorState(self.myqId, perform === 'open', function(err) {
    if (!!err) return self.error(self, 'setDoorState', err);

    setTimeout(function () { self.loop(self, self.status, perform === 'open'); }, 1000);
  });

  return steward.performed(taskID);
};

GarageDoor.prototype.error = function(self, event, err) {
  self.status = 'error';
  self.changed();
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
};

GarageDoor.prototype.loop = function(self, initial, openP) {
  self.gateway.myq.getDoorState(self.myqId, function(err, result) {
    if (!!err) return self.error(self, 'getDoorState', err);

    self.update(self, { status     : self.gateway.doorStates[result.state] || 'error'
                      , physical   : result.locattion
                      , lastSample : parseInt(result.updated, 10)
                      });
    if (self.status === 'moving') self.status = openP ? 'opening' : 'closing';
    if ((initial === '')  && (self.status !== 'opening') && (self.status !== 'closing')) return;
    if (self.status !== initial) initial = '';

    setTimeout(function () { self.loop(self, initial, openP); }, 2500);
  });
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  switch (perform) {
    case 'set':
      if (!params.name) result.requires.push('name');
      break;

    case 'open':
    case 'close':
      break;

    default:
      result.invalid.push('perform');
      break;
  }

  return result;
};


exports.start = function() {
  steward.actors.device.motive.myq = steward.actors.device.motive.myq ||
      { $info     : { type: '/device/motive/myq' } };

  steward.actors.device.motive.myq['garage-door'] =
      { $info     : { type       : '/device/motive/myq/garage-door'
                    , observe    : [ ]
                    , perform    : [ 'open', 'close' ]
                    , properties : { name       : true
                                   , status     : [ 'opened', 'closed', 'stopped', 'opening', 'closing', 'error' ]
                                   , physical   : true
                                   , lastSample : 'timestamp'
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/motive/myq/garage-door'] = GarageDoor;
};
