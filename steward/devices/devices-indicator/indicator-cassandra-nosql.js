// cassandra - partitioned row store with tunable consistency

/*
DROP KEYSPACE logging;
CREATE KEYSPACE logging WITH REPLICATION={'class':'SimpleStrategy','replication_factor':1};
USE logging;
CREATE TABLE logs(hour TIMESTAMP, id TIMEUUID, source UUID, datetime TIMESTAMP,
                  steward TEXT, category TEXT, level TEXT, message TEXT, meta MAP<TEXT,TEXT>,
                  PRIMARY KEY(hour, datetime))
  WITH CLUSTERING ORDER BY (datetime DESC);
GRANT SELECT ON logs to 'arden-arcade.taas.thethingsystem.net';
GRANT MODIFY ON logs to 'arden-arcade.taas.thethingsystem.net';

DROP KEYSPACE sensors;
CREATE KEYSPACE sensors WITH REPLICATION={'class':'SimpleStrategy','replication_factor':1};
USE sensors;
CREATE TABLE measurements(hour TIMESTAMP, id TIMEUUID, source UUID, datetime TIMESTAMP,
                          steward TEXT, actor TEXT, name TEXT, value TEXT, units TEXT, meta MAP<TEXT,TEXT>,
                          PRIMARY KEY(hour, datetime))
  WITH CLUSTERING ORDER BY (datetime DESC);
GRANT SELECT ON measurements TO 'arden-arcade.taas.thethingsystem.net';
GRANT MODIFY ON measurements TO 'arden-arcade.taas.thethingsystem.net';

*/

var cql         = require('node-cassandra-cql')
  , url         = require('url')
  , util        = require('util')
  , uuid        = require('node-uuid')
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

  var date2hour = function(date) {
    var hour = new Date(date).toISOString().slice(0, 14) + '00:00.000Z';

    return new Date(hour);
  };

  var meta2map = function(meta) {
    var m, map;

    map = {};
    if (!!meta) for (m in meta) if (meta.hasOwnProperty(m)) { try { map[m] = meta[m].toString(); } catch(ex) {} }

    return { hint: cql.types.dataTypes.map, value: map };
  };

/*
 deviceID   : '162'

{ streamID  : 160
, measure   : { name: "co", type: "contextDependentUnits", label: "voltage", symbol: "co" }
, value     : 0.0823
, timestamp : 1383839241764
}
 */
  broker.subscribe('readings', function(deviceID, point) {
    var actor, datetime, device, hour;

    if ((!self.cql) || (self.status !== 'ready') || (!steward.uuid)) return;

    if ((!!self.sensors) && (!self.sensors[deviceID])) return;
    if ((!!self.measurements) && (!self.measurements[point.measure.name])) return;

    try {
      datetime = new Date(point.timestamp);
      hour = date2hour(point.timestamp);
    } catch(ex) {
      return;
    }
    actor = 'device/' + deviceID;
    device = devices.id2device(deviceID);
    if (!!device) actor += ' ' + device.name;

    self.cql.execute('INSERT INTO sensors.measurements(hour, id, source, datetime, '
                       + 'steward, actor, name, value, units, meta) '
                       + 'VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                     [ hour
                     , { hint: cql.types.dataTypes.timeuuid, value: uuid.v1()    }
                     , { hint: cql.types.dataTypes.uuid,     value: steward.uuid }
                     , datetime
                     , server.vous || ''
                     , actor
                     , point.measure.name
                     , point.value.toString()
                     , point.measure.label
                     , meta2map(point.measure)
                     ], function(err) {
      if (!!err) self.error(self, err);
    });
  });

/*
 category : 'devices'

{ date    : '2014-03-09T03:26:26.669Z',
  level   : 'info',
  message : 'device/370 WeMo Light Switch',
  meta    :
   { subscribe : 'uuid:893e0d7a-1dd2-11b2-bdf2-e2745f0d2d27',
     sequence  : 0,
     seconds   : 1800 } }
 */
  previous = {};
  broker.subscribe('beacon-egress', function(category, data) {
    var datetime, datum, hour, i, now;

    if ((!self.cql) || (self.status !== 'ready') || (!steward.uuid)) return;

    var oops = function(err) { if (!!err) self.error(self, err); };

    if (!util.isArray(data)) data = [ data ];
    for (i = 0; i < data.length; i++) {
      datum = data[i];
      if (!datum.date) continue;

      if ((!winston.config.syslog.levels[datum.level]) || (winston.config.syslog.levels[datum.level] < self.priority)) continue;

      if (!previous[datum.level]) previous[datum.level] = {};

      try {
        datetime = new Date(datum.date);
        hour = date2hour(datum.date);
      } catch(ex) {
        continue;
      }

      now = datetime.getTime();
      if ((!!previous[datum.level][datum.message]) && (previous[datum.level][datum.message] > now)) continue;
      previous[datum.level][datum.message] = now + (60 * 1000);

      self.cql.execute('INSERT INTO logging.logs(hour, id, source, datetime, '
                       + 'steward, category, level, message, meta) '
                       + 'VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
                       [ hour
                       , { hint: cql.types.dataTypes.timeuuid, value: uuid.v1()    }
                       , { hint: cql.types.dataTypes.uuid,     value: steward.uuid }
                       , datetime
                       , server.vous || ''
                       , category
                       , datum.level
                       , datum.message
                       , meta2map(datum.meta)
                       ],
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
  return setTimeout(function() { self.login(self); }, 30 * 1000);
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
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/indicator/cassandra/nosql'] = Cassandra;
};
