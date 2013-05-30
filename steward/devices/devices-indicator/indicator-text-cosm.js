// cosm - send measurements to http://cosm.com

var cosm        = require('cosm')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , indicator   = require('./../device-indicator')
  ;


var logger = indicator.logger;


var Cosm = exports.Device = function(deviceID, deviceUID, info) {
  var actor, entity, params, place, self;

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
  self.changed();

  self.elide = [ 'apikey' ];

  self.cosm = new cosm.Cosm(info.apikey);
  self.datastreams = {};

  utility.broker.subscribe('readings', function(deviceID, point) { self.update(self, deviceID, point); });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'ping') {
      logger.info('device/' + self.deviceID, { status: self.status });
      return;
    }

         if (actor !== ('device/' + self.deviceID)) return;
    else if (request === 'perform') self.perform(self, taskID, perform, parameter);
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
    if (err) {
      self.status = 'error';
      self.setInfo();
      return logger.error('device/' + self.deviceID, { event: 'cosm.create', diagnostic: err.message });
    }

    self.info.feed = id.toString();
    self.setInfo();

    self.getfeed(self);
  });

};
util.inherits(Cosm, indicator.Device);


Cosm.prototype.getfeed = function(self) {
  self.cosm.get(self.info.feed, function(err, feed) {
    if (err) {
      self.status = 'error';
      self.setInfo();
      return logger.error('device/' + self.deviceID, { event: 'cosm.get', diagnostic: err.message });
    }

    self.feed = feed;
    self.feed.get(function(err, data) {
      var deviceID, i, id;

      if (err) {
        self.status = 'error';
        self.setInfo();
        return logger.error('device/' + self.deviceID, { event: 'feed.get', diagnostic: err.message });
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

      if (err) return logger.error('device/' + self.deviceID, { event: 'feed.addPoint', diagnostic: err.message });
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
    if (err) return logger.error('device/' + self.deviceID, { event: 'feed.addStream', diagnostic: err.message });

    self.datastreams[point.streamID] = new cosm.Datastream(self.cosm, self.feed, { id : point.streamID });
    self.datastreams[point.streamID].addPoint(point.value, new Date(point.timestamp), function(err, response, body) {
      /* jshint unused: false */

      if (err) return logger.error('device/' + self.deviceID, { event: 'feed.addPoint', diagnostic: err.message });
    });
  });
};


Cosm.prototype.perform = function(self, taskID, perform, parameter) {
  var onoff, params;

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

  if ((!!params.private) && ((params.private === 'on') || (params.private === 'off'))) {
    self.info.private = params.private;
    onoff = self.info.private === 'on';
    if (self.feed.private != onoff) {
      self.feed.private = onoff;
      self.feed.save(function(err, response, body) {/* jshint unused: false */
        if (err) return logger.error('device/' + self.deviceID, { event: 'feed.save', diagnostic: err.message });
      });
    }
  }

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.apikey) result.requires.push('apikey');
  else if ((typeof info.apikey !== 'string') || (info.apikey.length !== 52)) result.invalid.push('apikey');

  if ((!!info.measurements) && (!util.isArray(info.measurements))) result.invalid.push('measurements');
  if ((!!info.sensors) && (!util.isArray(info.sensors))) result.invalid.push('sensors');
  if ((!!info.private) && (info.private !== 'on') && (info.private !== 'off')) result.invalid.push('private');

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
  steward.actors.device.indicator.text = steward.actors.device.indicator.text ||
      { $info     : { type: '/device/indicator/text' } };

  steward.actors.device.indicator.text.cosm =
      { $info     : { type       : '/device/indicator/text/cosm'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error' ]
                                   , apikey       : true
                                   , measurements : { temperature : 'celsius'
                                                    , humidity    : 'percentage'
                                                    , co2         : 'ppm'
                                                    , noise       : 'decibels'
                                                    , pressure    : 'millibars'
                                                    }
                                   , sensors      : []
                                   , private      : [ 'on', 'off' ]
                                   }
                    }
      , $validate : {  create    : validate_create
                    ,  perform   : validate_perform
                    }
      };
  devices.makers['/device/indicator/text/cosm'] = Cosm;
};
