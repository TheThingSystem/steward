// lockitron - interactive plant care

var Lockitron   = require('lockitron-api')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  ;


var logger   = exports.logger = utility.logger('gateway');


var Cloud = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.status = 'waiting';
  self.elide = [ 'accessToken' ];
  self.changed();
  self.timer = null;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if (!!info.accessToken) self.login(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.login = function(self) {
  self.lockitron = new Lockitron.LockitronAPI({ clientID     : 'n/a'
                                              , clientSecret : 'n/a'
                                              , logger       : utility.logfnx(logger, 'device/' + self.deviceID) }).on('error',
  function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.login(self); }, 30 * 1000);
  }).setState({ accessToken: self.info.accessToken });

  self.status = 'ready';
  self.changed();

  if (!!self.timer) clearInterval(self.timer);
  self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
  self.scan(self);
};

Cloud.prototype.error = function(self, event, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.lockitron) return;

  self.lockitron.roundtrip('GET', '/locks', null, function(err, results) {
    var i, info, lock, params, sensor, udn;

    if (!!err) { self.lockitron = null; return self.error(self, 'roundtrip', err); }

    for (i = 0; i < results.length; i++) {
      lock = results[i].lock;
      udn = 'lockitron:' + lock.id;

      params = { status: lock.status === 'lock' ? 'locked' : 'unlocked' };
      if ((!!lock.latitude) && (!!lock.longitude)) params.location = [ lock.atitude, lock.longitude ];
      if (!!devices.devices[udn]) {
        sensor = devices.devices[udn].device;
        return sensor.update(sensor, params);
      }

      info =  { source: self.deviceID, gateway: self, params: params };
      info.device = { url                          : null
                    , name                         : lock.name
                    , manufacturer                 : 'Lockitron'
                    , model        : { name        : 'Lockitron'
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : lock.id
                                     , udn         : udn
                                     }
                    };

      info.url = info.device.url;
      info.deviceType = '/device/motive/lockitron/lock';
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
      devices.discover(info);
      self.changed();
    }
  });
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if (!!params.accessToken) self.info.accessToken = params.accessToken;
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.accessToken) result.requires.push('accessToken');
  else if ((typeof info.accessToken !== 'string') || (info.accessToken.length !== 64)) result.invalid.push('accessToken');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.accessToken) params.accessToken = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.lockitron = steward.actors.device.gateway.lockitron ||
      { $info     : { type: '/device/gateway/lockitron' } };

  steward.actors.device.gateway.lockitron.cloud =
      { $info     : { type       : '/device/gateway/lockitron/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , accessToken : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/lockitron/cloud'] = Cloud;
};
