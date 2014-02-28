// dweetio - send measurements to http://dweet.io

var dweetio     = require('node-dweetio')
  , http        = require('http')
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


var DweetIO = exports.Device = function(deviceID, deviceUID, info) {
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
  self.changed();

  self.dweetio = new dweetio();

  broker.subscribe('readings', function(deviceID, point) { self.update(self, deviceID, point); });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if (!!self.info.thing) self.status = 'ready'; else self.getThingName(self);
  self.normalize(self);
};
util.inherits(DweetIO, indicator.Device);


// this really ought to be part of the API...

DweetIO.prototype.getThingName = function(self) {
  var options;

  options = url.parse('http://dweet.io/dweet');
  options.agent = false;
  options.method = 'POST';

  http.request(options, function(response) {
    var content = '';

    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      content += chunk.toString();
    }).on('end', function() {
      var json;

      self.status = 'error';
      self.changed();

      if (response.statusCode !== 200) {
        return logger.error('device/' + self.deviceID, { event: 'http', code: response.statusCode, content: content });
      }

      try {
        json = JSON.parse(content);
        self.info.thing = json.with.thing;
        self.setInfo();
      } catch(ex) {
        return logger.error('device/' + self.deviceID, { event: 'JSON', diagnostic: ex.message, content: content });
      }

      self.status = 'ready';
      self.changed();
    }).on('close', function() {
      logger.warning('device/' + self.deviceID, { event: 'http', diagnostic: 'premature eof' });
    });
  }).on('error', function(err) {
    logger.error('device/' + self.deviceID, { event: 'http', options: options, diagnostic: err.message });
  }).end('{}');
};

DweetIO.prototype.normalize = function(self) {
  var deviceID, i;

  if ((util.isArray(self.info.measurements)) && (self.info.measurements.length > 0) && (!self.measurements)) {
    self.measurements = {};
    for (i = 0; i < self.info.measurements.length; i++) self.measurements[self.info.measurements[i]] = true;
  }

  if ((util.isArray(self.info.sensors)) && (self.info.sensors.length > 0) && (!self.sensors)) {
    self.sensors = {};
    for (i = 0; i < self.info.sensors.length; i++) {
      deviceID = self.info.sensors[i].split('/')[1];
      self.sensors[deviceID] = true;
    }
  }
};

DweetIO.prototype.update = function(self, deviceID, point) {
  var actor, device, entity;

  if (self.status !== 'ready') return;
  if ((!!self.sensors) && (!self.sensors[deviceID])) return;
  if ((!!self.measurements) && (!self.measurements[point.measure.name])) return;

  point.device = { deviceID: deviceID };
  actor = steward.actors.device;
  if (!!actor) {
    entity = actor.$lookup(deviceID);
    if (!!entity) device = entity.proplist();
    if (!!device) point.device.name = device.name;
  }
  delete(point.streamID);

  self.dweetio.dweet_for(self.info.thing, point, self.info.key || null, function(err, dweet) {
      /* jshint unused: false */

      if (!!err) return logger.error('device/' + self.deviceID, { event: 'dweet_for', diagnostic: err.message || err });
  });
};


DweetIO.prototype.perform = function(self, taskID, perform, parameter) {
  var params, updateP;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  updateP = false;
  if (!!params.key) {
    updateP = true;
    self.info.key = params.key;
  }
  if ((!!params.measurements) && (util.isArray(params.measurements))) {
    updateP = true;
    self.info.measurements = params.measurements;
    delete(self.measurements);
  }
  if ((!!params.sensors) && (util.isArray(params.sensors))) {
    updateP = true;
    self.info.sensors = params.sensors;
    delete(self.sensors);
  }
  if (updateP) self.setInfo();

  self.normalize(self);
  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if ((!!info.key) && (typeof info.key !== 'string')) result.invalid.push('key');

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

  steward.actors.device.indicator.dweetio = steward.actors.device.indicator.dweetio ||
      { $info     : { type: '/device/indicator/dweetio' } };

  measurements = {};
  for (measureName in sensor.measures) {
    if (sensor.measures.hasOwnProperty(measureName)) measurements[measureName] = sensor.measures[measureName].units;
  }

  steward.actors.device.indicator.dweetio.sensor =
      { $info     : { type       : '/device/indicator/dweetio/sensor'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'ready', 'waiting', 'error' ]
                                   , thing        : true
                                   , key          : true
                                   , measurements : measurements
                                   , sensors      : []
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/dweetio/sensor'] = DweetIO;
};
