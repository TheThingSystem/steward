// Parrot Flower Power: http://www.parrot.com/flowerpower/

var CloudAPI    = require('flower-power-cloud')
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
  self.elide = [ 'accessID', 'accessSecret', 'passphrase' ];
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
  self.cloudapi = new CloudAPI.CloudAPI({ clientID     : self.info.accessID
                                        , clientSecret : self.info.accessSecret
                                        , logger       : utility.logfnx(logger, 'device/' + self.deviceID)
                                        }).login(self.info.email, self.info.passphrase, function(err) {
    if (!!err) { self.cloudapi = null; return self.error(self, err); }

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
    self.scan(self);
  }).on('error', function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.login(self); }, 30 * 1000);
  });
};

Cloud.prototype.error = function(self, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.cloudapi) return;

  self.cloudapi.getGarden(function(err, plants, sensors) {
    var antoine, info, k, params, plant, sample, sensor, udn;

    if (!!err) return self.error(self, err);

    for (k in plants) {
      if (!plants.hasOwnProperty(k)) continue;
      plant = plants[k];

      if (!!sensors[plant.sensor_serial]) {
        sensors[plant.sensor_serial].location_name = plant.location_name || plant.plant_nickname;
        sensors[plant.sensor_serial].location = [ plant.latitude, plant.longitude ];
        sensors[plant.sensor_serial].samples = plant.samples;
      }
      if (!plant.status) plant.status = {};
      if (!plant.status.soil_moisture) plant.status.soil_moisture = {};
      if (!plant.status.fertilizer) plant.status.fertilizer = {};
      if (!plant.status.air_temperature) plant.status.air_temperature = {};
      if (!plant.status.air_temperature.instruction_key) plant.status.air_temperature.instruction_key = 'temperature_good';
      if (!plant.status.light) plant.status.light = {};
      if (!plant.status.light.instruction_key) plant.status.light.instruction_key = 'light_good';

      params = { placement       : plant.location_name
               , lastSample      : new Date(plant.last_sample_utc).getTime()
               , needsWater      : plant.status.soil_moisture.status_key !== 'status_ok'                ? 'true' : 'false'
               , needsFertilizer : plant.status.fertilizer.status_key    !== 'status_ok'                ? 'true' : 'false'
               , adviseChange    : plant.status.air_temperature.instruction_key.indexOf('_good') === -1 ? 'true' : 'false'
               , adviseLight     : plant.status.light.instruction_key.indexOf('_good') === -1           ? 'true' : 'false'
               };

      udn = 'flower-power:plant:' + k;
      if (!!devices.devices[udn]) {
        sensor = devices.devices[udn].device;
        if (!!sensor) sensor.update(sensor, params);
        continue;
      }

      info =  { source: self.deviceID, gateway: self, params: params };
      info.device = { url                          : null
                    , name                         : plant.plant_nickname || plant.description
                    , manufacturer                 : 'Parrot'
                    , model        : { name        : 'Flower Power'
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : k
                                     , udn         : udn
                                     }
                    };

      info.url = info.device.url;
      info.deviceType = '/device/climate/flower-power/plant';
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
      devices.discover(info);
      self.changed();
    }

    for (k in sensors) {
      if ((!sensors.hasOwnProperty(k)) || (!util.isArray(sensors[k].samples))) continue;
      sample = sensors[k].samples[0];

      // moisture = relativeHumidity * (saturationVaporPressure(temperatureC) / 100);
      antoine = 8.07131 - (1730.63 / (233.426 + sample.air_temperature_celsius));

      // sunlight is PPF (photons per square meter), convert to lux
      // according to http://www.apogeeinstruments.com/conversion-ppf-to-lux/

      params = { location     : utility.location_fuzz(sensors[k].location)
               , placement    : sensors[k].location_name
               , lastSample   : new Date(sample.capture_ts).getTime()
               , moisture     : sample.vwc_percent >= 0 ? sample.vwc_percent * Math.pow(10, antoine - 2) : undefined
               , temperature  : sample.air_temperature_celsius
               , light        : sample.par_umole_m2s * 54
               };

      udn = 'flower-power:sensor:' + k;
      if (!!devices.devices[udn]) {
        sensor = devices.devices[udn].device;
        if (!!sensor) sensor.update(sensor, params);
        continue;
      }

      info =  { source: self.deviceID, gateway: self, params: params };
      info.device = { url                          : null
                    , name                         : sensors[k].nickname
                    , manufacturer                 : 'Parrot'
                    , model        : { name        : 'Flower Power'
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : k
                                     , udn         : udn
                                     }
                    };

      info.url = info.device.url;
      info.deviceType = '/device/climate/flower-power/soil';
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

  if (!!params.accessID) self.info.accessID = params.accessID;
  if (!!params.accessSecret) self.info.accessSecret = params.accessSecret;
  if (!!params.email) self.info.email = params.email;
  if (!!params.passphrase) self.info.passphrase = params.passphrase;
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.accessID) info.accessID = info.email;
  else if ((typeof info.accessID !== 'string') || (info.accessID.length < 5)) result.invalid.push('accessID');

  if (!info.accessSecret) result.requires.push('accessSecret');
  else if ((typeof info.accessSecret !== 'string') || (info.accessSecret.length !== 48)) result.invalid.push('accessSecret');

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

  if (!params.clientID) params.clientID = 'nobody@example.com';
  if (!params.clientSecret) params.clientSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  if (!params.email) params.email = 'nobody@example.com';
  if (!params.passphrase) params.passphrase = ' ';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway['flower-power'] = steward.actors.device.gateway['flower-power'] ||
      { $info     : { type: '/device/gateway/flower-power' } };

  steward.actors.device.gateway['flower-power'].cloud =
      { $info     : { type       : '/device/gateway/flower-power/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , accessID     : true
                                   , accessSecret : true
                                   , email        : true
                                   , passphrase   : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/flower-power/cloud'] = Cloud;
};
