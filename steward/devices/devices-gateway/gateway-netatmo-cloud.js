// netatmo - personal weather station: http://www.netatmo.com

var Netatmo     = require('node-netatmo')
  , util        = require('util')
  , validator   = require('validator')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  ;


var logger   = exports.logger = utility.logger('gateway');

var client1  = '517b8e981977597607000008'
  , client2  = 'uyNPPB7ds1ARkmIpxqiK3ojaVPndm7ny'
  ;


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
  self.changed();
  self.timer = null;

  self.elide = [ 'passphrase' ];

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.email) || (!!info.passphrase)) self.login(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.login = function(self) {
  self.netatmo = new Netatmo.Netatmo();
  self.netatmo.logger = logger;

  self.netatmo.on('error', function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    self.login(self);
  }).setConfig(client1, client2, self.info.email, self.info.passphrase).getToken(function(err) {
    if (!!err) { self.netatmo = null; return self.error(self, err); }

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
  if (!self.netatmo) return;

  self.netatmo.getDevices(function(err, results) {
    var coordinates, i, id, j, modules, place, station, stations;

    if (!!err) return self.error(self, err);

    if (results.status !== 'ok') {
      return logger.error('device/' + self.deviceID, { operation: 'getDevices', results: results });
    }

    modules = {};
    stations = results.body.modules;
    for (i = 0; i < stations.length; i++) {
      station = stations[i];
      modules[station._id] = station;
    }

    stations = results.body.devices;
    for (i = 0; i < stations.length; i++) {
      station = stations[i];
      place = station.place;
      if ((util.isArray(place.location)) && (place.location.length === 2)) {
        coordinates = [ place.location[1], place.location[0] ];
        if (!!place.altitude) coordinates.push(place.altitude);
      } else coordinates = null;
      self.addstation(self, station, station.station_name, station.last_data_store[station._id], coordinates);
      for (j = 0; j < station.modules.length; j++) {
        id = station.modules[j];
        if (!!modules[id]) self.addstation(self, modules[id], station.station_name, station.last_data_store[id], coordinates);
      }
    }
  });
};

Cloud.prototype.addstation = function(self, station, name, data, coordinates) {
  var info, params, sensor, udn;

  params = { coordinates : coordinates
           , lastSample  : (!!data.K) ? (data.K * 1000) : null
           , temperature : (!!data.a) ? data.a          : null
           , humidity    : (!!data.b) ? data.b          : null
           , co2         : (!!data.h) ? data.h          : null
           , noise       : (!!data.S) ? data.S          : null
           , pressure    : (!!data.e) ? data.e          : null
           };

  udn = 'netatmo:' + station._id;
  if (devices.devices[udn]) {
    sensor = devices.devices[udn].device;
    return sensor.update(sensor, params);
  }

  info =  { source: self.deviceID, gateway: self, params: params };
  info.device = { url                          : null
                , name                         : name + ': ' + station.module_name
                , manufacturer                 : 'netatmo'
                , model        : { name        : station.type
                                 , description : ''
                                 , number      : ''
                                 }
                , unit         : { serial      : station._id
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/climate/netatmo/sensor';
  info.id = info.device.unit.udn;

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
  steward.actors.device.gateway.netatmo = steward.actors.device.gateway.netatmo ||
      { $info     : { type: '/device/gateway/netatmo' } };

  steward.actors.device.gateway.netatmo.cloud =
      { $info     : { type       : '/device/gateway/netatmo/cloud'
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
  devices.makers['/device/gateway/netatmo/cloud'] = Cloud;
};
