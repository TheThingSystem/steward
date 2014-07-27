// yo - http://www.justyo.co

var YoAPI       = require('yoapi')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  ;


var logger = indicator.logger;


var Yo = exports.Device = function(deviceID, deviceUID, info) {
  var self = this ;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.yo = new YoAPI({ api_token: self.info.apikey });
  self.status = 'ready';
  self.elide = [ 'apikey' ];
  self.changed();

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'attention') {
      if (self.status === 'error') self.alert('please check login credentials at https://prowlapp.com/');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Yo, indicator.Device);


Yo.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) {
      self.setName(params.name);
      delete(params.name);
    }
    if (!!params.ikon) {
      self.setIkon(params.ikon);
      delete(params.ikon);
    }
    if (self.updateInfo(params)) self.setInfo();

    return true;
  }

  var callback = function(err, data) {/* jshint unused: false */
    if (!!err) {
      self.status = 'error';
      self.changed();
      return logger.error('device/' + self.deviceID, { diagnostic: err.message });
    }

    if (self.status !== 'ready') {
      self.status = 'ready';
      self.changed();
    }
  };

  if (perform !== 'ping') return false;

  if (!!params.recipient) self.yo.yo(params.recipient, callback); else self.yo.yoAll(callback);

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.apikey) result.requires.push('apikey');
  else if ((typeof info.apikey !== 'string') || (info.apikey.length !== 36)) result.invalid.push('apikey');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if (!params.apikey) params.apikey = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    return validate_create(params);
  }

  if (perform !== 'ping') {
    result.invalid.push('perform');
    return result;
  }

  return result;
};


exports.start = function() {
  steward.actors.device.indicator.yo = steward.actors.device.indicator.yo ||
      { $info     : { type: '/device/indicator/yo' } };

  steward.actors.device.indicator.yo['1bit'] =
      { $info     : { type       : '/device/indicator/yo/1bit'
                    , observe    : [ ]
                    , perform    : [ 'ping' ]
                    , properties : { name     : true
                                   , status   : [ 'ready', 'error' ]
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/yo/1bit'] = Yo;
};
