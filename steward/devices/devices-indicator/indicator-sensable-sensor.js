// sensable - send measurements to http://sensable.io

var sensable    = require('sensable-reporter')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  , sensor      = require('./../device-sensor')
  ;


var logger = indicator.logger;


var Sensable = exports.Device = function(deviceID, deviceUID, info) {
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
  self.status = 'ready';
  self.elide = [ 'token' ];
  self.changed();

  broker.subscribe('readings', function(deviceID, point) { self.update(self, deviceID, point); });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'attention') {
      if (self.status === 'error') self.alert('please check login credentials at https://sensable.io/');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.normalize(self);
};
util.inherits(Sensable, indicator.Device);


Sensable.prototype.normalize = function(self) {
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

Sensable.prototype.update = function(self, deviceID, point) {
  var actor, device, entity, location, place;

  if (self.status !== 'ready') return;
  if ((!!self.sensors) && (!self.sensors[deviceID])) return;
  if ((!!self.measurements) && (!self.measurements[point.measure.name])) return;

  point.device = { deviceID: deviceID };
  actor = steward.actors.device;
  if (!!actor) {
    entity = actor.$lookup(deviceID);
    if (!!entity) device = entity.proplist();
    if (!!device) point.device.name = device.name;
    if (!!device.info) location = device.info.location;
  }

  if (!location) {
    actor = steward.actors.place;
    if (!!actor) {
      entity = actor.$lookup("1");
      if (!!entity) place = entity.proplist();
      if (!!place) location = place.info && place.info.location;
    }
  }
  if (!!location) location = [ parseFloat(location[0]), parseFloat(location[1]) ]; else location = [ 0, 0 ];
  if (self.info.private === 'off') location = [ parseFloat(location[0].toFixed(3)), parseFloat(location[1].toFixed(3)) ];

  sensable({ sensorid    : 'device-' + deviceID + '-' + point.measure.name
           , name        : point.device.name
           , unit        : point.measure.label
           , sensortype  : point.measure.name
           , latitude    : location[0]
           , longitude   : location[1]
           }
          ,{ accessToken : self.info.token
           , private     : self.info.private !== 'off'
           }).upload(point.value, point.timestamp, function(err, response, result) {/* jshint unused: false */
    if (!err) return;

    logger.error('device/' + self.deviceID, { event: 'uplaod', diagnostic: err.message });
    if (self.status === 'error') return;
    self.status = 'error';
    self.changed();
  });
};


Sensable.prototype.perform = function(self, taskID, perform, parameter) {
  var params, updateP;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);
  if (!!params.ikon) self.setIkon(params.ikon);

  updateP = false;
  if (!!params.token) {
    updateP = true;
    self.info.token = params.token;
  }
  if ((!!params.private) && ((params.private === 'on') || (params.private === 'off'))) {
    updateP = true;
    self.info.private = params.private;
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

  if ((!!info.token) && (typeof info.token !== 'string')) result.invalid.push('key');

  if (!info.token) result.requires.push('token');
  else if ((typeof info.token !== 'string') || (info.token.length < 40)) result.invalid.push('token');

  if ((!!info.private) && (info.private !== 'on') && (info.private !== 'off')) result.invalid.push('private');

  if ((!!info.measurements) && (!util.isArray(info.measurements))) result.invalid.push('measurements');
  if ((!!info.sensors) && (!util.isArray(info.sensors))) result.invalid.push('sensors');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if (!params.token) params.token = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    return validate_create(params);
  }

  result.invalid.push('perform');
  return result;
};


exports.start = function() {
  var measureName, measurements;

  steward.actors.device.indicator.sensable = steward.actors.device.indicator.sensable ||
      { $info     : { type: '/device/indicator/sensable' } };

  measurements = {};
  for (measureName in sensor.measures) {
    if (sensor.measures.hasOwnProperty(measureName)) measurements[measureName] = sensor.measures[measureName].units;
  }

  steward.actors.device.indicator.sensable.sensor =
      { $info     : { type       : '/device/indicator/sensable/sensor'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'ready', 'waiting', 'error' ]
                                   , token        : true
                                   , private      : [ 'on', 'off' ]
                                   , measurements : measurements
                                   , sensors      : []
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/sensable/sensor'] = Sensable;
};
