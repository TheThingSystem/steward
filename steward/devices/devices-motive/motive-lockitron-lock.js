// lockitron - Keyless entry using your phone: http://lockitron.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , motive      = require('./../device-motive')
  ;


var logger = motive.logger;


var Lock = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.serial = info.device.unit.serial;

  self.status = self.initInfo(info.params);
  self.changed();

  self.gateway = info.gateway;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Lock, motive.Device);


Lock.prototype.update = function(self, params, status) {
  var updateP = false;

  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  if (self.updateInfo(params)) updateP = true;

  if (updateP) self.changed();
};

Lock.prototype.webhook = function(self, event, data) {
  var activity, f, g, outcome;

  g = function(status) {
    var now = new Date();

    self.status = status;
    self.info.lastSample = now.getTime();
    self.changed(now);
  };

  try {
    activity = data.activity;
    outcome = activity.kind || activity.human_type;

    f = { error  : function() {
                     if (outcome !== 'lock-offline') {
                       return logger.error('device/' + self.deviceID, { event: event, diagnostic: outcome });
                     }

                     g('absent');
                   }
        , notice : function() {
                     if (outcome.indexOf('lock-updated-') !== 0) {
                       return logger.warning('device/' + self.deviceID, { event: event, data: data });
                     }

                     g(outcome === 'lock-updated-locked' ? 'locked' : 'unlocked');
                   }
        }[activity.status || activity.human_outcome];
    if (!f) throw new Error('unknown activity status');
    f();
  } catch(ex) {
    logger.error('device/' + self.deviceID, { event: event, diagnostic: ex.message, data: data });
  }
};

Lock.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  switch (perform) {
    case 'set':
      return self.setName(params.name, taskID);

    case 'lock':
    case 'unlock':
      break;

    default:
      return false;
  }

  if (!self.gateway.lockitron) return false;

  self.gateway.lockitron.roundtrip('GET', '/locks/' + self.serial + '/' + perform, null, function(err, results) {
    if (!!err) {
      self.status = 'error';
      self.changed();
      return logger.error('device/' + self.deviceID, { event: perform, diagnostic: err.message });
    }

    self.webhook(self, perform, results);
  });

  return steward.performed(taskID);
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

    case 'lock':
    case 'unlock':
      break;

    default:
      result.invalid.push('perform');
      break;
  }

  return result;
};


exports.start = function() {
  steward.actors.device.motive.lockitron = steward.actors.device.motive.lockitron ||
      { $info     : { type: '/device/motive/lockitron' } };

  steward.actors.device.motive.lockitron.lock =
      { $info     : { type       : '/device/motive/lockitron/lock'
                    , observe    : [ ]
                    , perform    : [ 'lock', 'unlock' ]
                    , properties : { name       : true
                                   , status     : [ 'locked', 'unlocked', 'absent', 'error' ]
                                   , location   : 'coordinates'
                                   , lastSample : 'timestamp'
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/motive/lockitron/lock'] = Lock;
};
