// lockitron - interactive plant care: http://www.lockitron.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , motive     = require('./../device-motive')
  ;


// var logger = motive.logger;


var Lock = exports.Device = function(deviceID, deviceUID, info) {
  var param, self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = {};
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }

  self.status = 'present';
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Lock, motive.Device);


Lock.prototype.update = function(self, params, status) {
  var param, updateP;

  updateP = false;
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }
  if (updateP) self.changed();
};


Lock.prototype.perform = function(self, taskID, perform, parameter) {
  var f, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  f = null;
  switch (perform) {
    case 'set':
      return self.setName(params.name, taskID);

/* NOT YET
    case 'lock':
      break;

    case 'unlock':
      break;
 */

    default:
      return false;
  }

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
      break;

    case 'unlock':
      break;

    default:
      result.requires.push('perform');
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
                                   , status     : [ 'locked', 'unlocked', 'absent' ]
                                   , location   : 'coordinates'
                                   , lastSample : 'timestamp'
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/motive/lockitron/lock'] = Lock;
};
