// automatic - an auto accessory to make you a smarter driver: http://www.automatic.com

var AutomaticAPI= require('automatic-api')
  , url         = require('url')
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
  if (!self.info.users) self.info.users = {};

  self.status = 'waiting';
  self.elide = [ 'clientID', 'clientSecret', 'users' ];
  self.changed();
  self.timer = null;
  self.clients = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!self.info.clientID) && (!!self.info.clientSecret)) self.login(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.login = function(self) {
  var ipaddr, portno;

  self.status = 'ready';
  self.changed();

  if (!!self.timer) clearInterval(self.timer);

  var bgerror = function(err) { logger.error('device/' + self.device, { event: 'background', diagnostic: err.message }); };

  self.lookup('automatic', function(err, options) {
    var client, user;

    if (!!err) logger.warning('device/' + self.deviceID, { event: 'lookup', diagnostic: err.message });

    ipaddr = options.ipaddr;
    portno = options.portno;
    logger.info('device/' + self.deviceID, { event  : 'listen'
                                           , remote : 'tcp://' + ipaddr + ':' + portno
                                           , proxy  : options.proxy
                                           });
    self.info.authorizeURL = 'http://' + options.ipaddr + ':' + options.portno + '/';

    for (user in self.info.users) {
      if (!self.info.users.hasOwnProperty(user)) continue;

      client = new AutomaticAPI.AutomaticAPI({ clientID: self.info.clientID, clientSecret: self.info.clientSecret})
                  .on('error', bgerror).setState(self.info.users[user].state);
      self.info.users[user].client = client;
      self.scan(self, client);
    }

    self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
  }, function(request, response) {
    var body = '';

console.log('>>> automatic request ' + request.method);
    if ((request.method !== 'GET') && (request.method !== 'POST')) {
      logger.info('device/' + self.deviceID, { event: 'request', method: request.method });

      response.writeHead(405, { Allow: 'GET, POST' });
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
      var client, data, parts, requestURL, udn, vehicle;

console.log('>>> automatic end: ' + body);
      var loser = function (message) {
        logger.error('device/' + self.deviceID, { event: 'request', diagnostic: message });

        response.writeHead(200, { 'content-type': 'text/plain; charset=utf8', 'content-length' : message.length });
        response.end(message);
      };

      if (request.method === 'POST') {
        try { data = JSON.parse(body); } catch(ex) { return loser(ex.message); }
console.log(data);
        if (!data.type) return loser('webhook missing type parameter');
        if ((!data.user) || (!data.user.id)) return loser('webhook missing user.id');
        if (!self.info.users[data.user.id]) return loser('internal error (somewhere!)');
        response.writeHead(200, { 'content-length' : 0 });
        response.end();

        udn = 'automatic:' + data.vehicle.id;
console.log('>>> automatic WEBHOOK udn='+udn+' exists='+(!!devices.devices[udn]));
        if (!devices.devices[udn]) return;

        vehicle = devices.devices[udn].device;
        if (!!vehicle) vehicle.webhook(vehicle, 'webhook', data);
        return;
      }

      parts = url.parse(request.url, true);
      if (!!parts.query.code) {
        if (!parts.query.state) return loser('invalid response from server');

        client = self.clients[parts.query.state];
        if (!client) return loser('invalid response from server');

        client.authorize(parts.query.code, parts.query.state, function(err, user, state, scopes) {/* jshint unused: false */
          if (!!err) return logger.error('device/' + self.deviceID,
                                         { event: 'request', diagnostic: 'authorization error: ' + err.message });

          self.info.users[user.id] = { client: client, state: state };
          self.setInfo2(self);

          self.scan(self, client);
        });

        response.writeHead(200, { 'content-length' : 0 });
        return response.end();
      }

      client = new AutomaticAPI.AutomaticAPI({ clientID: self.info.clientID, clientSecret: self.info.clientSecret})
                  .on('error', bgerror);

      requestURL = client.authenticateURL(null, 'http://' + ipaddr + ':' + portno + '/');
      parts = url.parse(requestURL, true);
      self.clients[parts.query.state] = client;

      response.writeHead(307, { location: requestURL, 'content-length' : 0 });
      response.end();
    });
  });
};

Cloud.prototype.error = function(self, event, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
};

Cloud.prototype.scan = function(self, client) {
  var user;

  if (!client) {
    for (user in self.info.users) if (!!self.info.users.hasOwnProperty(user)) self.scan(self, self.info.users[user].client);
    return;
  }

  client.roundtrip('GET', '/vehicles', null, function(err, results) {
    var entry, i, info, params, status, udn, vehicle;

    if (!!err) return self.error(self, '/vehicles', err);

    for (i = 0; i < results.length; i++) {
      entry = results[i];

      params = {};
      status = 'ready';

      udn = 'automatic:' + entry.id;
console.log('>>> /vehicles udn='+udn+' exists='+(!!devices.devices[udn]));
console.log(entry);
      if (!!devices.devices[udn]) {
        vehicle = devices.devices[udn].device;
        if (!!vehicle) vehicle.update(vehicle, params);
        continue;
      }

      params.status = status;
      info =  { source: self.deviceID, gateway: self, params: params };
      info.device = { url                          : null
                    , name                         : entry.display_name
                    , manufacturer                 : entry.make
                    , model        : { name        : entry.model
                                     , description : entry.year + ' ' + entry.make + ' ' + entry.model
                                     , number      : ''
                                     }
                    , unit         : { serial      : entry.id
                                     , udn         : udn
                                     }
                    };

      info.url = info.device.url;
      info.deviceType = '/device/motive/automatic/vehicle';
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
      devices.discover(info);
      self.changed();
    }

    client.roundtrip('GET', '/trips', null, function(err, results) {
      var entry, i, udn, vehicle, vehicles;

      if (!!err) return self.error(self, '/trips', err);

      vehicles = {};
      for (i = 0; i < results.length; i++) {
        entry = results[i];

        if (!!vehicles[entry.vehicle.id]) continue;
        vehicles[entry.vehicle.id] = true;

        udn = 'automatic:' + entry.vehicle.id;
console.log('>>> /trips udn='+udn+' ready='+(!!devices.devices[udn]));
console.log(entry);
        if (!devices.devices[udn]) continue;

        vehicle = devices.devices[udn].device;
        if (!!vehicle) vehicle.webhook(vehicle, 'trip', { vehicle    : { id: entry.vehicle.id }
                                                        , location   : entry.end_location
                                                        , created_at : entry.end_time
                                                        , path       : entry.path
                                                        , type       : 'trip:summary'
                                                        });
      }
    });
  });
};

Cloud.prototype.setInfo2 = function(self) {
  var snapshot, user;

  snapshot = self.info.users;
  self.info.users = {};
  for (user in snapshot) if (snapshot.hasOwnProperty(user)) self.info.users[user] = { state: snapshot[user].state };
  self.setInfo();
  self.info.users = snapshot;
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var clientID, clientSecret, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  clientID = self.info.clientID;
  if (!!params.clientID) self.info.clientID = params.clientID;
  clientSecret = self.info.clientSecret;
  if (!!params.clientSecret) self.info.clientSecret = params.clientSecret;
  if ((!!self.info.clientID) && (!!self.info.clientSecret)) {
    if ((self.info.clientID !== clientID) || (self.info.clientSecret !== clientSecret)) self.login(self);
  }


  self.setInfo2(self);

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.clientID) result.requires.push('clientID');
  else if ((typeof info.clientID !== 'string') || (info.clientID.length !== 20)) result.invalid.push('clientID');

  if (!info.clientSecret) result.requires.push('clientSecret');
  else if ((typeof info.clientSecret !== 'string') || (info.clientSecret.length !== 40)) result.invalid.push('clientSecret');

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

  if (!params.clientID) params.clientID = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  if (!params.clientSecret) params.clientSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.automatic = steward.actors.device.gateway.automatic ||
      { $info     : { type: '/device/gateway/automatic' } };

  steward.actors.device.gateway.automatic.cloud =
      { $info     : { type       : '/device/gateway/automatic/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , clientID     : true
                                   , clientSecret : true
                                   , authorizeURL : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/automatic/cloud'] = Cloud;
};
