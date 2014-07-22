// lockitron - Keyless entry using your phone: http://lockitron.com

var Lockitron   = require('lockitron-api')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  ;


var logger   = exports.logger = utility.logger('gateway');


var Cloud = exports.Device = function(deviceID, deviceUID, info) {
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
  self.elide = [ 'accessToken' ];
  self.changed();
  self.timer = null;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if (!!self.info.accessToken) self.login(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.login = function(self) {
  self.lockitron = new Lockitron.LockitronAPI({ clientID     : 'n/a'
                                              , clientSecret : 'n/a'
                                              , logger       : utility.logfnx(logger, 'device/' + self.deviceID)
                                              }).on('error',
  function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.login(self); }, 30 * 1000);
  }).setState({ accessToken: self.info.accessToken });

  self.status = 'ready';
  self.changed();

  if (!!self.timer) clearInterval(self.timer);
  self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
  self.scan(self);

  self.lookup('lockitron', function(err, options) {
    if (!!err) logger.warning('device/' + self.deviceID, { event: 'lookup', diagnostic: err.message });

    logger.info('device/' + self.deviceID, { event  : 'listen'
                                           , remote : 'tcp://' + options.ipaddr + ':' + options.portno
                                           , proxy  : options.proxy
                                           });
  }, function(request, response) {
    var body = '';

    if (request.method !== 'POST') {
      logger.info('device/' + self.deviceID, { event: 'request', method: request.method });

      response.writeHead(405, { Allow: 'POST' });
      return response.end();
    }

    request.setEncoding('utf8');
    request.on('data', function(chunk) {
      body += chunk.toString();
    }).on('close', function() {
      logger.warning('device/' + self.deviceID, { event:'close', diagnostic: 'premature eof' });
    }).on('clientError', function(err, socket) {/* jshint unused: false */
      logger.warning('device/' + self.deviceID, { event:'clientError', diagnostic: err.message });
    }).on('end', function() {
      var json, lock, udn;

      var loser = function (message) {
        logger.error('device/' + self.deviceID, { event: 'request', diagnostic: message });

        response.writeHead(200, { 'content-type': 'text/plain; charset=utf8', 'content-length' : message.length });
        response.end(message);
      };

      try { json = JSON.parse(body); } catch(ex) { return loser(ex.message); }
      if (!json.data) return loser('webhook missing data parameter');
      if (!json.data.lock) return loser('webhook missing data.lock parameter');
      response.writeHead(200, { 'content-length' : 0 });
      response.end();

      udn = 'lockitron:' + json.data.lock.id;
      if (!devices.devices[udn]) return;

      lock = devices.devices[udn].device;
      if (!!lock) lock.webhook(lock, 'webhook', json.data);
    });
  });
};

Cloud.prototype.error = function(self, event, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.lockitron) return;

  self.lockitron.roundtrip('GET', '/locks', null, function(err, results) {
    var entry, i, info, lock, now, params, status, udn;

    if (!!err) { self.lockitron = null; return self.error(self, 'roundtrip', err); }

    now = new Date().getTime();
    for (i = 0; i < results.length; i++) {
      entry = results[i].lock;

      params = { lastSample : now };
      if ((!!entry.latitude) && (!!entry.longitude)) params.location = [ entry.atitude, entry.longitude ];
      status = entry.status === 'lock' ? 'locked' : 'unlocked';

      udn = 'lockitron:' + entry.id;
      if (!!devices.devices[udn]) {
        lock = devices.devices[udn].device;
        if (!!lock) lock.update(lock, params, status);
        return;
      }

      params.status = status;
      info =  { source: self.deviceID, gateway: self, params: params };
      info.device = { url                          : null
                    , name                         : entry.name
                    , manufacturer                 : 'Lockitron'
                    , model        : { name        : 'Lockitron'
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : entry.id
                                     , udn         : udn
                                     }
                    };

      info.url = info.device.url;
      info.deviceType = '/device/motive/lockitron/lock';
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
      devices.discover(info);
      self.changed();
    }
  });
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var accessToken, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);
  if (!!params.ikon) self.setIkon(params.ikon);

  accessToken = self.info.accessToken;
  if (!!params.accessToken) self.info.accessToken = params.accessToken;
  if ((!!self.info.accessToken) && (self.info.accessToken !== accessToken)) self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.accessToken) result.requires.push('accessToken');
  else if ((typeof info.accessToken !== 'string') || (info.accessToken.length !== 64)) result.invalid.push('accessToken');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.accessToken) params.accessToken = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.lockitron = steward.actors.device.gateway.lockitron ||
      { $info     : { type: '/device/gateway/lockitron' } };

  steward.actors.device.gateway.lockitron.cloud =
      { $info     : { type       : '/device/gateway/lockitron/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , accessToken : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/lockitron/cloud'] = Cloud;

  utility.acquire2(__dirname + '/../*/*-lockitron-*.js', function(err) {
    if (!!err) logger('lockitron-cloud', { event: 'glob', diagnostic: err.message });
  });
};
