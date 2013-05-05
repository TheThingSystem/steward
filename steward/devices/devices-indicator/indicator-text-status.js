// status - dump steward status in json : e.g., http://panic.com/statusboard/

var fs          = require('fs')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , indicator   = require('./../device-indicator')
  ;


var logger = indicator.logger;


var Status = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);
  self.status = 'unknown';
  fs.stat(self.info.directory, function (err, stats) {
    if (err) {
      return logger.error('device/' + self.deviceID, { event: 'fs.stat', path: self.info.directory, diagnostic: err.message });
    }
    self.status = stats.isDirectory() ? 'ready' : 'error';
  });

  self.reporting = {};
  utility.broker.subscribe('status', function(module, data) { self.report(self, module, data); });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'ping') {
      logger.info('device/' + self.deviceID, { status: self.status });
      return;
    }

         if (actor !== ('device/' + self.deviceID)) return;
    else if (request === 'perform') self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Status, indicator.Device);


Status.prototype.report = function(self, module, data) {
  var json = self.info.directory + '/' + module + '.json'
    , tmp  = self.info.directory + '/' + module + '.tmp'
    ;

  if (!!self.reporting[module]) return setTimeout(function() { self.report(self,module, data); }, 500);
  self.report[module] = true;

  fs.writeFile(tmp, data, function(err) {
    if (err) {
      logger.error('report ' + module, { event: 'write', exception: err });
      fs.unlink(tmp, function(err) {/* jshint unused: false */});
      self.report[module] = false;
      return;
    }

    fs.rename(tmp, json, function(err) {
      if (err) {
        logger.error('report ' + module, { event: 'rename', exception: err });
        fs.unlink(tmp, function(err) {/* jshint unused: false */});
        self.report[module] = false;
        return;
      }
    });
  });
};


Status.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if ((!!params.directory) && (self.info.directory !== params.directory)) {
    if (!fs.statSync(params.directory).isDirectory()) return false;
    self.info.directory = params.directory;
    self.setInfo();
  }

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.directory) result.requires.push('directory');
  else if (!fs.statSync(info.directory).isDirectory()) result.invalid.push('directory');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.directory) result.requires.push('directory');
  else if (!fs.statSync(params.directory).isDirectory()) result.invalid.push('directory');

  return result;
};


exports.start = function() {
  steward.actors.device.indicator.text = steward.actors.device.indicator.text ||
      { $info     : { type: '/device/indicator/text' } };

  steward.actors.device.indicator.text.status =
      { $info     : { type       : '/device/indicator/text/status'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name      : true
                                   , status    : [ 'unknown', 'ready', 'error' ]
                                   , directory : true
                                   }
                    }
      , $validate : {  create    : validate_create
                    ,  perform   : validate_perform
                    }
      };
  devices.makers['/device/indicator/text/status'] = Status;
};
