// CubeSensors: https://my.cubesensors.com/docs

var CubeSensors = require('cubesensors-cloud')
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
  self.elide = [ 'consumerKey', 'consumerSecret', 'token', 'tokenSecret' ];
  self.changed();
  self.timer = null;
  self.seen = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.consumerKey) && (!!info.consumerSecret) && (!!info.token) && (!!info.tokenSecret)) {
    setTimeout(function() { self.authorize(self); }, 0);
  }
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.authorize = function(self) {
  self.cloud = new CubeSensors.CubeSensorsAPI({ consumerKey       : self.info.consumerKey
                                              , consumerSecret    : self.info.consumerSecret
                                              , oAuthAccessToken  : self.info.token
                                              , oAuthAccessSecret : self.info.tokenSecret
                                              , logger            : utility.logfnx(logger, 'device/' + self.deviceID)
                                              }).authorize(function(err, state) {/* jshint unused: false */
    if (!!err) { self.cloud = null; return self.error(self, 'authorize', err); }

    self.status = 'ready';
    self.changed();
    self.setInfo();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 600 * 1000);
    self.scan(self);
  }).on('error', function(err) {
    self.error(self, 'background', err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.authorize(self); }, 30 * 1000);
  });
};

Cloud.prototype.error = function(self, event, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.cloud) return;

  self.cloud.getDevices(function(err, results) {
    var changedP, device, deviceType, i, info, udn;

    if (!!err) return self.error(self, 'getDevices', err);

    changedP = false;

    for (i = 0; i < results.length; i++) {
      device = results[i];
      udn = 'cubesensors:' + device.uid;
      if (!!devices.devices[udn]) continue;
      if (!!self.seen[udn]) return;
      self.seen[udn] = true;

      deviceType = { cube: '/device/climate/cubesensors/meteo' }[device.type];
      if (!deviceType) {
        return logger.warning('device/' + self.deviceID,
                              { event: 'getDevice', uid: device.uid, diagnostic: 'unknown type: ' + device.type });
      }

      info =  { source: self.deviceID, gateway: self, params: device };
      info.device = { url                          : null
                    , name                         : device.name
                    , manufacturer                 : 'Cube Sensors'
                    , model        : { name        : device.type
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : device.uid
                                     , udn         : udn
                                     }
                    };
      info.url = info.device.url;
      info.deviceType = deviceType;
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID,
                  { name: info.device.name, id: info.device.unit.serial,  model: info.device.model });
      devices.discover(info);
    }

    if (changedP) self.changed();
  });
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if (!!params.consumerKey) self.info.consumerKey = params.consumerKey;
  if (!!params.consumerSecret) self.info.consumerSecret = params.consumerSecret;
  if (!!params.token) self.info.token = params.token;
  if (!!params.tokenSecret) self.info.tokenSecret = params.tokenSecret;
  self.authorize(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.consumerKey) result.requires.push('consumerKey');
  else if ((typeof info.consumerKey !== 'string') || (info.consumerKey.length !== 20)) result.invalid.push('consumerKey');

  if (!info.consumerSecret) result.requires.push('consumerSecret');
  else if ((typeof info.consumerSecret !== 'string') || (info.consumerSecret.length !== 24)) result.invalid.push('consumerSecret');

  if (!info.token) result.requires.push('token');
  else if ((typeof info.token !== 'string') || (info.token.length !== 12)) result.invalid.push('token');

  if (!info.tokenSecret) result.requires.push('tokenSecret');
  else if ((typeof info.tokenSecret !== 'string') || (info.tokenSecret.length != 16)) result.invalid.push('tokenSecret');

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

  if (!params.consumerKey) params.consumerKey = 'XXXXXXXXXXXXXXXXXXXX';
  if (!params.consumerSecret) params.consumerSecret = 'XXXXXXXXXXXXXXXXXXXXXXXX';
  if (!params.token) params.token = 'XXXXXXXXXXXX';
  if (!params.tokenSecret) params.tokenSecret = 'XXXXXXXXXXXXXXXX';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.cubesensors = steward.actors.device.gateway.cubesensors ||
      { $info     : { type: '/device/gateway/cubesensors' } };

  steward.actors.device.gateway.cubesensors.cloud =
      { $info     : { type       : '/device/gateway/cubesensors/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name           : true
                                   , status         : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , consumerKey    : true
                                   , consumerSecret : true
                                   , token          : true
                                   , tokenSecret    : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/cubesensors/cloud'] = Cloud;

  utility.acquire2(__dirname + '/../*/*-cubesensors-*.js', function(err) {
    if (!!err) logger('cubesensors-cloud', { event: 'glob', diagnostic: err.message });
  });
};
