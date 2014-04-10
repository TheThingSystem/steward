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
var newaddrs = {};


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
  self.elide = [ 'passphrase' ];
  self.changed();
  self.timer = null;

  nest.logger = utility.logfnx(logger, 'device/' + self.deviceID);

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    var macaddr;

    if (request === 'attention') {
      if (self.status === 'reset') self.alert('please check login credentials at https://home.nest.com/');
      for (macaddr in macaddrs) if (macaddrs.hasOwnProperty(macaddr)) delete(newaddrs[macaddr]);
      for (macaddr in newaddrs) if (newaddrs.hasOwnProperty(macaddr)) {
        self.alert('discovered Nest device at ' + newaddrs[macaddr]);
        macaddrs[macaddr] = true;
      }

      return;
    }

    if (request === 'scan') {
      if (actor === self.whatami) self.scan(self);

      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.email) && (!!info.passphrase)) self.login(self);
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
  self.nest.logger = utility.logfnx(logger, 'device/' + self.deviceID);

  self.nest.on('error', function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.login(self); }, 30 * 1000);
  }).login(self.info.email, self.info.passphrase, function(err, data) {/* jshint unused: false */
    if (!!err) { self.nest = null; return self.error(self, err); }

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
    self.scan(self);
  });
};

Cloud.prototype.error = function(self, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.nest) return;

  self.nest.fetchStatus(function(data) {
    var away, i, id, name, station, t, topaz, where, wheres;

    name = '';
    topaz = [];
    for (id in data.structure) if (data.structure.hasOwnProperty(id)) {
      name = data.structure[id].name;
      away = data.structure[id].away;
      if (!data.structure[id].swarm) continue;
      for (i = 0; i < data.structure[id].swarm.length; i++) {
        t = data.structure[id].swarm[i];
        if (t.indexOf('topaz.') === 0) topaz.push(t.substr(6));
      }
      break;
    }

    where = {};
    for (id in data.where) if (data.where.hasOwnProperty(id)) {
      if (!where[id]) where[id] = {};
      wheres = data.where[id].wheres;
      for (i = 0; i < wheres.length; i++) {
        where[id][wheres[i].where_id] = wheres[i].name;
      }
    }

    for (id in data.device) {
      if (data.device.hasOwnProperty(id)) {
        self.addstation(self, id, data.device[id], name, away, data.shared[id], data.track[id].$timestamp,
                        data.track[id].online);
      }
    }

    for (i = 0; i < topaz.length; i++) {
      id = topaz[i];
      station = data.topaz[id];
      station.type          = 'Nest Protect';
      station.model_version = station.model;
      station.local_ip      = station.wifi_ip_address;
      station.mac_address   = station.wifi_mac_address;
      station.name          = where[station.structure_id][station.where_id];

      self.addstation(self, id, station, name, away, station, data.topaz[id].$timestamp, data.widget_track[id].online);
    }
  });
};

Cloud.prototype.addstation = function(self, id, station, name, away, data, timestamp, online) {
  var deviceType, info, params, sensor, status, udn;

  devices.prime(station.local_ip, station.mac_address);

  if (data.current_temperature) {
    deviceType = '/device/climate/nest/control';
    params = { temperature     : data.current_temperature
             , goalTemperature : (!!station.time_to_target) ? data.target_temperature : data.current_temperature
             , humidity        : station.current_humidity
             , hvac            : (!!data.hvac_ac_state)           ? 'cool'
                                     : (!!data.hvac_heater_state) ? 'heat'
                                     : (!!data.hvac_fan_state)    ? 'fan'     : 'off'
             , away            : (!!away)                         ? 'on'      : 'off'
             , leaf            : (!!station.leaf)                 ? 'on'      : 'off'
             , lastSample      : timestamp
             };
    status = online ? 'present' : 'absent';
  } else {
    deviceType = '/device/sensor/nest/smoke';
    params = { smoke           : data.smoke_status ? 'detected' : 'absent'
             , co              : data.co_status    ? 'detected' : 'absent'
//           , batteryLevel    : data.battery_level
             , lastSample      : timestamp
             };
    status = (!online) ? 'absent' : (data.smoke_status | data.co_status) ? 'unsafe' : 'safe';
  }

  udn = 'nest:' + id;
  if (!!devices.devices[udn]) {
    sensor = devices.devices[udn].device;
    if (!sensor) return;

    return sensor.update(sensor, params, status);
  }

  params.status = status;
  info =  { source: self.deviceID, gateway: self, params: params };
  info.device = { url                          : 'ip://' + station.local_ip
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
  info.deviceType = deviceType;
  info.id = info.device.unit.udn;
  macaddrs[station.mac_address] = true;

  logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
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

  if (!params.email) params.email = 'nobody@example.com';
  if (!params.passphrase) params.passphrase = ' ';

  return validate_create(params);
};


exports.start = function() {
  var later = new Date().getTime();

  steward.actors.device.gateway.nest = steward.actors.device.gateway.nest ||
      { $info     : { type: '/device/gateway/nest' } };

  steward.actors.device.gateway.nest.cloud =
      { $info     : { type       : '/device/gateway/nest/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , email      : true
                                   , passphrase : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/nest/cloud'] = Cloud;

  require('./../../discovery/discovery-mac').pairing([ '18:b4:30' ], function(ipaddr, macaddr, tag) {
    var f, i, now;

    now = new Date().getTime();
    if (now >= later) {
      later = now + (30 * 1000);

      f = function() { broker.publish('actors', 'scan', '', '/device/gateway/nest/cloud'); };
      for (i = 0; i < 15; i++) setTimeout(f, i * 2000);
      logger.info('nest-cloud', 'begin 30-second scan');
      f();
    }

    if ((!!macaddrs[macaddr]) || (ipaddr === '0.0.0.0')) return;

    logger.debug(tag, { ipaddr: ipaddr, macaddr: macaddr });
    newaddrs[macaddr] = ipaddr;
  });

// NB: needed on RPi where disk is a bit slow... (may eventually be needed for other gateways)
  require('./../devices-climate/climate-nest-control').start();
  require('./../devices-sensor/sensor-nest-smoke').start();
};
