var fs          = require('fs')
  , EventBroker = require('observer').EventBroker
  , winston     = require('winston')
  , util        = require('util')
  ;


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


exports.start = function() {
  broker.create('beacon-ingress');
  broker.subscribe('beacon-ingress', beacon_ingress);
  broker.create('beacon-egress');
  broker.create('actors');
  broker.create('discovery');
  broker.create('readings');
  broker.create('status');
};


var logconfigs = {
    climate   : { console: { level: 'debug'  } }
  , devices   : { console: { level: 'info'   } }
  , discovery : { console: { level: 'info'   } }
  , gateway   : { console: { level: 'info'   } }
  , indicator : { console: { level: 'notice' } }
  , lighting  : { console: { level: 'notice' } }
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

exports.logger = function(x) {
  if (winston.loggers.has(x)) return winston.loggers.get(x);
  var logger = winston.loggers.add(x, logconfigs[x] || { console: { level: 'debug' } });
  logger.setLevels(winston.config.syslog.levels);

  logger.logaux = logger.log;
  logger.log = function loggerLog(level, msg) {
    var callback, meta;

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

    switch (level) {
      case 'debug':
        break;

      default:
        beacon_ingress(x, level, msg, meta);
        break;
    }

    this.logaux(level, '[' + x + '] ' + msg, meta, callback);
  };

  logger.debug('begin');
  return logger;
};


exports.acquire = function(log, directory, pattern, start, stop, suffix, arg) {
  fs.readdir(directory, function(err, files) {
    var file, i;

    if (err) {
      log.error('readdir', { diagnostic: err.message });
      return;
    }

    for (i = 0; i < files.length; i++) {
      file = files[i];
      if (file.match(pattern)) {
        log.info('loading ' + file.slice(start, stop) + suffix);
        require(directory + '/' + file).start(arg);
       }
    }
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
  var value = values[key.toLowerCase()];
  return (!!value) ? value : null;
};


exports.value2key = function(values, value) {
  var key;

  for (key in values) if ((values.hasOwnProperty(key)) && (values[key] === value)) return key;
  return null;
};
