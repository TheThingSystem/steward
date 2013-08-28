// koubachi - interactive plant care

var Koubachi    = require('koubachi')
  , util        = require('util')
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

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.status = 'waiting';
  self.elide = [ 'appkey', 'credentials' ];
  self.changed();
  self.timer = null;

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    var macaddr;

    if (request === 'attention') {
      if (self.status === 'reset') self.alert('please check login credentials');

      for (macaddr in macaddrs) if (macaddrs.hasOwnProperty(macaddr)) delete(newaddrs[macaddr]);
      for (macaddr in newaddrs) {
        if (newaddrs.hasOwnProperty(macaddr)) self.alert('discovered Koubachi Plant Sensor at ' + newaddrs[macaddr]);
      }

      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.appkey) || (!!info.credentials)) self.login(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.login = function(self) {
  self.koubachi = new Koubachi.Koubachi();
  self.koubachi.logger = utility.logfnx(logger, 'device/' + self.deviceID);

  self.koubachi.on('error', function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.login(self); }, 30 * 1000);
  }).setConfig(self.info.appkey, self.info.credentials).getDevices(function(err, results) {
    var i;

    if (!!err) { self.koubachi = null; return self.error(self, err); }

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);

    for (i = 0; i < results.length; i++) self.addstation(self, results[i].device);
  });
};

Cloud.prototype.error = function(self, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.koubachi) return;

  self.koubachi.getDevices(function(err, results) {
    var i;

    if (!!err) { self.koubachi = null; return self.error(self, err); }

    for (i = 0; i < results.length; i++) self.addstation(self, results[i].device);
  });
};

Cloud.prototype.addstation = function(self, station) {
  var info, last, moisture, name, next, params, sensor, udn, x;

  moisture = station.recent_soilmoisture_reading_value;
  x = moisture.indexOf(' ');
  if (x !== -1) moisture = moisture.slice(0, x);
  try { last = new Date(station.last_transmission);           } catch(ex) { last = new Date(); }
  try { next = new Date(station.next_transmission).getTime(); } catch(ex) {}

  params = { placement   : station.hardware_product_type
           , lastSample  : last.getTime()
           , nextUpdated : next
           , moisture    : moisture
           , temperature : (station.recent_temperature_reading_si_value - 273.15).toFixed(2)
           , light       : station.recent_light_reading_si_value
           };

  udn = 'koubachi:' + station.mac_address;
  if (devices.devices[udn]) {
    sensor = devices.devices[udn].device;
    return sensor.update(sensor, params);
  }

  info =  { source: self.deviceID, gateway: self, params: params };
  info.device = { url                          : null
                , name                         : station.hardware_product_type
                , manufacturer                 : 'koubachi'
                , model        : { name        : station.hardware_product_type
                                 , description : ''
                                 , number      : ''
                                 }
                , unit         : { serial      : station.mac_address
                                 , udn         : udn
                                 }
                };

  info.url = info.device.url;
  info.deviceType = '/device/climate/koubachi/sensor';
  info.id = info.device.unit.udn;
  macaddrs[station.mac_address.split('-').join('').split(':').join('').toLowerCase()] = true;

  logger.info('Koubachi ' + info.device.name, { id: info.device.unit.serial,  params: info.params });
  devices.discover(info);
  self.changed();
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if (!!params.appkey) self.info.appkey = params.appkey;
  if (!!params.credentials) self.info.credentials = params.credentials;
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.appkey) result.requires.push('appkey');
  else if (info.appkey.length < 1) result.invalid.push('appkey');

  if (!info.credentials) result.requires.push('credentials');
  else if (info.credentials.length < 1) result.invalid.push('credentials');

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

  if (!params.appkey) params.appkey = 'nobody@example.com';
  if (!params.credentials) params.credentials = ' ';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.koubachi = steward.actors.device.gateway.koubachi ||
      { $info     : { type: '/device/gateway/koubachi' } };

  steward.actors.device.gateway.koubachi.cloud =
      { $info     : { type       : '/device/gateway/koubachi/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , appkey      : true
                                   , credentials : true
                                   }
                    }
      , $validate : {  create    : validate_create
                    ,  perform   : validate_perform
                    }
      };
  devices.makers['/device/gateway/koubachi/cloud'] = Cloud;

  require('./../../discovery/discovery-mac').pairing([ '00:06:66' ], function(ipaddr, macaddr, tag) {
    if (!!macaddrs[macaddr]) return;

    logger.debug(tag, { ipaddr: ipaddr, macaddr: macaddr });
    newaddrs[macaddr] = ipaddr;
  });
};
