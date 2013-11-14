// mqtt - send measurements via MQTT

var mqtt        = require('mqtt')
  , querystring = require('querystring')
  , url         = require('url')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  , sensor      = require('./../device-sensor')
  ;


var logger = indicator.logger;


var Mqtt = exports.Device = function(deviceID, deviceUID, info) {
  var method, option, options, opts, parts, self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);
  self.status = 'waiting';
  self.elide = [ 'username', 'passphrase' ];
  self.changed();

  parts = url.parse(info.url);
  if (!parts.port) parts.port = (parts.protocol === 'mqtts') ? 8883 : 1883;
  options = { protocolID: 'MQIsdp', protocolVersion: 3 };
  opts = (!!parts.query) ? querystring.parse(parts.query) : {};
  if (!!info.username) {
    opts.username = info.username;
    if (!!info.passphrase) opts.password = info.passphrase;
  }
  for (option in opts) if (opts.hasOwnProperty(option)) options[option] = opts[option];

  self.path = parts.pathname;
  if (!self.path) self.path = '';
  else if (self.path.lastIndexOf('/') !== (self.path.length - 1)) self.path += '/';

  method = (parts.protocol === 'mqtts') ? mqtt.createSecureClient : mqtt.createClient;
  self.mqtt = method(parts.port, parts.hostname, options).on('connection', function() {
    self.status = 'ready';
  }).on('message', function(topic, message, packet) {
    logger.warning('device/' + self.deviceID, { event: 'message', topic: topic, message: message, packet: packet });
  });

/*
 device/162 - Air Quality Sensor
{ streamID  : 160
, measure   : { name: "co", type: "contextDependentUnits", label: "voltage", symbol: "co" }
, value     : 0.0823
, timestamp : 1383839241764
}
 */
  broker.subscribe('readings', function(deviceID, point) {
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
};
util.inherits(Mqtt, indicator.Device);


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
  var parts
    , result = { invalid: [], requires: [] }
    ;

  if (!info.url) result.requires.push('url');
  else if (typeof info.url !== 'string') result.invalid.push('url');
  else {
    parts = url.parse(info.url);
    if ((!parts.hostname) || ((parts.protocol !== 'mqtt:') && (parts.protocol != 'mqtts:'))) {
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
    , result = { invalid: [], requires: [] };

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') return validate_create(params);

  result.invalid.push('perform');
  return result;
};


exports.start = function() {
  var measureName, measurements;

  steward.actors.device.indicator.text = steward.actors.device.indicator.text ||
      { $info     : { type: '/device/indicator/text' } };

  measurements = {};
  for (measureName in sensor.measures) {
    if (sensor.measures.hasOwnProperty(measureName)) measurements[measureName] = sensor.measures[measureName].units;
  }

  steward.actors.device.indicator.text.mqtt =
      { $info     : { type       : '/device/indicator/text/mqtt'
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
      , $validate : {  create    : validate_create
                    ,  perform   : validate_perform
                    }
      };
  devices.makers['/device/indicator/text/mqtt'] = Mqtt;
};
