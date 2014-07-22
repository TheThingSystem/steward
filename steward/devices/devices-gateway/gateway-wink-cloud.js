// Wink: http://www.quirky.com

var WinkAPI     = require('node-winkapi')
  , util        = require('util')
  , validator   = require('validator')
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
  self.elide = [ 'clientID', 'clientSecret', 'passphrase' ];
  self.changed();
  self.timer = null;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.email) && (!!info.passphrase)) setTimeout(function() { self.login(self); }, 0);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.login = function(self) {
  self.wink = new WinkAPI.WinkAPI({ clientID     : self.info.clientID
                                  , clientSecret : self.info.clientSecret
                                  , logger       : utility.logfnx(logger, 'device/' + self.deviceID)
                                  }).login(self.info.email, self.info.passphrase, function(err) {
    if (!!err) { self.wink = null; return self.error(self, 'login', err); }

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
    self.scan(self);
  }).on('error', function(err) {
    self.error(self, 'background', err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.login(self); }, 30 * 1000);
  });
};

Cloud.prototype.error = function(self, event, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.wink) return;

  self.wink.getDevices(function(err, results) {
    var device, deviceType, i, info, udn;

    if (!!err) return self.error(self, 'getDevices', err);

    for (i = 0; i < results.length; i++) {
      device = results[i];

      udn = 'wink:' + device.type + ':' + device.id;
      if (!!devices.devices[udn]) continue;

      deviceType = { air_conditioner : '/device/climate/wink/control'
                   , cloud_clock     : '/device/indicator/wink/gauges'
                   , powerstrip      : '/device/switch/wink/strip'
                   , sensor_pod      : '/device/sensor/wink/spotter'
                   }[device.type];
      if (!deviceType) continue;

      info =  { source: self.deviceID, gateway: self, params: device };
      info.device = { url                          : null
                    , name                         : device.name
                    , manufacturer                 : 'Quirky'
                    , model        : { name        : device.type
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : device.id
                                     , udn         : udn
                                     }
                    };
      info.url = info.device.url;
      info.deviceType = deviceType;
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  type: info.params.type });
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
  if (!!params.ikon) self.setIkon(params.ikon);

  if (!!params.clientID) self.info.clientID = params.clientID;
  if (!!params.clientSecret) self.info.clientSecret = params.clientSecret;
  if (!!params.email) self.info.email = params.email;
  if (!!params.passphrase) self.info.passphrase = params.passphrase;
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.clientID) result.requires.push('clientID');
  else if ((typeof info.clientID !== 'string') || (info.clientID.length !== 32)) result.invalid.push('clientID');

  if (!info.clientSecret) result.requires.push('clientSecret');
  else if ((typeof info.clientSecret !== 'string') || (info.clientSecret.length !== 32)) result.invalid.push('clientSecret');

  if (!info.email) result.requires.push('email');
  else {
    try { validator.check(info.email).isEmail(); } catch(ex) { result.invalid.push('email'); }
  }

  if (!info.passphrase) result.requires.push('passphrase');
  else if ((typeof info.passphrase !== 'string') || (info.passphrase.length < 1)) result.invalid.push('passphrase');

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

  if (!params.clientID) params.clientID = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  if (!params.clientSecret) params.clientSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  if (!params.email) params.email = 'nobody@example.com';
  if (!params.passphrase) params.passphrase = ' ';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.wink = steward.actors.device.gateway.wink ||
      { $info     : { type: '/device/gateway/wink' } };

  steward.actors.device.gateway.wink.cloud =
      { $info     : { type       : '/device/gateway/wink/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , clientID     : true
                                   , clientSecret : true
                                   , email        : true
                                   , passphrase   : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/wink/cloud'] = Cloud;

  utility.acquire2(__dirname + '/../*/*-wink-*.js', function(err) {
    if (!!err) logger('wink-cloud', { event: 'glob', diagnostic: err.message });
  });
};
