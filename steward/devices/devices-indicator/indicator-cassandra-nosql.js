// cassandra - partitioned row store with tunable consistency

/*
CREATE KEYSPACE logging WITH REPLICATION={'class': 'SimpleStrategy','replication_factor':1};
CREATE TABLE logging.logs(key TEXT, date TIMESTAMP, steward TEXT, level TEXT, message TEXT, meta TEXT,
                          PRIMARY KEY(key, date));
GRANT SELECT ON logging.logs to 'arden-arcade.taas.thethingsystem.net';
GRANT MODIFY ON logging.logs to 'arden-arcade.taas.thethingsystem.net';

CREATE KEYSPACE sensors WITH REPLICATION={'class': 'SimpleStrategy','replication_factor':1};
CREATE TABLE sensors.measurements(key TEXT, date TIMESTAMP, steward TEXT, actor TEXT, name TEXT, value TEXT, meta TEXT,
                                  PRIMARY KEY(key, date));
GRANT SELECT ON sensors.measurements TO 'arden-arcade.taas.thethingsystem.net';
GRANT MODIFY ON sensors.measurements TO 'arden-arcade.taas.thethingsystem.net';

*/

var cql         = require('node-cassandra-cql')
  , url         = require('url')
  , util        = require('util')
  , winston     = require('winston')
  , devices     = require('./../../core/device')
  , server      = require('./../../core/server')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  , sensor      = require('./../device-sensor')
  ;


var logger = indicator.logger;


var Cassandra = exports.Device = function(deviceID, deviceUID, info) {
  var previous, self;

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
  delete(self.info.ipaddress);
  self.priority = winston.config.syslog.levels[self.info.priority || 'notice'] || winston.config.syslog.levels.notice;
  self.info.priority = utility.value2key(winston.config.syslog.levels, self.priority);
  self.status = 'waiting';
  self.elide = [ 'passphrase' ];
  self.changed();

/*
 device/162 - Air Quality Sensor
{ streamID  : 160
, measure   : { name: "co", type: "contextDependentUnits", label: "voltage", symbol: "co" }
, value     : 0.0823
, timestamp : 1383839241764
}
 */
  broker.subscribe('readings', function(deviceID, point) {
    var date, key;

    if (!self.cql) return;
    if (self.status !== 'ready') return;

    if ((!!self.sensors) && (!self.sensors[deviceID])) return;
    if ((!!self.measurements) && (!self.measurements[point.measure.name])) return;

    date = new Date(point.timestamp);
    try { key = date.toISOString().slice(11); } catch(ex) { return; }

    self.cql.executeAsPrepared('INSERT INTO sensors.measurements(key, date, steward, actor, name, value, meta) '
                                 + 'VALUES(?, ?, ?, ?, ?, ?, ?)',
                               [ key
                               , date
                               , server.vous || ''
                               , 'device/' + deviceID
                               , point.measure.name
                               , point.value.toString()
                               , util.inspect(point.measure)
                               ], function(err) {
      if (!!err) self.error(self, err);
    });
  });

  previous = {};
  broker.subscribe('beacon-egress', function(category, data) {
    var date, datum, key, i, now;

    if (!self.cql) return;
    if (self.status !== 'ready') return;

    var oops = function(err) { if (!!err) self.error(self, err); };

    if (!util.isArray(data)) data = [ data ];
    for (i = 0; i < data.length; i++) {
      datum = data[i];

      if ((!winston.config.syslog.levels[datum.level]) || (winston.config.syslog.levels[datum.level] < self.priority)) continue;

      if (!previous[datum.level]) previous[datum.level] = {};
      date = new Date(datum.date);
      try { key = date.toISOString().slice(11); } catch(ex) { return; }

      now = date.getTime();
      if ((!!previous[datum.level][datum.message]) && (previous[datum.level][datum.message] > now)) continue;
      previous[datum.level][datum.message] = now + (60 * 1000);

      self.cql.executeAsPrepared('INSERT INTO logging.logs(key, date, steward, level, message, meta) VALUES(?, ?, ?, ?, ?, ?)',
                                 [ key, date, server.vous || '', datum.level, datum.message, util.inspect(datum.meta || {}) ],
                                 oops);
    }
  });

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });

  self.login(self);
};
util.inherits(Cassandra, indicator.Device);


Cassandra.prototype.login = function(self) {
  var option, opts, params;

  params = url.parse(self.info.url, true);
  if (!params.port) params.port = (params.protocol === 'nosqls:') ? 9043 : 9042;
  if (!!self.info.username) {
    params.query.username = self.info.username;
    if (!!self.info.passphrase) params.query.password = self.info.passphrase;
  }
  if ((!!self.info.crtPath) && (params.protocol === 'nosqls:')) {
    params.query.ca = [ __dirname + '/../../db/' + self.info.crtPath ];
  }

  self.options = {};
  opts = params.query || {};
  for (option in opts) if (opts.hasOwnProperty(option)) self.options[option] = opts[option];
  self.options.secureP = params.protocol === 'nosqls:';
  if (self.options.secureP) self.options.tlsport = params.port; else self.options.port = params.port;
  self.options.hosts = [ params.host ];

  self.path = params.pathname || '';
  if (self.path.indexOf('/') !== 0) self.path = '/' + self.path;
  if (self.path.lastIndexOf('/') !== (self.path.length - 1)) self.path += '/';
  self.path = self.path.split('/').slice(1).slice(0, -1).join('/');
  self.options.keyspace = self.path !== '' ? self.path : 'logging';

  self.cql = new cql.Client(self.options).on('log', function(level, message) {
    if ((level === 'info') || (!logger[level])) level = 'debug';
    logger[level]('device/' + self.deviceID, { message: message });
  });
  self.cql.connect(function(err) {
    if (!!err) return self.error(self, err);

    self.status = 'ready';
    self.changed();
  });
};

Cassandra.prototype.error = function(self, err) {
  logger.error('device/' + self.deviceID, { diagnostic: err.message });
  self.status = 'error';
  self.changed();

  self.cql.shutdown();
  self.sql = null;
  return setTimeout(function() { self.login(self); }, 600 * 1000);
};


var validate_create = function(info) {
  var params
    , result = { invalid: [], requires: [] }
    ;

  if (!info.url) result.requires.push('url');
  else if (typeof info.url !== 'string') result.invalid.push('url');
  else {
    params = url.parse(info.url);
    if ((!params.hostname) || ((params.protocol !== 'nosql:') && (params.protocol !== 'nosqls:'))) {
      result.invalid.push('url');
    }
  }

  if ((!!info.username) && (typeof info.username !== 'string')) result.invalid.push('username');
  if (!!info.passphrase) {
    if (!info.username) result.requires.push('username');
    if (typeof info.passphrase !== 'string') result.invalid.push('passphrase');
  }

  if ((!!info.crtPath) && (info.crtPath.indexOf('/') !== -1)) result.invalid.push('crtPath');

// NB: maybe we ought to be syntax checking the values for these two?
  if ((!!info.measurements) && (!util.isArray(info.measurements))) result.invalid.push('measurements');
  if ((!!info.sensors) && (!util.isArray(info.sensors))) result.invalid.push('sensors');

  if ((!!info.priority) && (!winston.config.syslog.levels[info.priority])) result.invalid.push('priority');

  return result;
};


exports.start = function() {
  var measureName, measurements;

  steward.actors.device.indicator.cassandra = steward.actors.device.indicator.cassandra ||
      { $info     : { type: '/device/indicator/cassandra' } };

  measurements = {};
  for (measureName in sensor.measures) {
    if (sensor.measures.hasOwnProperty(measureName)) measurements[measureName] = sensor.measures[measureName].units;
  }

  steward.actors.device.indicator.cassandra.nosql =
      { $info     : { type       : '/device/indicator/cassandra/nosql'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error' ]
                                   , url          : true
                                   , username     : true
                                   , passphrase   : true
                                   , crtFile      : true
                                   , measurements : measurements
                                   , sensors      : []
                                   , priority     : utility.keys(winston.config.syslog.levels)
                                   , subscriptions: []
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/indicator/cassandra/nosql'] = Cassandra;
};
