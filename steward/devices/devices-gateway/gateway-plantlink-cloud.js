// plantlink: http://myplantlink.com

var events      = require('events')
  , https       = require('https')
  , querystring = require('querystring')
  , url         = require('url')
  , util        = require('util')
  , validator   = require('validator')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , gateway     = require('./../device-gateway')
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
  self.elide = [ 'passphrase' ];
  self.changed();
  self.pollsecs = 300;
  self.timer = null;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.email) && (!!info.passphrase)) setTimeout(function() { self.login(self); }, 0);
};
util.inherits(Cloud, gateway.Device);


Cloud.prototype.login = function(self) {
  self.cloudapi = new CloudAPI({ logger     : utility.logfnx(logger, 'device/' + self.deviceID)
                               }).login(self.info.email, self.info.passphrase, function(err) {
    if (!!err) { self.cloudapi = null; return self.error(self, err); }

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, self.pollsecs * 1000);
    self.scan(self);
  }).on('error', function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.login(self); }, 30 * 1000);
  });
};

Cloud.prototype.error = function(self, err) {
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.cloudapi) return;

  self.cloudapi.getGarden(function(err, plants, links, stations) {
    var battery, info, ipaddr, k, link, params, plant, rssi, secs, station, status, udn;

    if (!!err) return self.error(self, err);

    for (k in plants) {
      if (!plants.hasOwnProperty(k)) continue;
      plant = plants[k];

      if (!plant.last_measurements) plant.last_measurements = [];
      if (plant.last_measurements.length === 0) plant.last_measurements[0] = { updated: plant.updated };
      if (plant.user_lower_moisture_threshold) plant.lower_moisture_threshold = plant.user_lower_moisture_threshold;

      params = { placement       : plant.environment === 'Inside' ? 'indoors' : 'outdoors'
               , lastSample      : plant.last_measurements[0].updated * 1000
               };
      if (!!plant.last_measurements[0].moisture) {
        params.needsWater = plant.lower_moisture_threshold > plant.last_measurements[0].moisture ? 'true' : 'false';
      }

      udn = 'plantlink:plant:' + k;
      if (!!devices.devices[udn]) {
        station = devices.devices[udn].device;
        if (!!station) station.update(station, params, plant.status);
        continue;
      }

      params.status = plant.status;
      info =  { source: self.deviceID, gateway: self, params: params };
      info.device = { url                          : null
                    , name                         : plant.name
                    , manufacturer                 : 'PlantLink'
                    , model        : { name        : ''
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : k
                                     , udn         : udn
                                     }
                    };

      info.url = info.device.url;
      info.deviceType = '/device/climate/plantlink/plant';
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
      devices.discover(info);
      self.changed();
    }

    for (k in links) {
      if (!links.hasOwnProperty(k)) continue;
      link = links[k];

      secs = parseInt(link.poll_time, 10);
      if ((!isNaN(secs)) && (secs > 0) && (secs < self.pollsecs)) self.pollsecs = secs;

      if (!link.last_measurements) link.last_measurements = [];
      if (link.last_measurements.length === 0) link.last_measurements[0] = { updated: link.updated };

      params = { placement       : link.placement
               , lastSample      : link.last_measurements[0].updated * 1000
//             , moisture        :
               };
      if (!!link.last_measurements[0].battery) {
        battery = link.last_measurements[0].battery * 125;
        params.batteryLevel = (battery < 0) ? 0 : (battery > 100) ? 100 : battery;
      }
// not really RSSI, but close enough...
      if (!!link.last_measurements[0].signal) {
        rssi = (link.last_measurements[0].signal - 0.5) * 255;
        params.rssi = Math.floor((rssi < -127) ? -127 : (rssi > 127) ? 127 : rssi);
      }

      udn = 'plantlink:link:' + k;
      if (!!devices.devices[udn]) {
        station = devices.devices[udn].device;
        if (!!station) station.update(station, params, link.status);
        continue;
      }

      params.status = link.status;
      info =  { source: self.deviceID, gateway: self, params: params };
      info.device = { url                          : null
                    , name                         : 'Plant link ' + link.serial
                    , manufacturer                 : 'PlantLink'
                    , model        : { name        : ''
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : k
                                     , udn         : udn
                                     }
                    };

      info.url = info.device.url;
      info.deviceType = '/device/climate/plantlink/soil';
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
      devices.discover(info);
      self.changed();
    }

    for (k in stations) {
      if (!stations.hasOwnProperty(k)) continue;
      station = stations[k];

      params = { lastSample      : station.updated * 1000
               };

      status = station.station_online ? 'present' : 'absent';

      udn = 'plantlink:station:' + k;
      if (!!devices.devices[udn]) {
        station = devices.devices[udn].device;
        if (!!station) station.update(station, params, status);
        continue;
      }

      params.status = status;
      info =  { source: self.deviceID, gateway: self, params: params };
      ipaddr = devices.mac2ip(station.mac);
      info.device = { url                          : (!!ipaddr) ? 'ip://' + ipaddr : null
                    , name                         : 'Basestation ' + station.mac
                    , manufacturer                 : 'PlantLink'
                    , model        : { name        : ''
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : k
                                     , udn         : udn
                                     }
                    };

      info.url = info.device.url;
      info.deviceType = '/device/gateway/plantlink/station';
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
      devices.discover(info);
      self.changed();
    }
  });
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if (!!params.email) self.info.email = params.email;
  if (!!params.passphrase) self.info.passphrase = params.passphrase;
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.email) result.requires.push('email');
  else {
    try { validator.check(info.email).isEmail(); } catch(ex) { result.invalid.push('email'); }
  }

  if (!info.passphrase) result.requires.push('passphrase');
  else if ((typeof info.passphrase !== 'string') || (info.passphrase.length < 1)) result.invalid.push('passphrase');

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

  if (!params.email) params.email = 'nobody@example.com';
  if (!params.passphrase) params.passphrase = ' ';

  return validate_create(params);
};


var Station = function(deviceID, deviceUID, info) {
  var self;

  self = this;

  self.whatami = '/device/gateway/plantlink/station';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName ();

  self.info = {};
  if (!!info.params.status) {
    self.status = info.params.status;
    delete(info.params.status);
  } else self.status = 'present';
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Station, gateway.Device);
Station.prototype.perform = devices.perform;

Station.prototype.update = function(self, params, status) {
  var param, updateP;

  updateP = false;
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }
  if (updateP) self.changed();
};


exports.start = function() {
  steward.actors.device.gateway.plantlink = steward.actors.device.gateway.plantlink ||
      { $info     : { type: '/device/gateway/plantlink' } };

  steward.actors.device.gateway.plantlink.cloud =
      { $info     : { type       : '/device/gateway/plantlink/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , email        : true
                                   , passphrase   : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/plantlink/cloud'] = Cloud;

  steward.actors.device.gateway.plantlink.station =
      { $info     : { type       : '/device/gateway/plantlink/station'
                    , observe    : [ ]
                    , perform    : [ 'wake' ]
                    , properties : { name    : true
                                   , status  : [ 'present' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/gateway/plantlink/station'] = Station;
};


// the plantlink API is currently unpublished; however, the basics are simple.
// when an "official" API is published, we'll author a node module and remove the following!

var DEFAULT_LOGGER = { error   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , warning : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , notice  : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , info    : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , debug   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     };


var CloudAPI = function(options) {
  var k;

  var self = this;

  if (!(self instanceof CloudAPI)) return new CloudAPI(options);

  self.options = options;

  self.logger = self.options.logger  || {};
  for (k in DEFAULT_LOGGER) {
    if ((DEFAULT_LOGGER.hasOwnProperty(k)) && (typeof self.logger[k] === 'undefined'))  self.logger[k] = DEFAULT_LOGGER[k];
  }
};
util.inherits(CloudAPI, events.EventEmitter);


CloudAPI.prototype.login = function(username, passphrase, callback) {
  var self = this;

  if (typeof callback !== 'function') throw new Error('callback is mandatory for login');

  self.auth = 'Basic ' + new Buffer(username.toLowerCase() + ':' + passphrase).toString('base64');

  self.invoke('GET', '/api/v1/auth', function(err, code, results) {/* jshint unused: false */
    if (!!err) callback(err);

    if (code !== 200) return callback(new Error('invalid credentials: code=' + code + 'results=' + JSON.stringify(results)));

    callback(null);
  });

  return self;
};


CloudAPI.prototype.getGarden = function(callback) {
  var i;

  var count    = 0
    , links    = {}
    , plants   = {}
    , stations = {}
    , self     = this
    ;

  var f = function(event, err) {
    var k, link, plant, station;

    if (!!err) {
      if (count === 0) return self.logger.error(event, { exception: err });

      count = 0;
      return callback(err);
    }

    if (--count > 0) return;

    for (k in plants) {
      if (!plants.hasOwnProperty(k)) continue;
      plant = plants[k];

      if (!util.isArray(plant.links_key)) continue;
      for (i = 0; i < plant.links_key.length; i++) {
        link = links[plant.links_key[i].toString()];
        if (!link) continue;

        link.status = plant.status;
        link.placement = plant.name;
        link.last_measurements = plant.last_measurements;
      }
    }

    for (k in stations) {
      if (!stations.hasOwnProperty(k)) continue;
      station = stations[k];

      if ((!station.mac) && (station.serial)) station.mac = station.serial.match(/.{2}/g).join(':');
    }

    callback(null, plants, links, stations);
  };

  count = 0;

  self.invoke('GET', '/api/v1/links', function(err, code, results) {/* jshint unused: false */
    var i;

    if (!!err) return f('links', err);

    for (i = 0; i < results.length; i++) links[results[i].key] = results[i];
    f();
  });
  count++;

  self.invoke('GET', '/api/v1/plants', function(err, code, results) {/* jshint unused: false */
    var i;

    if (!!err) return f('plants', err);

    for (i = 0; i < results.length; i++) plants[results[i].key] = results[i];
    f();
  });
  count++;

  self.invoke('GET', '/api/v1/baseStations', function(err, code, results) {/* jshint unused: false */
    var i;

    if (!!err) return f('baseStations', err);

    for (i = 0; i < results.length; i++) stations[results[i].key] = results[i];
    f();
  });
  count++;

  return self;
};


CloudAPI.prototype.invoke = function(method, path, json, callback) {
  var options;

  var self = this;

  if ((!callback) && (typeof json === 'function')) {
    callback = json;
    json = null;
  }
  if (!callback) {
    callback = function(err, results) {
      if (!!err) self.logger.error('invoke', { exception: err }); else self.logger.info(path, { results: results });
    };
  }

  options = url.parse('https://dashboard.myplantlink.com' + path);
/* NB: agent required!
  options.agent = false;
 */
  options.method = method || 'GET';
  options.headers = { Authorization: self.auth };
  if (!!json) {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    json = querystring.stringify(json);
    options.headers['Content-Length'] = Buffer.byteLength(json);
  }

  https.request(options, function(response) {
    var body = '';

    response.on('data', function(data) {
      body += data.toString();
    }).on('end', function() {
      var expected = { GET    : [ 200 ]
                     , PUT    : [ 200 ]
                     , POST   : [ 200, 201, 202 ]
                     , DELETE : [ 200 ]
                     }[method];

      var results = {};

      try { results = JSON.parse(body); } catch(ex) {
        self.logger.error(path, { event: 'json', diagnostic: ex.message, body: body });
        return callback(ex, response.statusCode);
      }

      if (expected.indexOf(response.statusCode) === -1) {
         self.logger.error(path, { event: 'https', code: response.statusCode, body: body });
         return callback(new Error('HTTP response ' + response.statusCode), response.statusCode, results);
      }

      callback(null, response.statusCode, results);
    }).on('close', function() {
      callback(new Error('premature end-of-file on ' + path));
    }).setEncoding('utf8');
  }).on('error', callback).end(json);

  return self;
};
