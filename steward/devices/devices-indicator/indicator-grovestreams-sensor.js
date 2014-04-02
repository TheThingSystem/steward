// GroveStreams - storage and analytics for the IoT

var gsclient    = require('grovestreams-api')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  , sensor      = require('./../device-sensor')
  , places      = require('./../../actors/actor-place')
  ;


var logger = indicator.logger;


var GroveStreams = exports.Device = function(deviceID, deviceUID, info) {
  var location, self;

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
  self.elide = [ 'apikey' ];
  self.changed();

  self.components = {};

  broker.subscribe('readings', function(deviceID, point) { self.update(self, deviceID, point); });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'attention') {
      if (self.status === 'error') self.alert('please check login credentials at https://grovestreams.com/');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!places.place1) && (!!places.place1.info.location)) {
    location = { latitude: places.place1.info.location[0], longitude: places.place1.info.location[1] };
    if (places.place1.info.location.length > 2) location.altitude = places.place1.info.location[2];
  }

  self.client = new gsclient.ClientAPI({ clientID     : self.info.organization
                                       , clientSecret : self.info.apikey
                                       , logger       : utility.logfnx(logger, 'device/' + self.deviceID)
                                       , location      : location
                                       }).login(function(err, users, components, units) {
    var component, componentUID, i, streams, u, unit;

    if (!!err) {
      self.status = 'error';
      return logger.error('device/' + self.deviceID, { event: 'login', diagnostic: err.message });
    }

    self.status = 'ready';

    var addUnit = function(unitID) {
      return function(err, unitUID) {/* jshint unused: false */
        if (!!err) return logger.error('device/' + self.deviceID, { event: 'addUnit', id: unitID, diagnostic: err.message });
      };
    };

    for (u in sensor.units) {
      if (!sensor.units.hasOwnProperty(u)) continue;

      unit = sensor.units[u];
      if (!units[unit.units]) self.client.addUnit(unit.units, { name         : u
                                                              , symbol       : unit.symbol
                                                              , numberFormat : unit.numberFormat || '0,000.00'
                                                              }, addUnit(unit.units));
    }

    for (componentUID in components) {
      if (!components.hasOwnProperty(componentUID)) continue;
      component = components[componentUID];

      streams = {};
      for (i = 0; i < component.stream.length; i++) streams[component.stream[i].id] = component.stream[i].uid;
      self.components[component.id] = { uid: component.uid, streams: streams };
    }
  });

  self.prime(self);
  setInterval(function() {
    var component, components, componentUID, inflight, streamUID;

    if ((self.status !== 'ready') || (!self.samples) || (self.uploadP)) return;
    self.uploadP = true;

    components = [];
    for (componentUID in self.samples) {
      if (!self.samples.hasOwnProperty(componentUID)) continue;

      component = { componentUid: componentUID, stream: [] };
      for (streamUID in self.samples[componentUID]) {
        if (!self.samples[componentUID].hasOwnProperty(streamUID)) continue;

        component.stream.push(self.samples[componentUID][streamUID]);
      }
      components.push(component);
    }
    inflight = self.samples;
    delete(self.samples);

    self.client.addSamples({ component: components }, function(err) {
      var componentUID, streamUID;

      delete(self.uploadP);

      if (!!err) {
        if (err.message === 'HTTP response 403') {
          for (componentUID in inflight) {
            if (!inflight.hasOwnProperty(componentUID)) continue;

            if (!self.samples[componentUID]) self.samples[componentUID] = {};
            for (streamUID in inflight[componentUID]) {
              if (!inflight[componentUID].hasOwnProperty(streamUID)) continue;

              if (!self.samples[componentUID][streamUID]) {
                self.samples[componentUID][streamUID] = { streamUid: streamUID, data: [], time: [] };
              }
              self.samples[componentUID][streamUID].data =
                  inflight[componentUID][streamUID].data.concat(self.samples[componentUID][streamUID].data);
              self.samples[componentUID][streamUID].time =
                  inflight[componentUID][streamUID].time.concat(self.samples[componentUID][streamUID].time);
            }
          }
        }

        return logger.error('device/' + self.deviceID, { event: 'addPoint', diagnostic: err.message });
      }
    });
  }, 300 * 1000);
};
util.inherits(GroveStreams, indicator.Device);


GroveStreams.prototype.prime = function(self) {
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

// in order to simplify implementation, we drop data points until everything is ready...

GroveStreams.prototype.update = function(self, deviceID, point) {
  var actor, componentID, componentUID, entity, device, properties, streamID, streamUID;

  if (self.status !== 'ready') return;
  if ((!!self.sensors) && (!self.sensors[deviceID])) return;
  if ((!!self.measurements) && (!self.measurements[point.measure.name])) return;

  componentID = 'device/' + deviceID;
  if (typeof self.components[componentID] === 'undefined') {
    self.components[componentID] = {};

    actor = steward.actors.device;
    if (!!actor) {
      entity = actor.$lookup(deviceID);
      if (!!entity) device = entity.proplist();
    }
    if (!device) device = { name: componentID, info: {} };
    properties = { name : device.name };
    if (device.info.location) {
      properties.location = { latitude: device.info.location[0], longitude: device.info.location[1] };
      if (device.info.location.length > 2) properties.location.altitude = device.info.location[2];
    }

    return self.client.addComponent(componentID, properties, function(err, componentUID) {
      if (!!err) return logger.error('device/' + self.deviceID,
                                     { event: 'addComponent', id: componentID, diagnostic: err.message });

      self.components[componentID] = { uid: componentUID, streams: {} };
      self.update(self, deviceID, point);
    });
  }
  if (!self.components[componentID].uid) {
    logger.info('device/' + self.deviceID, { event: 'addComponent wait', deviceID: deviceID });
    return;
  }
  componentUID = self.components[componentID].uid;

  streamID = point.measure.name;
  if (typeof self.components[componentID].streams[streamID] === 'undefined') {
    self.components[componentID].streams[streamID] = 0;

    if (!self.client.units[point.measure.label]) {
      return logger.error('device/' + self.deviceID, { event: 'unit', id: point.measure.label, diagnostic: 'no such unit' });
    }

    return self.client.addStream(componentUID, point.measure.name,
                                 { name      : point.measure.name
                                 , valueType : 'float'
                                 , unit      : { uid: self.client.units[point.measure.label].uid }
                                 }, function(err, streamUID) {
      if (!!err) return logger.error('device/' + self.deviceID,
                                     { event: 'addStream', id: point.measure.name, diagnostic: err.message });

      self.components[componentID].streams[streamID] = streamUID;
      self.update(self, deviceID, point);
    });
  }
  if (self.components[componentID].streams[streamID] === 0) {
    logger.info('device/' + self.deviceID, { event: 'addStream wait', deviceID: deviceID, point: point });
    return;
  }
  streamUID = self.components[componentID].streams[streamID];

  if (!self.samples) self.samples = { };
  if (!self.samples[componentUID]) self.samples[componentUID] = {};
  if (!self.samples[componentUID][streamUID]) {
    self.samples[componentUID][streamUID] = { streamUid: streamUID, data: [], time: [] };
  }
  self.samples[componentUID][streamUID].data.push(point.value);
  self.samples[componentUID][streamUID].time.push(point.timestamp);
};


GroveStreams.prototype.perform = function(self, taskID, perform, parameter) {
  var params, updateP;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  updateP = false;
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
  self.prime(self);

  if (updateP) self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.apikey) result.requires.push('apikey');
  else if ((typeof info.apikey !== 'string') || (info.apikey.length !== 36)) result.invalid.push('apikey');

  if (!info.organization) result.requires.push('organization');
  else if ((typeof info.organization !== 'string') || (info.organization.length !== 36)) result.invalid.push('organization');

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

  steward.actors.device.indicator.grovestreams = steward.actors.device.indicator.grovestreams ||
      { $info     : { type: '/device/indicator/grovestreams' } };

  measurements = {};
  for (measureName in sensor.measures) {
    if (sensor.measures.hasOwnProperty(measureName)) measurements[measureName] = sensor.measures[measureName].units;
  }

  steward.actors.device.indicator.grovestreams.sensor =
      { $info     : { type       : '/device/indicator/grovestreams/sensor'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error' ]
                                   , apikey       : true
                                   , organization : true
                                   , measurements : measurements
                                   , sensors      : []
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/grovestreams/sensor'] = GroveStreams;
};
