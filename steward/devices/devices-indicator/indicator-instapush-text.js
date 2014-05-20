// instapush - Push Notifications: http://instapush.im

var instapush   = require('Instapush')
  , util        = require('util')
  , winston     = require('winston')
  , serialize   = require('winston/lib/winston/common').serialize
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  ;


var logger = indicator.logger;


var Instapush = exports.Device = function(deviceID, deviceUID, info) {
  var self     = this
    , previous = {}
    ;

  self.growl = function(err, result) {
    if ((!!result) && (!!result.error) && (!!result.msg)) err = new Error(result.msg);
    if (!!err) {
      if (typeof err === 'string') err = new Error(err);

      self.status = 'error';
      self.changed();
      logger.error('device/' + self.deviceID, { diagnostic: err.message });
      return;
    }

    if (self.status !== 'ready') {
      self.status = 'ready';
      self.changed();
    }

    logger.debug('device/' + self.deviceID, result);
  };

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.appname = self.info.appname || self.name;
  self.prefix  = (!!self.info.prefix) ? (self.info.prefix + ': ') : '';
  self.prefix2 = (!!self.info.prefix) ? (self.info.prefix + '/')  : '';
  self.priority = winston.config.syslog.levels[self.info.priority || 'notice'] || winston.config.syslog.levels.notice;
  self.info.priority = utility.value2key(winston.config.syslog.levels, self.priority);
  self.instapush = new instapush();
  self.instapush.settings({ token: self.info.token, id: self.info.appID, secret: self.info.secret, ssl: true });
  self.status = 'ready';
  self.elide = [ 'token', 'appID', 'secret' ];
  self.changed();

  self.instapush.listEvents(function(err, result) {
    var i, level, levels;

    if ((!!err) || ((!!result) && (!!result.error) && (!!result.msg))) return self.growl(err);

    levels = [];
    for (i = 0; i < result.length; i++) levels.push(result[i].title);
    for (level in winston.config.syslog.levels) {
      if (levels.indexOf(level) !== -1) continue;

      self.instapush.addEvent({ title: level, trackers: [ 'message' ], message: "{message}" }, self.growl);
    }
  });

  broker.subscribe('beacon-egress', function(category, data) {
    var datum, i, now, parameter;

    if (!util.isArray(data)) data = [ data ];
    for (i = 0; i < data.length; i++) {
      datum = data[i];
      if (!datum.date) continue;

      if ((!winston.config.syslog.levels[datum.level]) || (winston.config.syslog.levels[datum.level] < self.priority)) continue;

      if (!previous[datum.level]) previous[datum.level] = {};
      now = new Date(datum.date).getTime();
      if ((!!previous[datum.level][datum.message]) && (previous[datum.level][datum.message] > now)) continue;
      previous[datum.level][datum.message] = now + (60 * 1000);

      parameter = category + ': ' + datum.message;
      if (!!datum.meta) parameter += ' ' + serialize(datum.meta);

  self.instapush.notify({ title    : self.appname + ' ' + self.prefix2
                        , event    : datum.level
                        , trackers : {  message: parameter }
                        , message  : "{message}"
                        }, self.growl);
    }
  });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Instapush, indicator.Device);


Instapush.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) {
      self.setName(params.name);
      delete(params.name);
    }

    if (self.updateInfo(params)) self.setInfo();

    return true;
  }
  if (perform !== 'growl') return false;
  params.message = devices.expand(params.message, 'device/' + self.deviceID);

  if ((!params.priority) || (!params.message) || (params.message.length === 0)) return false;

  if ((!winston.config.syslog.levels[params.priority])
        || (winston.config.syslog.levels[params.priority] < self.priority)) return false;

  self.instapush.notify({ title    : self.appname + ' ' + self.prefix
                        , event    : params.priority
                        , trackers : {  message: params.message }
                        , message  : "{message}"
                        }, self.growl);
  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.token) result.requires.push('token');
  else if ((typeof info.token !== 'string') || (info.token.length !== 24)) result.invalid.push('token');

  if (!info.appID) result.requires.push('appID');
  else if ((typeof info.appID !== 'string') || (info.appID.length !== 24)) result.invalid.push('appID');

  if (!info.secret) result.requires.push('secret');
  else if ((typeof info.secret !== 'string') || (info.secret.length !== 32)) result.invalid.push('secret');

  if ((!!info.priority) && (!winston.config.syslog.levels[info.priority])) result.invalid.push('priority');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if (!params.token) params.token = 'XXXXXXXXXXXXXXXXXXXXXXXX';
    if (!params.appID) params.appID = 'XXXXXXXXXXXXXXXXXXXXXXXX';
    if (!params.secret) params.secret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    return validate_create(params);
  }

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
  steward.actors.device.indicator.instapush = steward.actors.device.indicator.instapush ||
      { $info     : { type: '/device/indicator/instapush' } };

  steward.actors.device.indicator.instapush.text =
      { $info     : { type       : '/device/indicator/instapush/text'
                    , observe    : [ ]
                    , perform    : [ 'growl' ]
                    , properties : { name     : true
                                   , status   : [ 'ready', 'error' ]
                                   , appname  : true
                                   , token    : true
                                   , appID    : true
                                   , secret   : true
                                   , prefix   : true
                                   , priority : utility.keys(winston.config.syslog.levels)
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/instapush/text'] = Instapush;
};
