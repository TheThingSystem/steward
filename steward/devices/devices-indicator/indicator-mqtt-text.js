// mqtt - send measurements via MQTT

var mqtt        = require('mqtt')
  , url         = require('url')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , server      = require('./../../core/server')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  , sensor      = require('./../device-sensor')
  ;


var logger = indicator.logger;


var Mqtt = exports.Device = function(deviceID, deviceUID, info) {
  var params, self;

  self = this;

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
  self.elide = [ 'username', 'passphrase' ];
  self.changed();

/*
 device/162 - Air Quality Sensor
{ streamID  : 160
, measure   : { name: "co", type: "contextDependentUnits", label: "voltage", symbol: "co" }
, value     : 0.0823
, timestamp : 1383839241764
}
 */
  broker.subscribe('readings', function(deviceID, point) {
    if (!self.mqtt) return;
    if (self.status !== 'ready') return;
    if ((!!self.sensors) && (!self.sensors[deviceID])) return;
    if ((!!self.measurements) && (!self.measurements[point.measure.name])) return;

    self.mqtt.publish(self.path + 'device/' + deviceID + '/' + point.measure.name,
                      { value: point.value, measure: point.measure, timestamp: point.timestamp });
  });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  params = url.parse(info.url, true);
  if (!!info.username) {
    params.query.username = info.username;
    if (!!info.passphrase) params.query.password = info.passphrase;
  }
  self.login(self, params);
};
util.inherits(Mqtt, indicator.Device);


Mqtt.prototype.login = function(self, params) {
  var method, option, options, opts;

  if (!params.port) params.port = (params.protocol === 'mqtts') ? 8883 : 1883;

  options = { protocolID: 'MQIsdp', protocolVersion: 3 };
  opts = params.query || {};
  for (option in opts) if (opts.hasOwnProperty(option)) options[option] = opts[option];

  self.path = params.pathname;
  if (!self.path) self.path = '';
  else if (self.path.lastIndexOf('/') !== (self.path.length - 1)) self.path += '/';

  method = (params.protocol === 'mqtts') ? mqtt.createSecureClient : mqtt.createClient;
  self.mqtt = method(params.port, params.hostname, options).on('connection', function() {
    self.status = 'ready';
  }).on('message', server.mqtt_onmessage).on('error', function(err) {
    self.status = 'error';
    self.changed();
    logger.error('device/' + self.deviceID, { event: 'error', diagnostic: err.message });

    self.mqtt.end();
    self.mqtt = null;
    setTimeout(function() { self.login(params); }, 600 * 1000);
  });
};

Mqtt.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if ((!!params.measurements) && (util.isArray(params.measurements))) {
    self.info.measurements = params.measurements;
    delete(self.measurements);
  }
  if ((!!params.sensors) && (util.isArray(params.sensors))) {
    self.info.sensors = params.sensors;
    delete(self.sensors);
  }

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var params
    , result = { invalid: [], requires: [] }
    ;

  if (!info.url) result.requires.push('url');
  else if (typeof info.url !== 'string') result.invalid.push('url');
  else {
    params = url.parse(info.url);
    if ((!params.hostname) || ((params.protocol !== 'mqtt:') && (params.protocol != 'mqtts:'))) {
      result.invalid.push('url');
    }
  }

  if ((!!info.username) && (typeof info.username !== 'string')) result.invalid.push('username');
  if (!!info.password) {
    if (!info.username) result.requires.push('username');
    if (typeof info.password !== 'string') result.invalid.push('password');
  }

  if ((!!info.measurements) && (!util.isArray(info.measurements))) result.invalid.push('measurements');
  if ((!!info.sensors) && (!util.isArray(info.sensors))) result.invalid.push('sensors');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') return validate_create(params);

  result.invalid.push('perform');
  return result;
};


exports.start = function() {
  var measureName, measurements;

  steward.actors.device.indicator.mqtt = steward.actors.device.indicator.mqtt ||
      { $info     : { type: '/device/indicator/mqtt' } };

  measurements = {};
  for (measureName in sensor.measures) {
    if (sensor.measures.hasOwnProperty(measureName)) measurements[measureName] = sensor.measures[measureName].units;
  }

  steward.actors.device.indicator.mqtt.text =
      { $info     : { type       : '/device/indicator/mqtt/text'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error' ]
                                   , url          : true
                                   , username     : true
                                   , passphrase   : true
                                   , measurements : measurements
                                   , sensors      : []
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/mqtt/text'] = Mqtt;
};
