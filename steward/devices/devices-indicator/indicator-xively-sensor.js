// cosm - send measurements to http://xively.com

var cosm        = require('cosm')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  , sensor      = require('./../device-sensor')
  ;


var logger = indicator.logger;


var Cosm = exports.Device = function(deviceID, deviceUID, info) {
  var actor, entity, params, place, self;

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

  self.cosm = new cosm.Cosm(info.apikey, { server: 'https://api.xively.com' });
  self.datastreams = {};

  broker.subscribe('readings', function(deviceID, point) { self.update(self, deviceID, point); });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'attention') {
      if (self.status === 'error') self.alert('please check login credentials at https://xively.com/login/');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if (!!self.info.feed) return self.getfeed(self);

  actor = steward.actors.place;
  if (!!actor) {
    entity = actor.$lookup("1");
    if (!!entity) place = entity.proplist();
  }
  if (!place) place = { name: '', info: {} };

  params = { version       : '1.0.0'
           , title         : info.name || place.name
           , description   : info.description || null
           , location      :
             { disposition : 'fixed'
             , name        : place.name
             , exposure    : 'indoor'
             , domain      : 'physical'
             }
           , private       : (!!info.private) ? (info.private === 'on') : false
           };
  if (util.isArray(place.info.coordinates)) {
    params.location.lat = place.info.coordinates[0];
    params.location.lon = place.info.coordinates[1];
    if (place.info.coordinates.length > 2) params.location.ele = place.info.coordinates[2];
    if (!params.private) {
      params.location.lat = params.location.lat.toFixed(1);
      params.location.lon = params.location.lon.toFixed(1);
      params.location.ele = params.location.ele.toFixed(1);
    }
  }

  self.cosm.create(params, function(err, id) {
    if (!!err) {
      self.status = 'error';
      self.setInfo();
      return logger.error('device/' + self.deviceID, { event: 'cosm.create', diagnostic: err.message || err.errors });
    }

    self.info.feed = id.toString();
    self.setInfo();

    self.getfeed(self);
  });
};
util.inherits(Cosm, indicator.Device);


Cosm.prototype.getfeed = function(self) {
  self.cosm.get(self.info.feed, function(err, feed) {
    if (!!err) {
      self.status = 'error';
      self.setInfo();
      return logger.error('device/' + self.deviceID, { event: 'cosm.get', diagnostic: err.message || err.errors });
    }

    self.feed = feed;
    self.feed.get(function(err, data) {
      var deviceID, i, id;

      if (!!err) {
        self.status = 'error';
        self.setInfo();
        return logger.error('device/' + self.deviceID, { event: 'feed.get', diagnostic: err.message || err.errors });
      }

      self.status = 'ready';
      self.setInfo();

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

      data.datastreams = data.datastreams || [];
      if (!util.isArray(data.datastreams)) return;

      for (i = 0; i < data.datastreams.length; i++) {
        id = data.datastreams[i].id;
        self.datastreams[id] = new cosm.Datastream(self.cosm, self.feed, { id: id });
      }
    });
  });
};

Cosm.prototype.update = function(self, deviceID, point) {
  var actor, entity, device, tags;

  if (self.status !== 'ready') return;
  if ((!!self.sensors) && (!self.sensors[deviceID])) return;
  if ((!!self.measurements) && (!self.measurements[point.measure.name])) return;

  if (self.datastreams[point.streamID]) {
    return self.datastreams[point.streamID].addPoint(point.value, new Date(point.timestamp), function(err, response, body) {
      /* jshint unused: false */

      if (!!err) return logger.error('device/' + self.deviceID,
                                     { event: 'feed.addPoint', diagnostic: err.message || err.errors });
    });
  }

  actor = steward.actors.device;
  if (!!actor) {
    entity = actor.$lookup(deviceID);
    if (!!entity) device = entity.proplist();
  }
  if (!device) device = { name: '' };
  tags = [ point.measure.name ];
  if (!!device.name) tags.push(device.name);

  self.feed.addStream({ id     : point.streamID
                      , tags   : tags
                      , unit   : { type: point.measure.type, label: point.measure.label, symbol: point.measure.symbol }
                      }, function(err, body) {/* jshint unused: false */
    if (!!err) return logger.error('device/' + self.deviceID,
                                   { event: 'feed.addStream', diagnostic: err.message || err.errors });

    self.datastreams[point.streamID] = new cosm.Datastream(self.cosm, self.feed, { id : point.streamID });
    self.datastreams[point.streamID].addPoint(point.value, new Date(point.timestamp), function(err, response, body) {
      /* jshint unused: false */

      if (!!err) return logger.error('device/' + self.deviceID,
                                     { event: 'feed.addPoint', diagnostic: err.message || err.errors });
    });
  });
};


Cosm.prototype.perform = function(self, taskID, perform, parameter) {
  var onoff, params, updateP;

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

  if ((!!params.private) && ((params.private === 'on') || (params.private === 'off'))) {
    updateP = true;
    self.info.private = params.private;
    onoff = self.info.private === 'on';
    if (self.feed.private != onoff) {
      self.feed.private = onoff;
      self.feed.save(function(err, response, body) {/* jshint unused: false */
        if (err) return logger.error('device/' + self.deviceID, { event: 'feed.save', diagnostic: err.message || err.errors });
      });
    }
  }
  if (updateP) self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.apikey) result.requires.push('apikey');
  else if ((typeof info.apikey !== 'string') || (info.apikey.length < 48)) result.invalid.push('apikey');

  if (!info.feed) result.requires.push('feed');
  else if ((typeof info.feed !== 'string') || (info.feed.length < 8)) result.invalid.push('feed');

  if ((!!info.measurements) && (!util.isArray(info.measurements))) result.invalid.push('measurements');
  if ((!!info.sensors) && (!util.isArray(info.sensors))) result.invalid.push('sensors');
  if ((!!info.private) && (info.private !== 'on') && (info.private !== 'off')) result.invalid.push('private');

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

  steward.actors.device.indicator.xively = steward.actors.device.indicator.xively ||
      { $info     : { type: '/device/indicator/xively' } };

  measurements = {};
  for (measureName in sensor.measures) {
    if (sensor.measures.hasOwnProperty(measureName)) measurements[measureName] = sensor.measures[measureName].units;
  }

  steward.actors.device.indicator.xively.sensor =
      { $info     : { type       : '/device/indicator/xively/sensor'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error' ]
                                   , apikey       : true
                                   , feed         : true
                                   , measurements : measurements
                                   , sensors      : []
                                   , private      : [ 'on', 'off' ]
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/xively/sensor'] = Cosm;
};
