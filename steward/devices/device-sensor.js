var sqlite3     = require('sqlite3').verbose()
  , util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  , broker      = utility.broker
  ;


var logger = exports.logger = utility.logger('sensor');

var measures   = { temperature : { symbol: 'C',   units: 'celsius',    type: 'derivedSI'             }
                 , humidity    : { symbol: '%',   units: 'percentage', type: 'contextDependentUnits' }
                 , co2         : { symbol: 'co2', units: 'ppm',        type: 'contextDependentUnits' }
                 , noise       : { symbol: 'dB',  units: 'decibels',   type: 'derivedUnits'          }
                 , pressure    : { symbol: 'mb',  units: 'millibars',  type: 'derivedUnits'          }
                 };

var streams    = {};


var addstream = function(measureID, deviceID, value, timestamp) {
  return function(err) {
    var streamID;

    if (err) {
      return logger.error('database', { event: 'INSERT streams for measureID ' + measureID, diagnostic: err.message });
    }

    streamID = this.lastID;
    if (!streams[measureID]) streams[measureID] = {};
    streams[measureID][deviceID] = streamID;

    exports.db.run('INSERT INTO readings(streamID, value, timestamp)' + 'VALUES($streamID, $value, $timestamp)',
                   { $streamID : streamID, $value: value, $timestamp: timestamp },
                   addvalue(measureID, streamID));

  };
};

var addvalue = function(measureID, streamID) {
  return function(err) {
    if (!err) return;

    logger.error('database',
                 { event: 'INSERT readings for measureID/streamID ' + measureID + '/' + streamID , diagnostic : err.message });
  };
};

exports.update = function(deviceID, params) {
  var measureID, measureName, streamID;

  if (!exports.db) return false;

  for (measureName in params) {
    if ((!params.hasOwnProperty(measureName)) || (!measures[measureName]) || (!params[measureName])) continue;

    measureID = measures[measureName].id;
    if ((!!streams[measureID]) && (!!streams[measureID][deviceID])) {
      streamID = streams[measureID][deviceID];

      exports.db.run('INSERT INTO readings(streamID, value, timestamp)' + 'VALUES($streamID, $value, $timestamp)',
                     { $streamID : streamID, $value: params[measureName], $timestamp: params.lastSample },
                     addvalue(measureID, streamID));

      if (broker.has('readings')) {
        broker.publish('readings', deviceID, { streamID  : streamID.toString()
                                             , measure   : { name   : measureName
                                                           , type   : measures[measureName].type
                                                           , label  : measures[measureName].units
                                                           , symbol : measures[measureName].symbol
                                                           }
                                             , value     : params[measureName]
                                             , timestamp : params.lastSample
                                             });
      }
      continue;
    }

    exports.db.run('INSERT INTO streams(measureID, deviceID, created) VALUES($measureID, $deviceID, datetime("now"))',
                   { $measureID: measureID, $deviceID: deviceID },
                   addstream(measureID, deviceID, params[measureName], params.lastSample));
  }

  return true;
};

var addmeasure = function(db, measureName) {
  return function(err, row) {
    if (err) {
      return logger.error('database', { event: 'SELECT measures.measureName for ' + measureName, diagnostic: err.message });
    }

    if (row !== undefined) {
      measures[measureName].id = row.measureID;
      return;
    }

    row = measures[measureName];
    db.run('INSERT INTO measures(measureName, symbol, units, type, created, updated)'
           + 'VALUES($measureName, $symbol, $units, $type, datetime("now") , datetime("now"))',
           { $measureName: measureName, $symbol: row.symbol, $units: row.units, $type: row.type }, function (err) {
      if (err) {
        return logger.error('database', { event: 'INSERT measures for measureName ' + measureName, diagnostic: err.message });
      }

      measures[measureName].id = this.lastID;
    });
  };
};

exports.start = function() {
  var db;

  steward.actors.device.sensor = { $info: { type: '/device/sensor' }};

  try {
    db = new sqlite3.Database(__dirname + '/../db/measurements.db');
  } catch(ex) {
    return logger.emerg('database', { event: 'create ' + __dirname + '/../db/sensors.db', diagnostic: ex.message });
  }

  db.serialize(function() {
    var measureName;

    db.run('CREATE TABLE IF NOT EXISTS measures('
           + 'measureID INTEGER PRIMARY KEY ASC, measureName TEXT, symbol TEXT, units TEXT, type TEXT, '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    for (measureName in measures) {
      if (measures.hasOwnProperty(measureName)) {
        db.get('SELECT measureID FROM measures WHERE measureName=$measureName', { $measureName: measureName },
               addmeasure(db, measureName));
      }
    }

    db.run('CREATE TABLE IF NOT EXISTS streams('
           + 'streamID INTEGER PRIMARY KEY ASC, measureID INTEGER, deviceID INTEGER, created CURRENT_TIMESTAMP'
           + ')');

    db.get('SELECT * FROM streams', {}, function(err, row) {
      if (err) return logger.error('database', { event: 'SELECT streams.*', diagnostic: err.message });

      if (row === undefined) return;

      if (!streams[row.measureID]) streams[row.measureID] = {};
      streams[row.measureID][row.deviceID] = row.streamID;
    });

    db.run('CREATE TABLE IF NOT EXISTS readings('
           + 'readingID INTEGER PRIMARY KEY ASC, streamID INTEGER, value TEXT, timestamp TEXT'
           + ')', function(err) {
      if (err) return logger.error('database', { event: 'database initialization', diagnostic: err.message });

      exports.db = db;
      utility.acquire(logger, __dirname + '/devices-sensor', /^sensor-.*\.js/, 7, -3, ' driver');
    });
  });
};


var Sensor = exports.Device = function() {
  var self = this;

  self.whatami = '/device/sensor';
};
util.inherits(Sensor, devices.Device);
