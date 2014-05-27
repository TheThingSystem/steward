// Telldus Live: http://api.telldus.com

var TelldusAPI  = require('telldus-live')
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
  self.elide = [ 'privateKey', 'tokenSecret' ];
  self.changed();
  self.timer = null;
  self.seen = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.publicKey) && (!!info.privateKey) && (!!info.token) && (!!info.tokenSecret)) {
    setTimeout(function() { self.login(self); }, 0);
  }
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.login = function(self) {
  self.telldus = new TelldusAPI.TelldusAPI({ publicKey    : self.info.publicKey
                                           , privateKey   : self.info.privateKey
                                           , logger       : utility.logfnx(logger, 'device/' + self.deviceID)
                                           }).login(self.info.token, self.info.tokenSecret, function(err, user) {
    if (!!err) { self.telldus = null; return self.error(self, 'login', err); }

    user.event = 'login';
    logger.info('device/' + self.deviceID, user);

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 60 * 1000);
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
  if (!self.telldus) return;

  self.telldus.getDevices(function(err, results) {
    var i;

    if (!!err) return self.error(self, 'getDevices', err);

    for (i = 0; i < results.length; i++) if (results[i].type === 'device') {
      self.telldus.getDeviceInfo(results[i], self.getDevice(self, i));
    }

results = [
{ id: '127952',
  name: 'Ute: Garage/Port',
  state: '2',
  statevalue: '1',
  methods: '19',
  type: 'device',
  protocol: 'arctech',
  model: 'selflearning-dimmer:nexa',
  online: '1',
  editable: 1,
  parameter:
   [ { name: 'house', value: '51002' },
     { name: 'unit', value: '1' } ],
  status: 'off' }
];for (i = 0; i < results.length; i++) (self.getDevice(self, i))(null,results[i]);

  }).getSensors(function(err, results) {
    var i;

    if (!!err) return self.error(self, 'getSensors', err);

    for (i = 0; i < results.length; i++) self.telldus.getSensorInfo(results[i], self.getSensor(self, i));
  });
};

Cloud.prototype.getDevice = function(self, offset) {
  return function(err, params) {
    var device, deviceModel, deviceType, info, manufacturer, udn;

    if (!!err) return logger.error('device/' + self.deviceID, { event: 'getDevice', offset: offset, diagnostic: err.message });

    udn = 'telldus:' + params.type + ':' + params.id;
    if (!!devices.devices[udn]) {
      device = devices.devices[udn].device;
      if (!!device) device.update(device, params);
      return;
    }
    if (!!self.seen[udn]) return;
    self.seen[udn] = true;

    deviceModel = params.model.split(':');
    if (deviceModel.length < 2) {
      return logger.error('device/' + self.deviceID,
                          { event: 'getDevice', offset: offset, diagnostic: 'invalid model: ' + params.model });
    }
    deviceType = { 'selflearning-switch' : 'onoff'
                 , 'selflearning-dimmer' : 'dimmer'
                 , 'codeswitch'          : 'onoff' }[deviceModel[0]];
    if (!deviceType) {
      return logger.warning('device/' + self.deviceID,
                            { event: 'getDevice', offset: offset, diagnostic: 'unknown model: ' + params.model });
    }
    manufacturer = deviceModel[deviceModel.length - 1] || 'telldus';
    deviceType = '/device/switch/' + manufacturer + '/' + deviceType;

    info =  { source: self.deviceID, gateway: self, params: params };
    info.device = { url                          : null
                  , name                         : params.name
                  , manufacturer                 : manufacturer
                  , model        : { name        : params.model
                                   , description : ''
                                   , number      : ''
                                   }
                  , unit         : { serial      : params.id
                                   , udn         : udn
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = deviceType;
    info.id = info.device.unit.udn;

    logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  model: info.device.model });
    devices.discover(info);
    self.changed();
  };
};

Cloud.prototype.getSensor = function(self, offset) {
  return function(err, params) {
    var data, deviceType, i, info, manufacturer, prop, props, proto, sensor, udn, value;

    if (!!err) return logger.error('device/' + self.deviceID, { event: 'getSensor', offset: offset, diagnostic: err.message });

    props =  { temp     : [ 'temperature',   'celcius',    'meteo' ]
             , humidity : [ 'humidity',      'percentage', 'meteo' ]
	     , rrate    : [ 'rainRate',      'mm/h',       'meteo' ]
	     , rtot     : [ 'rainTotal',     'mm',         'meteo' ]
	     , wavg     : [ 'windAverage',   'm/s',        'meteo' ]
	     , wgust    : [ 'windGust',      'm/s',        'meteo' ]
	     , wdir     : [ 'windDirection', 'degrees',    'meteo' ]
             };

    data = { lastSample: params.lastUpdated * 1000 };

    for (i = 0; i < params.data.length; i++) {
      prop = props[params.data[i].name];
      if (!prop) continue;

      if (typeof params.data[i].value === 'string') {
        value = parseInt(params.data[i].value, 10);
        if (!isNaN(value)) params.data[i].value = value;
      }
      data[prop[0]] = params.data[i].value;
    }

    udn = 'telldus:sensor:' + params.id;
    if (!!devices.devices[udn]) {
      sensor = devices.devices[udn].device;
      if (!!sensor) sensor.update(sensor, data, params.online === '0' ? 'absent' : 'present');

      return;
    }
    if (!!self.seen[udn]) return;
    self.seen[udn] = true;

    for (i = 0; i < params.data.length; i++) {
      if (!props[params.data[i].name]) continue;

      prop = props[params.data[i].name];
      break;
    }
    if (!prop) {
      return logger.warning('device/' + self.deviceID,
                            { event: 'getSensor', offset: offset, diagnostic: 'unknown sensor: ' + params.protocol });
    }
    if (params.protocol === 'oregon') params.protocol = 'oregon-scientific';
    manufacturer = params.protocol || 'tellus';
    deviceType = '/device/climate/' + manufacturer + '/' + prop[2];

    proto = steward.actors.device.climate[manufacturer];
    if (!!proto) proto = proto[prop[2]];
    if (!!proto) proto = proto.$info.properties;
    if (!!proto) {
      for (i = 0; i < params.data.length; i++) {
        prop =  props[params.data[i].name];
        if (!!prop) proto[prop[0]] = prop[1];
      }
    }

    data.status = params.online === '0' ? 'absent' : 'present';

    info =  { source: self.deviceID, gateway: self, params: data };
    info.device = { url                          : null
                  , name                         : params.name
                  , manufacturer                 : manufacturer
                  , model        : { name        : params.protocol
                                   , description : ''
                                   , number      : ''
                                   }
                  , unit         : { serial      : params.id
                                   , udn         : udn
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = deviceType;
    info.id = info.device.unit.udn;

    logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  model: info.device.model });
    devices.discover(info);
    self.changed();
  };
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if (!!params.publicKey) self.info.publicKey = params.publicKey;
  if (!!params.privateKey) self.info.privateKey = params.privateKey;
  if (!!params.token) self.info.token = params.token;
  if (!!params.tokenSecret) self.info.tokenSecret = params.tokenSecret;
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.publicKey) result.requires.push('publicKey');
  else if ((typeof info.publicKey !== 'string') || (info.publicKey.length !== 32)) result.invalid.push('publicKey');

  if (!info.privateKey) result.requires.push('privateKey');
  else if ((typeof info.privateKey !== 'string') || (info.privateKey.length !== 32)) result.invalid.push('privateKey');

  if (!info.token) result.requires.push('token');
  else if ((typeof info.token !== 'string') || (info.token.length === 0)) result.invalid.push('token');

  if (!info.tokenSecret) result.requires.push('tokenSecret');
  else if ((typeof info.tokenSecret !== 'string') || (info.tokenSecret.length != 32)) result.invalid.push('tokenSecret');

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

  if (!params.publicKey) params.publicKey = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  if (!params.privateKey) params.privateKey = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  if (!params.token) params.token = ' ';
  if (!params.tokenSecret) params.tokenSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway['telldus-live'] = steward.actors.device.gateway['telldus-live'] ||
      { $info     : { type: '/device/gateway/telldus-live' } };

  steward.actors.device.gateway['telldus-live'].cloud =
      { $info     : { type       : '/device/gateway/telldus-live/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , publicKey    : true
                                   , privateKey   : true
                                   , token        : true
                                   , tokenSecret  : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/telldus-live/cloud'] = Cloud;

  utility.acquire2(__dirname + '/../*/*-telldus-*.js', function(err) {
    if (!!err) logger('telldus-live-cloud', { event: 'glob', diagnostic: err.message });
  });
};
