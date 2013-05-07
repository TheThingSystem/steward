// prowl - iOS Push Notifications: http://prowlapp.com

var prowler     = require('node-prowl')
  , stringify   = require('json-stringify-safe')
  , util        = require('util')
  , winston     = require('winston')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , indicator   = require('./../device-indicator')
  ;


var logger = indicator.logger;


var Prowl = exports.Device = function(deviceID, deviceUID, info) {
  var self = this
    , previous = null;

  self.growl = function(err, remaining) {
    if (err) {
      self.status = 'error';
      logger.error('device/' + self.deviceID, { diagnostic: err.message });
      return;
    }

    self.status = 'ready';
    logger.debug('device/' + self.deviceID, { limit: remaining + ' remaining calls this hour' });
  };

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.appname = self.info.appname || self.name;
  self.prefix = (!!self.info.prefix) ? (self.info.prefix + ': ') : '';
  self.prefix2 = (!!self.info.prefix) ? (self.info.prefix + '/') : '';
  self.priority = winston.config.syslog.levels[self.info.priority || 'notice'] || winston.config.syslog.levels.notice;
  self.info.priority = utility.value2key(winston.config.syslog.levels, self.priority);
  self.prowl = new prowler(self.info.apikey);
  self.status = 'ready';

  self.elide = [ 'apikey' ];

  utility.broker.subscribe('beacon-egress', function(category, datum) {
    var parameter;

    if ((!winston.config.syslog.levels[datum.level]) || (winston.config.syslog.levels[datum.level] < self.priority)) return;

    parameter = category + ': ' + datum.message;
    if (!!datum.meta) parameter += ' ' + stringify(datum.meta);

    if (parameter === previous) return;
    previous = parameter;

    self.prowl.push(self.prefix2 + parameter, self.appname, self.growl);
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'ping') {
      logger.info('device/' + self.deviceID, { status: self.status });
      return;
    }

         if (actor !== ('device/' + self.deviceID)) return;
    else if (request === 'perform') self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Prowl, indicator.Device);


Prowl.prototype.perform = function(self, taskID, perform, parameter) {
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
    if (updateP) self.setInfo();

    return true;
  }
  if (perform !== 'growl') return false;

  if ((!params.priority) || (!params.message) || (params.message.length === 0)) return;

  if ((!winston.config.syslog.levels[params.priority])
        || (winston.config.syslog.levels[params.priority] <= self.priority)) return;

  self.prowl.push(self.prefix + params.message, self.appname, self.growl);
  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.apikey) result.requires.push('apikey');
  else if ((typeof info.apikey !== 'string') || (info.apikey.length !== 40)) result.invalid.push('apikey');

  if ((!!info.priority) && (!winston.config.syslog.levels[info.priority])) result.invalid.push('priority');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!params.apikey) params.apikey = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
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
  steward.actors.device.indicator.text = steward.actors.device.indicator.text ||
      { $info     : { type: '/device/indicator/text' } };

  steward.actors.device.indicator.text.prowl =
      { $info     : { type       : '/device/indicator/text/prowl'
                    , observe    : [ ]
                    , perform    : [ 'growl' ]
                    , properties : { name     : true
                                   , status   : [ 'unknown', 'ready', 'error' ]
                                   , appname  : true
                                   , apikey   : true
                                   , prefix   : true
                                   , priority : utility.keys(winston.config.syslog.levels)
                                   }
                    }
      , $validate : {  create    : validate_create
                    ,  perform   : validate_perform
                    }
      };
  devices.makers['/device/indicator/text/prowl'] = Prowl;
};
