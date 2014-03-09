// mqtt - send measurements via MQTT

var mqtt        = require('mqtt')
  , url         = require('url')
  , util        = require('util')
  , winston     = require('winston')
  , serialize   = require('winston/lib/winston/common').serialize
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
  var previous, self;

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
  delete(self.info.ipaddress);
  self.priority = winston.config.syslog.levels[self.info.priority || 'notice'] || winston.config.syslog.levels.notice;
  self.info.priority = utility.value2key(winston.config.syslog.levels, self.priority);
  self.status = 'waiting';
  self.elide = [ 'passphrase' ];
  self.changed();

  broker.subscribe('readings', function(deviceID, point) {
    if (!self.mqtt) return;
    if (self.status !== 'ready') return;

    if ((!!self.sensors) && (!self.sensors[deviceID])) return;
    if ((!!self.measurements) && (!self.measurements[point.measure.name])) return;

    self.mqtt.publish(self.path + 'devices/' + deviceID + '/' + point.measure.name,
                      JSON.stringify({ value: point.value, measure: point.measure, timestamp: point.timestamp }));
  });

  previous = {};
  broker.subscribe('beacon-egress', function(category, data) {
    var datum, i, now, parameter;

    if (!self.mqtt) return;
    if (self.status !== 'ready') return;

    if (!util.isArray(data)) data = [ data ];
    for (i = 0; i < data.length; i++) {
      datum = data[i];
      if (!datum.date) continue;

      if ((!winston.config.syslog.levels[datum.level]) || (winston.config.syslog.levels[datum.level] < self.priority)) continue;

      if (!previous[datum.level]) previous[datum.level] = {};
      now = new Date(datum.date).getTime();
      if ((!!previous[datum.level][datum.message]) && (previous[datum.level][datum.message] > now)) continue;
      previous[datum.level][datum.message] = now + (60 * 1000);

      parameter = datum.message;
      if (!!datum.meta) parameter += ' ' + serialize(datum.meta);

      self.mqtt.publish(self.path + 'logs/' + category, JSON.stringify(datum), { retain: true });
    }
  });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.login(self);
};
util.inherits(Mqtt, indicator.Device);


Mqtt.prototype.login = function(self) {
  var i, method, option, options, opts, params;

  params = url.parse(self.info.url, true);
  if (!params.port) params.port = (params.protocol === 'mqtts:') ? 8883 : 1883;
  if (!!self.info.username) {
    params.query.username = self.info.username;
    if (!!self.info.passphrase) params.query.password = self.info.passphrase;
  }
  if ((!!self.info.crtPath) && (params.protocol === 'mqtts:')) {
    params.query.ca = [ __dirname + '/../../db/' + self.info.crtPath ];
  }

  options = { protocolID: 'MQIsdp', protocolVersion: 3 };
  opts = params.query || {};
  for (option in opts) if (opts.hasOwnProperty(option)) options[option] = opts[option];

  self.path = params.pathname || '';
  if (self.path.indexOf('/') !== 0) self.path = '/' + self.path;
  if (self.path.lastIndexOf('/') !== (self.path.length - 1)) self.path += '/';
  self.path = self.path.split('/').slice(1).slice(0, -1).join('/');
  if (self.path !== '') self.path += '/';

  method = (params.protocol === 'mqtts:') ? mqtt.createSecureClient : mqtt.createClient;
  self.mqtt = method(params.port, params.hostname, options).on('connect', function() {
    self.status = 'ready';
    self.changed();
  }).on('message', server.mqtt_onmessage).on('error', function(err) {
    self.status = 'error';
    self.changed();
    logger.error('device/' + self.deviceID, { event: 'error', diagnostic: err.message });

    self.mqtt.end();
    self.mqtt = null;
    setTimeout(function() { self.login(self); }, 30 * 1000);
  });
  if (!!self.info.subscriptions) {
    for (i = 0; i < self.info.subscriptions.length; i++) self.mqtt.subscribe(self.info.subscriptions[i]);
  } else {
    self.mqtt.subscribe(self.path.split('/')[0] + '/#');
  }
};

Mqtt.prototype.perform = function(self, taskID, perform, parameter) {
  var param, params, updateP;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) {
      self.setName(params.name);
      delete(params.name);
    }

    updateP = false;
    for (param in params) {
      if ((!params.hasOwnProperty(param)) || (self.info[param] === params[param])) continue;

      self.info[param] = params[param];
      updateP = true;
    }
    if (!updateP) return true;

    self.setInfo();
    if (!!self.mqtt) {
      self.mqtt = null;
      setTimeout(function() { self.login(self); }, 0);
    }

    return true;
  }

  if ((perform !== 'growl') || (!self.mqtt)) return false;
  params.message = devices.expand(params.message, 'device/' + self.deviceID);

  if ((!params.priority) || (!params.message) || (params.message.length === 0)) return false;

  if ((!winston.config.syslog.levels[params.priority])
        || (winston.config.syslog.levels[params.priority] < self.priority)) return false;

  self.mqtt.publish(self.path + 'messages', params.message, { retain: true });
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
    if ((!params.hostname) || ((params.protocol !== 'mqtt:') && (params.protocol !== 'mqtts:'))) {
      result.invalid.push('url');
    }
  }

  if ((!!info.username) && (typeof info.username !== 'string')) result.invalid.push('username');
  if (!!info.passphrase) {
    if (!info.username) result.requires.push('username');
    if (typeof info.passphrase !== 'string') result.invalid.push('passphrase');
  }

  if ((!!info.crtPath) && (info.crtPath.indexOf('/') !== -1)) result.invalid.push('crtPath');

// NB: maybe we ought to be syntax checking the values for these two?
  if ((!!info.measurements) && (!util.isArray(info.measurements))) result.invalid.push('measurements');
  if ((!!info.sensors) && (!util.isArray(info.sensors))) result.invalid.push('sensors');

  if ((!!info.priority) && (!winston.config.syslog.levels[info.priority])) result.invalid.push('priority');

// NB: maybe we ought to be syntax checking the values for these?
  if ((!!info.subscriptions) && (!util.isArray(info.subscriptions))) result.invalid.push('subscriptions');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') return validate_create(params);

  if (perform !== 'growl') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.priority) result.requires.push('priority');
  else if (!winston.config.syslog.levels[params.priority]) result.invalid.push('priority');

  if (!params.message) result.requires.push('message');
  else if (params.message.length === 0) result.invalid.push('message');

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
                    , perform    : [ 'growl' ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error' ]
                                   , url          : true
                                   , username     : true
                                   , passphrase   : true
                                   , crtFile      : true
                                   , measurements : measurements
                                   , sensors      : []
                                   , priority     : utility.keys(winston.config.syslog.levels)
                                   , subscriptions: []
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/mqtt/text'] = Mqtt;
};
