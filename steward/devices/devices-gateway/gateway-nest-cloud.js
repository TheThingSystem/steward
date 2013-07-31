// Nest - the learning thermostat: http://nest.com

var events      = require('events')
  , nest        = require('unofficial-nest-api')
  , util        = require('util')
  , validator   = require('validator')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  ;


var logger   = exports.logger = utility.logger('gateway');

var macaddrs = {};


var Cloud = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.status = 'waiting';
  self.elide = [ 'passphrase' ];
  self.changed();
  self.timer = null;

  nest.logger = logger;

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'attention') {
      if (self.status === 'error') self.alert('please check login credentials');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.email) || (!!info.passphrase)) self.login(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


var Nest = function() {
  var p, self;

  self = this;
  for (p in nest) if (nest.hasOwnProperty(p)) self[p] = nest[p];
  return self;
};
util.inherits(Nest, events.EventEmitter);

Cloud.prototype.login = function(self) {
  self.nest = new Nest();
  self.nest.logger = logger;

  self.nest.on('error', function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    self.login(self);
  }).login(self.info.email, self.info.passphrase, function(err, data) {/* jshint unused: false */
    if (err) { self.nest = null; return self.error(self, err); }

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
    self.scan(self);
  });
};

Cloud.prototype.error = function(self, err) {
  self.status = 'error';
  self.changed();
  logger.error('device/' + self.deviceID, { diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.nest) return;

  self.nest.fetchStatus(function(data) {
    var id, name;

    name = '';
    for (id in data.structure) if (data.structure.hasOwnProperty(id)) { name = data.structure[id].name; break; }

    for (id in data.device) {
      if (data.device.hasOwnProperty(id)) {
        self.addstation(self, id, data.device[id], name, data.shared[id], data.track[id].$timestamp);
      }
    }
  });
};

Cloud.prototype.addstation = function(self, id, station, name, data, timestamp) {
  var info, params, sensor, udn;

  params = { lastSample  : timestamp
           , temperature : data.current_temperature
           , humidity    : station.current_humidity
           };

  udn = 'nest:' + id;
  if (devices.devices[udn]) {
    sensor = devices.devices[udn].device;
    return sensor.update(sensor, params);
  }

  info =  { source: self.deviceID, gateway: self, params: params };
  info.device = { url                          : null
                , name                         : name + ': ' + data.name
                , manufacturer                 : 'Nest Labs'
                , model        : { name        : station.type
                                 , description : ''
                                 , number      : station.model_version
                                 }
                , unit         : { serial      : station.serial_number
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/climate/nest/control';
  info.id = info.device.unit.udn;
  macaddrs[station.mac_address] = true;

  logger.debug(info.device.name, { id: info.device.unit.serial,  params: info.params });
  devices.discover(info);
  self.changed();
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if (!!params.email) self.info.email = params.email;
  if (!!params.passphrase) self.info.passphrase = params.passphrase;
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.email) result.requires.push('email');
  else {
    try { validator.check(info.email).isEmail(); } catch(ex) { result.invalid.push('email'); }
  }

  if (!info.passphrase) result.requires.push('passphrase');
  else if (info.passphrase.length < 1) result.invalid.push('passphrase');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.email) params.email = 'nobody@example.com';
  if (!params.passphrase) params.passphrase = ' ';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.nest = steward.actors.device.gateway.nest ||
      { $info     : { type: '/device/gateway/nest' } };

  steward.actors.device.gateway.nest.cloud =
      { $info     : { type       : '/device/gateway/nest/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'ready', 'error' ]
                                   , email      : true
                                   , passphrase : true
                                   }
                    }
      , $validate : {  create    : validate_create
                    ,  perform   : validate_perform
                    }
      };
  devices.makers['/device/gateway/nest/cloud'] = Cloud;

  require('./../../discovery/discovery-mac').pairing([ '18:b4:30' ], function(ipaddr, macaddr, tag) {
    if (!!macaddrs[macaddr]) return;

    logger.info(tag);
  });
};
