var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var Clipboard = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  return true;
};
util.inherits(Clipboard, devices.Device);


Clipboard.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  if (perform !== 'set') return false;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!!params.name) self.setName(params.name);

  if ((!!params.value) && (self.info.value !== params.value)) {
    self.info.value = params.value;
    self.setInfo();
  }

  return steward.performed(taskID);
};


var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.value) result.requires.push('value');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }

  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if ((!params.name) && (!params.value)) result.requires.push('value');

  return result;
};


// NB: used for .condition events only (no traps)

exports.start = function() {
  steward.actors.clipboard =
      { $info     : { type       : '/clipboard'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , value       : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/clipboard'] = Clipboard;
};
