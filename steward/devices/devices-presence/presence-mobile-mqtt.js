// http://owntracks.org

var util        = require('util')
  , winston     = require('winston')
  , db          = require('./../../core/database').db
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , presence    = require('./../device-presence')
  ;


var logger   = presence.logger;

var Mobile = exports.Device = function(deviceID, deviceUID, info) {
  var param, self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = {};
  if (!!info.params.status) {
    self.status = info.params.status;
    delete(info.params.status);
  } else self.status = 'present';
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  self.info.locations = [];
  self.timer = null;
  self.update(self, info.params);

  db.get('SELECT value FROM deviceProps WHERE deviceID=$deviceID AND key=$key',
               { $deviceID: self.deviceID, $key: 'info' }, function(err, row) {
    var params;

    if (err) {
      logger.error('device/' + self.deviceID, { event: 'SELECT info for ' + self.deviceID, diagnostic: err.message });
      return;
    }

    params = {};
    if (!!row) try { params = JSON.parse(row.value); } catch(ex) {}
    self.priority = winston.config.syslog.levels[params.priority || 'notice'] || winston.config.syslog.levels.notice;
    self.info.priority = utility.value2key(winston.config.syslog.levels, self.priority);
    self.changed();
  });

  broker.subscribe('actors', function(request, eventID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, perform, parameter);
  });

  setInterval(function() { self.reverseGeocode(self, logger); }, 60 * 1000);
};
util.inherits(Mobile, presence.Device);


Mobile.prototype.perform = function(self, taskID, perform, parameter) {
  var param, params, updateP;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return;

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
  if (updateP) self.setInfo();

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform !== 'set') result.invalid.push('perform');

  if ((!!params.priority) && (!winston.config.syslog.levels[params.priority])) result.invalid.push('priority');

  return result;
};


Mobile.prototype.update = function(self, params, status) {
  var param, updateP;

  updateP = false;
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    if (param === 'location') self.addlocation(self);
    updateP = true;
  }
  if (updateP) self.changed();
};

Mobile.prototype.detail = function(self, params) {/* jshint unused: false */};


exports.start = function() {
  steward.actors.device.presence.mqtt = steward.actors.device.presence.mqtt ||
      { $info     : { type: '/device/presence/mqtt' } };

  steward.actors.device.presence.mqtt.mobile =
      { $info     : { type       : '/device/presence/mqtt/mobile'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'present', 'recent', 'absent' ]
                                   , location     : 'coordinates'
                                   , locations    : []
                                   , accuracy     : 'meters'
                                   , batteryLevel : 'percentage'
                                   , physical     : true
                                   , distance     : 'kilometers'  // technically, it should be client-derived
                                   , priority     : utility.keys(winston.config.syslog.levels)
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/presence/mqtt/mobile'] = Mobile;

  steward.actors.device.presence.owntracks = utility.clone(steward.actors.device.presence.mqtt);
  steward.actors.device.presence.owntracks.$info.type = '/device/presence/owntracks';
  steward.actors.device.presence.owntracks.mobile = utility.clone(steward.actors.device.presence.mqtt.mobile);
  steward.actors.device.presence.owntracks.mobile.$info.type = '/device/presence/owntracks/mobile';
  devices.makers['/device/presence/owntracks/mobile'] = Mobile;
};
