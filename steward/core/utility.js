var fs          = require('fs')
  , EventBroker = require('observer').EventBroker
  , stacktrace  = require('stack-trace')
  , stringify   = require('json-stringify-safe')
  , winston     = require('winston')
  , util        = require('util')
  ;


process.addListener("uncaughtException", function (err) {
  var logger;

  try {
    logger = exports.logger('steward');
    logger.alert('exception', { diagnostic: err.message });
    logger.alert('exception', { stack: stringify(stacktrace.parse(err)) });
  } catch(ex) {}

  if (!!console) console.log('uncaught exception: ' + err);

  process.exit(1);
});


// winston.exitErrs = false;


var broker = exports.broker = new EventBroker();
var signals = exports.signals = {};

var beacon_ingress = function(category, level, message, meta) {
  var data = signals[category] || [];

  var datum = { date: new Date().toISOString(), level: level, message: message, meta: meta };

  data.push(datum);
  if (data.length > 50) data.splice(0, 1);

  signals[category] = data;

  if (broker.has('beacon-egress')) broker.publish('beacon-egress', category, datum);
};


var configuration = {};

exports.start = function() {
  var category, setting, settings;

// used to delay the server starting...
  exports.acquiring = 1;

  broker.create('beacon-ingress');
  broker.subscribe('beacon-ingress', beacon_ingress);
  broker.create('beacon-egress');
  broker.create('actors');
  broker.create('discovery');
  broker.create('readings');

  try {
    configuration = JSON.parse(fs.readFileSync(__dirname + '/../db/configuration.json', { encoding: 'utf8' }));
  } catch(ex) {
    if (ex.code !== 'ENOENT') exports.logger('steward').error('utility', { diagnostic: ex.message });
  }

  if (!configuration.logconfigs) return;

  for (category in configuration.logconfigs) {
    if (!configuration.logconfigs.hasOwnProperty(category)) continue;

    if (!logconfigs[category]) {
      logconfigs[category] = configuration.logconfigs[category];
      continue;
    }

     settings = configuration.logconfigs[category];
     for (setting in settings) if (settings.hasOwnProperty(setting)) logconfigs[category][setting] = settings[setting];
  }
};


var logconfigs = {
    climate   : { console: { level: 'debug'  } }
  , devices   : { console: { level: 'info'   } }
  , discovery : { console: { level: 'info'   } }
  , gateway   : { console: { level: 'info'   } }
  , indicator : { console: { level: 'info'   } }
  , lighting  : { console: { level: 'info'   } }
  , manage    : { console: { level: 'notice' } }
  , media     : { console: { level: 'debug'  } }
  , motive    : { console: { level: 'debug'  } }
  , presence  : { console: { level: 'info'   } }
  , sensor    : { console: { level: 'info'   } }
  , server    : { console: { level: 'info'   } }
  , steward   : { console: { level: 'notice' } }
  , 'switch'  : { console: { level: 'info'   } }
  , wearable  : { console: { level: 'debug'  } }
};

var devices = null;
var places  = null;

if (!winston.config.syslog.levels.fatal) winston.config.syslog.levels.fatal = winston.config.syslog.levels.emerg + 1;

exports.logger = function(x) {
  if (winston.loggers.has(x)) return winston.loggers.get(x);
  var logger = winston.loggers.add(x, logconfigs[x] || { console: { level: 'debug' } });
  logger.setLevels(winston.config.syslog.levels);
  if (!logger.fatal) logger.fatal = logger.emerg;

  logger.logaux = logger.log;
  logger.log = function(level, msg) {
    var callback, entity, meta;

    if (arguments.length === 3) {
      if (typeof arguments[2] === 'function') {
        meta = {};
        callback = arguments[2];
      }
      else if (typeof arguments[2] === 'object') meta = arguments[2];
    }
    else if (arguments.length === 4) {
      meta = arguments[2];
      callback = arguments[3];
    }

    if (msg.indexOf('device/') === 0) {
      if (!devices) devices = require('./device');
      entity = devices.id2device(msg.substr(7));
      if (!!entity) msg += ' ' + entity.name;
    } else if (msg.indexOf('place/') === 0) {
      if (!places) places = require('./steward').actors.place;
      if (!!places) entity = places.$lookup(msg.substr(6));
      if (!!entity) msg += ' ' + entity.name;
    }

    switch (level) {
      case 'debug':
        break;

      default:
        beacon_ingress(x, level, msg, meta);
        break;
    }

    this.logaux(level !== 'fatal' ? level : 'emerg', '[' + x + '] ' + msg, meta, callback);

    if ((level === 'emerg') || (level === 'fatal')) process.exit(1);
  };

  logger.debug('begin');
  return logger;
};

exports.logfnx = function(logaux, prefix) {
  var f, level, levels;

  f = {};

  levels = winston.config.syslog.levels;
  for (level in levels) {
    if (levels.hasOwnProperty(level)) f[level] = logfnx2(logaux[level], prefix, levels[level] >= levels.error);
  }

  return f;
};

var logfnx2 = function(logaux, prefix, errorP) {/* jshint unused: false */
  return function(msg, props) {
//         if ((!errorP) || ((!!props) && (!!props.event))) return (logaux)(prefix + ': ' + msg, props);

                if (!props)       props         = { event: msg };
           else if (!props.event) props.event   = msg;
           else                   props.message = msg;
           (logaux)(prefix, props);
         };
};


exports.acquiring = 0;

exports.acquire = function(log, directory, pattern, start, stop, suffix, arg) {
  var category, exclude, include, tail;

  exports.acquiring++;

  if (!!configuration.deviceTypes) {
    tail = directory.split('/');
    if ((tail.length > 0) && (tail[tail.length - 1].indexOf('devices-') === 0)) {
      category = tail[tail.length - 1].substring(8);
      if ((!!configuration.deviceTypes.include) && (util.isArray(configuration.deviceTypes.include[category]))) {
        include = configuration.deviceTypes.include[category];
      }
      if ((!!configuration.deviceTypes.exclude) && (util.isArray(configuration.deviceTypes.exclude[category]))) {
        exclude = configuration.deviceTypes.exclude[category];
      }
    }
  }

  fs.readdir(directory, function(err, files) {
    var didP, file, i, module;

    if (err) { exports.acquiring--; return log.error('readdir', { diagnostic: err.message }); }

    didP = false;
    for (i = 0; i < files.length; i++) {
      file = files[i];
      if (file.match(pattern)) {
        didP = true;
        module = file.slice(start, stop);
        if ((!!include) && (include.indexOf(module) === -1)) {
          log.info('not including ' + module + suffix);
          continue;
        }
        if ((!!exclude) && (exclude.indexOf(module) !== -1)) {
          log.info('excluding ' + module + suffix);
          continue;
        }

        log.info('loading ' + module + suffix);
        require(directory + '/' + file).start(arg);
      }
    }
    if (!didP) log.warning('no loadable modules found in ' + directory + ' for ' + pattern);
    exports.acquiring--;
  });
};


// http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/

exports.toType = function(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};


// http://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site

exports.relativity = function(time) {
  switch (typeof time) {
    case 'number':
      break;

    case 'string':
      time = +new Date(time);
      break;

    case 'object':
      if (time.constructor === Date) time = time.getTime();
      break;

    default:
      time = +new Date();
      break;
  }
  var time_formats = [
    [         60, 's'      ,                   1], // 60
    [        120, '1m',            '1m from now'], // 60*2
    [       3600, 'm',                        60], // 60*60, 60
    [       7200, '1h',            '1h from now'], // 60*60*2
    [      86400, 'h',                      3600], // 60*60*24, 60*60
    [     172800, 'yesterday',        'tomorrow'], // 60*60*24*2
    [     604800, 'd',                     86400], // 60*60*24*7, 60*60*24
    [    1209600, 'last week',       'next week'], // 60*60*24*7*4*2
    [    2419200, 'w',                    604800], // 60*60*24*7*4, 60*60*24*7
    [    4838400, 'last month',     'next month'], // 60*60*24*7*4*2
    [   29030400, 'months',              2419200], // 60*60*24*7*4*12, 60*60*24*7*4
    [   58060800, 'last year',       'next year'], // 60*60*24*7*4*12*2
    [ 2903040000, 'years',              29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
    [ 5806080000, 'last century', 'next century'], // 60*60*24*7*4*12*100*2
    [58060800000, 'centuries',        2903040000]  // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
  ];
  var seconds = (+new Date() - time) / 1000
    , token = 'ago'
    , list_choice = 1;

  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    list_choice = 2;
  } else if (seconds < 1) {
    return 'now';
  }

  var i = 0
    , format;
  while (!!(format = time_formats[i++])) {
    if (seconds < format[0]) {
      if (typeof format[2] == 'string') return format[list_choice];
      return Math.floor(seconds / format[2]) + format[1] + ' ' + token;
    }
  }
  return time;
};


var clone = exports.clone = function(o) {
  var prop, result;

  if ((!o) || ((typeof o) !== 'object')) return o;

  result = util.isArray(o) ? [] : {};
  for (prop in o) if (o.hasOwnProperty(prop)) result[prop] = clone(o[prop]);
  return result;
};


exports.keys = function(values) {
  var key, keys;

  keys = [];
  for (key in values) if (values.hasOwnProperty(key)) keys.push(key);
  return keys;
};


exports.key2value = function(values, key) {
  if (!!key) return values[key.toLowerCase()];
};


exports.value2key = function(values, value) {
  var key;

  for (key in values) if ((values.hasOwnProperty(key)) && (values[key] === value)) return key;
  return null;
};


// http://stackoverflow.com/questions/7837456/comparing-two-arrays-in-javascript#14853974

var array_cmp = exports.array_cmp = function(a, b) {
    // if the other array is a falsy value, return
    if (!b)
        return (!a);
    if (!a) return false;

    // compare lengths - can save a lot of time
    if (a.length != b.length)
        return false;

    for (var i = 0, l = a.length; i < l; i++) {
        // Check if we have nested arrays
        if (a[i] instanceof Array && b[i] instanceof Array) {
            // recurse into the nested arrays
            if (!array_cmp(a[i],b[i]))
                return false;
        }
        else if (a[i] != b[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
};

exports.location_fuzz = function(location) {
  var i, j, l;

  for (i = 0; i < location.length; i++) {
    l = location[i] + '';
    j = l.indexOf('.');
    if ((j === -1) || ((l.length - j) <= 7)) continue;
    l = parseFloat(l);
    if (!isNaN(l)) location[i] = l.toFixed(6);
  }

  return location;
};


// from http://stackoverflow.com/questions/27928/how-do-i-calculate-distance-between-two-latitude-longitude-points

exports.getDistanceFromLatLonInKm = function (lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
};

var deg2rad = function(deg) {
  return deg * (Math.PI/180);
};
