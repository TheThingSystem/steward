var parser      = require('cron-parser')
  , suncalc     = require('suncalc')
  , util        = require('util')
  , database    = require('./../core/database')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  , logger      = steward.logger
  ;


var place1  = null;

var events  = {};
var nextick = null;
var timerID = null;


var tick = function() {
  var diff, event, eventID, i, observed, min, next, now, pair;

  now = new Date().getTime();
  min = now + (86400 * 1000);

  observed = [];
  for (eventID in events) {
    if (!events.hasOwnProperty(eventID)) continue;

    event = events[eventID];
    if (event.next > now) {
      if (event.next < min) min = event.next;
      continue;
    }

    observed.push(eventID);

    if (!!event.interval) {
      try { next = event.interval.next().getTime(); } catch (ex) {
        steward.report(eventID, { message: 'getTime failed', error: ex });
        delete(events[eventID]);
        continue;
      }
    } else {
      pair = nextSolarEvent(new Date(now), event.operand)[0];
      if (!util.isArray(pair)) {
        steward.report(eventID, { message: pair });
        delete(events[eventID]);
        continue;
      }
      next = pair[0];
    }

    if ((event.next = next) < min) min = event.next;
  }
  nextick = min;

  diff = min - now;
  if (diff < 1000) diff = 1000;
  timerID = setTimeout(tick, diff);
  logger.info('place/1', { observations: observed, next: utility.relativity(nextick) });

  for (i = 0; i < observed.length; i++) steward.observed(observed[i]);
};

var nextSolarEvent = function(date, event) {
  var pair, z;

  z = new Date(date.getTime());
  while (true) {
    pair = solarEvent(z, event);
    if (!util.isArray(pair)) return pair;

    if (pair[0] > date) {
      logger.info('place/1', { solar: event, now: date, next: utility.relativity(pair[1]) });
      return pair;
    }

    z.setDate(z.getDate() + 1);
  }
};

var solarEvent = function(date, event) {
  var times;

  times = solarTimes(date);
  if ((typeof times) !== 'object') return times;

  switch (event) {
    case 'dawn':             return [times.nightEnd,      times.dawn];
    case 'morning-twilight': return [times.dawn,          times.sunrise];
    case 'sunrise':          return [times.sunrise,       times.sunriseEnd];
    case 'morning':          return [times.sunriseEnd,    times.goldenHourEnd];
    case 'daylight':         return [times.goldenHourEnd, times.goldenHour];
    case 'evening':          return [times.goldenHour,    times.sunsetStart];
    case 'sunset':           return [times.sunsetStart,   times.sunset];
    case 'evening-twilight': return [times.sunset,        times.dusk];
    case 'dusk':             return [times.dusk,          times.night];
    case 'night':            return [times.night,         times.nightEnd];

    case 'noon':             return [times.solarNoon,     0];
    case 'nadir':            return [times.nadar,         0];

    default:
      return 'unknown solar event: ' + event;
    }
};

var solarTimes = function(date) {
  var times, z;

  if ((!place1.info.coordinates) || (!util.isArray(place1.info.coordinates))) return 'place/1: no coordinates';

  z = new Date(date.getTime());
  times = suncalc.getTimes(z, place1.info.coordinates[0], place1.info.coordinates[1]);
  if (!times) return 'suncalc.getTimes failed';

  if (times.solarNoon.getDate() != date.getDate()) {
    z.setDate(z.getDate() + 1);
    times = suncalc.getTimes(z, place1.info.coordinates[0], place1.info.coordinates[1]);
    if (!times) return 'suncalc.getTimes failed';
  }

  return times;
};


var Place = exports.Place = function(info) {
  var self = this;

  if (!(self instanceof Place)) return new Place(info);

  if (!place1) place1 = self;

  self.whatami = info.deviceType;
// NB: begin hack to allow us to use Device.proto.setInfo();
  self.deviceID = 0;
  self.deviceUID = '/place/home';
// NB: end hack
  self.name = info.name;
  self.changed();

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.deviceType);
  delete(self.info.device);

  self.proplist = function() {
    var eventID, i, info;

    i = 0;
    for (eventID in events) if (events.hasOwnProperty(eventID)) i++;
    self.info.monitoring = (i > 0) ? ('monitoring ' + i + ' intervals, next interval ' + utility.relativity(nextick)) : 'idle';
    info = utility.clone(self.info);
    delete(info.name);

    return { whatami : self.whatami
           , whoami  : 'place/1'
           , name    : self.name
// TBD: dynamically calculate status, one of the colors in devices.rainbow
           , status  : 'green'
           , info    : info
           , updated : new Date(devices.lastupdated)
           };
  };

  utility.broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (request === 'ping') {
      logger.info('place/1', { status: place1.proplist().status });
      return;
    }

         if (actor !== 'place/1') return;
    else if (request === 'observe') self.observe(self, eventID, observe, parameter);
    else if (request === 'perform') self.perform(self, eventID, observe, parameter);
  });

  return true;
};
util.inherits(Place, devices.Device);


Place.prototype.observe = function(self, eventID, observe, parameter) {
  var diff, next, now, pair, params;

  switch (observe) {
    case 'cron':
      parser.parseExpression(parameter, function(err, interval) {
        if (err) return steward.report(eventID, { event: 'parser.parserExpression', diagnostic: err.message });

        next = interval.next().getTime();
        events[eventID] = { interval: interval, next: next, observe: observe, parameter: parameter };

        steward.report(eventID, {});
        logger.info('place/1', { eventID: eventID, observe: observe, parameter: parameter, next: utility.relativity(next) });

        if (!!timerID) {
          if (next >= nextick) return;
          clearTimeout(timerID);
        }
        nextick = next;

        now = new Date().getTime();
        diff = nextick - now;
        if (diff < 1000) diff = 1000;
        timerID = setTimeout(tick, diff);
      });
      break;

    case 'solar':
      params = parameter.split(' ');
      if (params.length < 2) { params[1] = params[0]; params[0] = 'start'; }
      if (params[0] !== 'start') {
        steward.report(eventID, { message: 'unknown operator: ' + params[0] });
        return;
      }
      pair = nextSolarEvent(new Date(), params[1]);
      if (!util.isArray(pair)) {
        steward.report(eventID, { message: pair });
        return;
      }
      if (pair[1] === 0) params[0] = 'start';

      if (params[0] === 'start') {
        events[eventID] = { next: pair[0], observe: observe, parameter: parameter, operator: params[0], operand: params[1] };

        steward.report(eventID, {});
        logger.info('place/1', { eventID: eventID, observe: observe, parameter: parameter, next: utility.relativity(pair[0]) });

        if (!!timerID) {
          if (pair[0] >= nextick) return;
          clearTimeout(timerID);
        }
        nextick = pair[0];

        now = new Date().getTime();
        diff = nextick - now;
        if (diff < 1000) diff = 1000;
        timerID = setTimeout(tick, diff);
      }
      break;

    default:
      break;
  }
};

Place.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  if (perform !== 'set') return false;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

// do not call self.setName()... there's no entry in the devices table!
  if (!!params.name) self.name = self.info.name = params.name;

  if (!!params.physical) place1.info.physical = params.physical;
// TBD: re-calculate coordinates...

  if (!!params.coordinates) place1.info.coordinates = params.coordinates;
// TBD: look at all 'solar' events and set the timer accordingly...

  self.setInfo();

  return steward.performed(taskID);
};


var scan = function() {
  var now, previous, times;

  if ((!place1.info.coordinates) || (!util.isArray(place1.info.coordinates))) {
    place1.info.solar = 'no coordinates';
    setTimeout(scan, 5 * 1000);
    return;
  }

  now = new Date();
  times = solarTimes(now, place1.info.coordinates[0], place1.info.coordinates[1]);
  if ((typeof times) !== 'object') {
    place1.info.solar = 'unknown';
    setTimeout(scan, 60 * 1000);
    return;
  }

  previous = place1.info.solar;

       if ((times.nightEnd      <= now) && (now < times.dawn))          place1.info.solar = 'dawn';
  else if ((times.dawn          <= now) && (now < times.sunrise))       place1.info.solar = 'morning-twilight';
  else if ((times.sunrise       <= now) && (now < times.sunriseEnd))    place1.info.solar = 'sunrise';
  else if ((times.sunriseEnd    <= now) && (now < times.goldenHourEnd)) place1.info.solar = 'morning';
  else if ((times.goldenHourEnd <= now) && (now < times.goldenHour))    place1.info.solar = 'daylight';
  else if ((times.goldenHour    <= now) && (now < times.sunsetStart))   place1.info.solar = 'evening';
  else if ((times.sunsetStart   <= now) && (now < times.sunset))        place1.info.solar = 'sunset';
  else if ((times.sunset        <= now) && (now < times.dusk))          place1.info.solar = 'evening-twilight';
  else if ((times.dusk          <= now) && (now < times.night))         place1.info.solar = 'dusk';
  else if ((times.night         <= now) || (now < times.nightEnd))      place1.info.solar = 'night';
  else                                                                  place1.info.solar = 'kairos';

  if (previous !== place1.info.solar) place1.changed();
  setTimeout(scan, 60 * 1000);
};


var validate_observe = function(observe, parameter) {
  var pair
    , params
    , result = { invalid: [], requires: [] };

  switch (observe) {
    case 'cron':
      parser.parseExpression(parameter, function(err, interval) {/* jshint unused: false */
        if (err) result.invalid.push('parameter');
      });
      break;

    case 'solar':
      params = parameter.split(' ');
      if (params.length < 2) { params[1] = params[0]; params[0] = 'start'; }
      if (params[0] !== 'start') {
        result.invalid.push('parameter');
        break;
      }
      pair = nextSolarEvent(new Date(), params[1]);
      if (!util.isArray(pair)) {
        result.invalid.push('parameter');
        break;
      }
      if (pair[1] === 0) params[0] = 'start';
      break;

    default:
      if (observe.charAt(0) !== '.') result.invalid.push('observe');
      break;
  }

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }
  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }

  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if ((!params.name) && (!params.physical) && (!params.coordinates)) result.requires.push('name');

  if (!!params.physical) {
// NB: there is no meaningful test that doesn't require an asynchronous dive...
  }

  if (!!params.coordinates) {
    if ((!util.isArray(params.coordinates)) || (params.coordinates.length < 2)) result.invalid.push('coordinates');
    if ((params.coordinates[0] <  -90) || (params.coordinates[0] >  90)) result.invalid.push('latitude');
    if ((params.coordinates[1] < -180) || (params.coordinates[1] > 180)) result.invalid.push('longitude');
  }

  return result;
};


exports.start = function() {
  steward.actors.place =
      { $info     : { type       : '/place'
                    , observe    : [ 'cron', 'solar' ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'green', 'blue', 'indigo', 'red' ]
                                   , physical    : true
                                   , coordinates : 'latlng'
                                   , solar       : [ 'dawn'
                                                   , 'morning-twilight'
                                                   , 'sunrise'
                                                   , 'morning'
                                                   , 'daylight'
                                                   , 'noon'
                                                   , 'evening'
                                                   , 'sunset'
                                                   , 'evening-twilight'
                                                   , 'dusk'
                                                   , 'night'
                                                   , 'nadir' ]
                                   }
                    }
      , $list     : function()   { return [ '1' ]; }
      , $lookup   : function(id) { return (id === '1') ? place1 : null; }
      , $validate : { observe    : validate_observe
                    , perform    : validate_perform
                    }
      };

  readyP();
};


var loadedP = false;

var readyP = function() {
  var db, params;

  if (loadedP) return true;

  if (!database.db) {
    setTimeout (readyP, 1000);
    return false;
  }

  db = database.db;
  db.get('SELECT value from deviceProps where deviceID=0', function(err, row) {
    if (err) logger.error('place/1', { event: 'SELECT deviceProps.value for deviceID=0', diagnostic: err.message });
    else if (row !== undefined) {
      params = null;
      try { params = JSON.parse(row.value); } catch(ex) {
        params = null;
        if (row.value.length > 0) logger.error('place/1', { event: 'JSON.parse', data: row.value, diagnostic: ex.message });
      }
      if (!!params) {
        new Place(JSON.parse(row.value));
        scan();
        return;
      }
    }

    db.run('INSERT INTO deviceProps(deviceID, key, value) VALUES($deviceID, $key, $value)',
           { $deviceID: 0, $key: 'info', $value: '' }, function(err) {
      if (err) logger.error('place/1', { event: 'INSERT deviceProps for deviceID=0', diagnostic: err.message });
    });

    new Place({ deviceType: '/place' });
    scan();
  });
};
