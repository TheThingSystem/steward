var fs          = require('fs')
  , geocoder    = require('geocoder')
  , parser      = require('cron-parser')
  , suncalc     = require('suncalc')
  , util        = require('util')
  , yql         = require('yql')
  , database    = require('./../core/database')
  , devices     = require('./../core/device')
  , server      = require('./../core/server')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  , broker      = utility.broker
  , logger      = steward.logger
  ;


var place1  = null;
var version = null;
var bootime = null;

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
      try { next = event.interval.next().getTime(); } catch(ex) {
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
    case 'nadir':            return [times.nadir,         0];

    default:
      return 'unknown solar event: ' + event;
    }
};

var solarTimes = function(date) {
  var times, z;

  if ((!place1.info.location) || (!util.isArray(place1.info.location))) return 'place/1: no location';

  z = new Date(date.getTime());
  times = suncalc.getTimes(z, place1.info.location[0], place1.info.location[1]);
  if (!times) return 'suncalc.getTimes failed';

  if (times.solarNoon.getDate() != date.getDate()) {
    z.setDate(z.getDate() + 1);
    times = suncalc.getTimes(z, place1.info.location[0], place1.info.location[1]);
    if (!times) return 'suncalc.getTimes failed';
  }

  return times;
};


var Place = exports.Place = function(info) {
  var self = this;

  if (!(self instanceof Place)) return new Place(info);

  if (!place1) {
    place1 = exports.place1 = self;
    bootime = new Date().getTime() + (90 * 1000);
  }

  self.whatami = info.deviceType;
// NB: begin hack to allow us to use Device.proto.setInfo();
  self.deviceID = 0;
  self.deviceUID = '/place/home';
// NB: end hack
  self.name = info.name;
  self.status = 'red';
  self.changed();
  server.advertise();

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.deviceType);
  delete(self.info.device);
  if (!self.info.pairing) self.info.pairing = 'on';
  if (self.info.pairing !== 'code') delete(self.info.pairingCode); else self.makecode();
  if (!self.info.strict) self.info.strict = 'on';
  if (!self.info.displayUnits) self.info.displayUnits = 'customary';
// temporary
  if (!!self.info.coordinates) {
    self.info.location = self.info.coordinates;
    delete(self.info.coordinates);
    self.setInfo();
  }
  if (!self.info.woeid) self.getWoeID(self);
  self.info.review = [];
  self.info.ipaddrs = [];
  steward.forEachAddress(function(addr) { self.info.ipaddrs.push(addr); });

  self.proplist = function() {
    var eventID, i, info, name;

    i = 0;
    for (eventID in events) if (events.hasOwnProperty(eventID)) i++;
    self.info.monitoring = (i > 0) ? ('monitoring ' + i + ' intervals, next interval ' + utility.relativity(nextick)) : 'idle';
    info = utility.clone(self.info);
    delete(info.name);
    delete(info.ipaddrs);
    delete(info.woeid);
    if (!!steward.uuid) info.identity = steward.uuid;
    if (!!server.vous) {
      info.remote = server.vous;

      name = server.vous.split('.')[0];
      if (self.name !== name) {
        self.name = name;
        self.changed();
        server.advertise();
      }
    }
    self.info.version = version;

    return { whatami : self.whatami
           , whoami  : 'place/1'
           , name    : self.name
           , ikon    : self.ikon
           , status  : self.status
           , info    : info
           , updated : new Date(devices.lastupdated)
           };
  };

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (request === 'ping') {
      if (broker.has('beacon-egress')) broker.publish('beacon-egress', '.updates', self.proplist());
      return;
    }

    if (actor !== 'place/1') return;

    if (request === 'observe') return self.observe(self, eventID, observe, parameter);
    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });

  if ((!!self.info.woeid) && (!self.weatherID)) {
    self.weatherID = setInterval(function() { self.getWeather(self); }, 30 * 60 * 1000);
    self.getWeather(self);
  }
};
util.inherits(Place, devices.Device);


Place.prototype.observe = function(self, eventID, observe, parameter) {
  var diff, next, now, options, pair, params, rebootime;

  switch (observe) {
    case 'cron':
      options = {};
      if (parameter === 'reboot') {
        now = new Date().getTime();
        if (bootime < now) return steward.report(eventID, { event: 'cron reboot', diagnostic: 'already fired' });

        rebootime = new Date(bootime);
        parameter = rebootime.getSeconds() + ' ' + rebootime.getMinutes() + ' ' + rebootime.getHours() + ' '
                  + rebootime.getDate() + ' ' + rebootime.getMonth() + ' ' + rebootime.getDay();
        options.endDate = new Date(bootime + (60 * 1000));
      }
      parser.parseExpression(parameter, options, function(err, interval) {
        if (!!err) return steward.report(eventID, { event: 'parser.parserExpression', diagnostic: err.message });

        if (interval._fields.dayOfWeek.length === 0) interval._fields.dayOfWeek = [ 0, 1, 2, 3, 4, 5, 6];
        try { next = interval.next().getTime(); } catch(ex) {
          return steward.report(eventID, { event: 'interval.next().getTime', diagnostic: ex.message });
        }
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
  var params, previous;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'wake') return devices.wake(params);

  if (perform !== 'set') return false;

// do not call self.setName()... there's no entry in the devices table!
  if (!!params.name) {
    self.name = self.info.name = params.name;
    server.advertise();
  }

  if ((!!params.location)
         && ((!util.isArray(params.location)) || (params.location.length < 2)
                 || ((isNaN(params.location[0])) || (params.location[0] <  -90) || (params.location[0] >  90))
                 || ((isNaN(params.location[1])) || (params.location[0] < -180) || (params.location[0] > 180))
                 || ((params.location[0] === '') || (params.location[1] === '')))) delete(params.location);

  if (!!params.physical) {
    place1.info.physical = params.physical;
    if (!params.location) {
      geocoder.geocode(place1.info.physical, function(err, result) {
        var components, geometry, i;

        if (!!err) return logger.warning('place/1', { event      : 'geocode'
                                                    , location   : place1.info.location
                                                    , diagnostic : err.message });

        geometry = result.results[0].geometry;
        place1.info.location = [ geometry.location.lat, geometry.location.lng ];
        self.getWoeID(self);
        if (!!params.displayUnits) return;

        place1.info.displayUnits = 'metric';
        components = result.results[0].address_components;
        for (i = 0; i < components.length; i++) if (components[i].types.indexOf('country') !== -1) {
          place1.info.displayUnits = components[i].long_name === 'United States' ? 'customary' : 'metric';
          break;
        }
      });
    }
  }

  if (!!params.location) {
    place1.info.location = utility.location_fuzz(params.location);
    self.getWoeID(self);
    if (!params.physical) {
      geocoder.reverseGeocode(place1.info.location[0], place1.info.location[1], function(err, result) {
        if (!!err) return logger.warning('place/1', { event      : 'reverseGeocode'
                                                    , location   : place1.info.location
                                                    , diagnostic : err.message });

        place1.info.physical = result.results[0].formatted_address;
        if (!!params.displayUnits) return;

        place1.info.displayUnits =
            (result.results[result.results.length - 1].formatted_address === 'United States') ? 'customary' : 'metric';
      });
    }
  }

  if ((!!params.physical) && (!!params.location) && (!params.displayUnits)) {
    geocoder.reverseGeocode(place1.info.location[0], place1.info.location[1], function(err, result) {
      if (!!err) return logger.warning('place/1', { event      : 'reverseGeocode'
                                                  , location   : place1.info.location
                                                  , diagnostic : err.message });

      place1.info.displayUnits =
          (result.results[result.results.length - 1].formatted_address === 'United States') ? 'customary' : 'metric';
      });
  }

// TBD: look at all 'solar' events and set the timer accordingly...

  if (!!params.pairing) {
    previous = place1.info.pairing;

    if ({ off  : true
        , on   : true
        , code : true }[params.pairing]) place1.info.pairing = params.pairing;
         if (place1.info.pairing !== 'code') delete(self.info.pairingCode);
    else if ((place1.info.pairing === 'code') && (previous !== 'code')) self.makecode();
  }

  if (!!params.strict) {
    if ({ off  : true
        , on   : true }[params.strict]) place1.info.strict = params.strict;
  }

  if (!!params.displayUnits) {
    if ({ customary : true
        , metric    : true }[params.displayUnits]) place1.info.displayUnits = params.displayUnits;
  }

  self.setInfo();

  return steward.performed(taskID);
};

Place.prototype.makecode = function() {
  this.info.pairingCode = ('000000' + Math.round(Math.random() * 999999)).substr(-6);
};

Place.prototype.getWoeID = function(self, tries) {
  var retry = function(args) {
    if (!args) args = {};
    args.event = 'getWoeID';
    logger.error('place/1', args);
    setTimeout(function() { self.getWoeID(self, tries++); }, 5 * 60 * 1000);
  };

  if ((!place1.info.location) || !util.isArray(place1.info.location) || (place1.info.location.length < 2)) return;

  if (!!tries) {
    if (!!self.info.woeid) return;
  } else {
    delete(self.info.woeid);
    tries = 1;
  }

  new yql.exec2('SELECT * FROM geo.placefinder WHERE (text = @text) AND (gflags = "R")',
                { text: self.info.location[0] + ',' + self.info.location[1] }, {}, function (err, response) {
    var woeid;

    if (!!err) return retry({ diagnostic: err.message });

    try {
      woeid = parseInt(response.query.results.Result.woeid, 10);
      if (isNaN(woeid)) throw new Error('invalid WoeID');
    } catch(ex) {
      return retry({ response: response, diagnostic: ex.message });
    }

    self.info.woeid = woeid;
    self.setInfo();
    self.changed();

    if (!!self.weatherID) clearInterval(self.weatherID);
    self.weatherID = setInterval(function() { self.getWeather(self); }, 30 * 60 * 1000);
    self.getWeather(self);
  });
};

Place.prototype.getWeather = function(self) {
  if (!self.info.woeid) return;

  new yql.exec2('SELECT * FROM weather.forecast WHERE (woeid = @woeid) AND (u = "c")', { woeid: self.info.woeid }, {},
  function (err, response) {
    var a, atmosphere, current, diff, forecasts, i, now, pubdate, wind;

    if (!!err) return logger.error('place/1', { event: 'getWeather', diagnostic: err.message });

    try {
      pubdate = new Date(response.query.results.channel.item.pubDate);
      now = new Date().getTime();
      diff = pubdate.getTime() + (75 * 60 * 1000) - now;

      var retry = function() {
        if (!!self.weatherID) return logger.warning('place/1', { event: 'getWeather', diagnostic: 'previously reset' });

        logger.warning('place/1', { event: 'getWeather', diagnostic: 'reset to every 75 minutes' });
        self.weatherID = setInterval(function() { self.getWeather(self); }, 75 * 60 * 1000);
        self.getWeather(self);
      };

      if (diff > 0) {
        if (!!self.weatherID) clearInterval(self.weatherID);
        setTimeout(retry, diff + (5 * 60 * 1000));
        logger.warning('place/1', { event      : 'getWeather'
                                  , diagnostic : 'check in ' + ((diff / 1000) + 5 * 60).toFixed(3) + ' seconds' });
      }

      atmosphere = response.query.results.channel.atmosphere;
      for (a in atmosphere) if ((atmosphere.hasOwnProperty(a)) && (atmosphere[a].length === 0)) delete(atmosphere[a]);
      wind = response.query.results.channel.wind;
      if (!wind) wind = { chill: '' };
      if (wind.chill.length === 0) delete(wind.chill);
      current = response.query.results.channel.item.condition;
      if (current.temp.length === 0) delete(current.temp);
      self.info.conditions = { code        : current.code
                             , text        : current.text.toLowerCase()
                             , temperature : current.temp
                             , humidity    : atmosphere.humidity
                             , pressure    : atmosphere.pressure
                             , windchill   : wind.chill
                             , visibility  : atmosphere.visibility
                             , lastSample  : new Date(current.date).getTime()
                             };

      self.info.forecasts = [];
      forecasts = response.query.results.channel.item.forecast;
      for (i = 0; i < forecasts.length; i++) {
        self.info.forecasts.push({ code            : forecasts[i].code
                                 , text            : forecasts[i].text.toLowerCase()
                                 , highTemperature : forecasts[i].high
                                 , lowTemperature  : forecasts[i].low
                                 , nextSample      : new Date(forecasts[i].date).getTime()
                                 });
      }
    } catch(ex) {
      logger.error('place/1', { event: 'getWeather', diagnostic: ex.message });
    }
  });
};

var review = function() {
  var color, examine, state, states;

  states = devices.review();

  state = (states.error.length       > 0)                     ? 'error'
          : (states.attention.length < states.warning.length) ? 'warning'
          : (states.attention.length > 0)                     ? 'attention'
          : (states.warning.length   > 0)                     ? 'warning' : 'normal';
  color = devices.rainbow[state].color;

  if (place1.status !== color) {
    place1.status = color;
    place1.changed();
  }

  examine = states.attention.concat(states.error);
  if (examine.length > 0) examine.sort();
  if (place1.info.review.join(',') !== examine.join(',')) {
    place1.info.review = examine;
    place1.changed();
  }

  setTimeout(review, 15 * 1000);
};

var scan = function() {
  var now, previous, times;

  if ((!place1.info.location) || (!util.isArray(place1.info.location))) {
    place1.info.solar = 'no location';
    setTimeout(scan, 5 * 1000);
    return;
  }

  now = new Date();
  times = solarTimes(now, place1.info.location[0], place1.info.location[1]);
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

  if (place1.info.pairing === 'code') place1.makecode();

  setTimeout(scan, 60 * 1000);
};

var validate_observe = function(observe, parameter) {
  var pair
    , params
    , result = { invalid: [], requires: [] };

  switch (observe) {
    case 'cron':
      if (parameter === 'reboot') break;
      parser.parseExpression(parameter, function(err, interval) {/* jshint unused: false */
        if (!!err) result.invalid.push('parameter');
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
        result.invalid.push('parameter ' + params[1] + ': ' + JSON.stringify(pair));
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
  var didP
    , params = {}
    , result = { invalid: [], requires: [] };

  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'wake') {
    if (!params.ipaddress) result.requires.push('ipaddress');
    return result;
  }

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  didP = !!params.name;

  if (!!params.physical) {
    didP = true;

// NB: there is no meaningful test that doesn't require an asynchronous dive...
  }

  if (!!params.location) {
    didP = true;

    if ((!util.isArray(params.location)) || (params.location.length < 2)) result.invalid.push('location');
    else {
      if ((isNaN(params.location[0])) || (params.location[0] <  -90) || (params.location[0] >  90)) {
        result.invalid.push('latitude');
      }
      if ((isNaN(params.location[1])) || (params.location[1] < -180) || (params.location[1] > 180)) {
        result.invalid.push('longitude');
      }
      if ((params.length > 2) && (isNaN(params.location[2]))) result.invalid.push('elevation');
    }
  }

  if (!!params.pairing) {
    didP = true;

    if (!{ off  : true
         , on   : true
         , code : true }[params.pairing]) result.invalid.push('pairing');
  }

  if (!!params.strict) {
    didP = true;

    if (!{ off  : true
         , on   : true }[params.strict]) result.invalid.push('strict');
  }

  if (!!params.displayUnits) {
    didP = true;

    if (!{ customary : true
         , metric    : true }[params.displayUnits]) result.invalid.push('displayUnits');
  }

  if (!didP) result.requires.push('name');

  return result;
};


exports.name2place = function(name) {
  if ((!!name) && (place1.name.toLowerCase() === name.toLowerCase())) return place1;

  return null;
};

var cardinal = [ [ 'N',   'north'            ]
               , [ 'NNE', 'north north-east' ]
               , [ 'NE',  'north-east'       ]
               , [ 'ENE', 'east north-east'  ]
               , [ 'E',   'east'             ]
               , [ 'ESE', 'east south-east'  ]
               , [ 'SE',  'south-east'       ]
               , [ 'SSE', 'south south-east' ]
               , [ 'S',   'south'            ]
               , [ 'SSW', 'south south-west' ]
               , [ 'SW',  'south-west'       ]
               , [ 'WSW', 'west south-west'  ]
               , [ 'W',   'west'             ]
               , [ 'WNW', 'west north-west'  ]
               , [ 'NW',  'north-west'       ]
               , [ 'NNW', 'north north-west' ]
               ];

exports.customary = function(property, value, abbrevP) {
  var azimuth = { heading        : cardinal[Math.floor((value % 360) / 22.5)]
                , windDirection  : cardinal[Math.floor((value % 360) / 22.5)]
                }[property];
  if (!!azimuth) return azimuth[abbrevP ? 0 : 1];

  if (place1.info.displayUnits !== 'customary') return value;

  return {
// celsius -> fahrenheit
           extTemperature  : Math.round(((value * 9) / 5) + 32)
         , goalTemperature : Math.round(((value * 9) / 5) + 32)
         , intTemperature  : Math.round(((value * 9) / 5) + 32)
         , temperature     : Math.round(((value * 9) / 5) + 32)
         , windchill       : Math.round(((value * 9) / 5) + 32)

// millimeters      -> inches
// millimeters/hour -> inches/hour
         , rainRate        : Math.round(value * 0.0393701)
         , rainTotal       : Math.round(value * 0.0393701)

// meters -> feet
         , accuracy        : Math.round(value * 3.28084)

// kilometers -> miles
         , distance        : Math.round(value * 0.621371)
         , odometer        : Math.round(value * 0.621371)
         , range           : Math.round(value * 0.621371)
         , visibility      : Math.round(value * 0.621371)

// meters/second -> miles/hour
         , velocity        : Math.round(value * 2.23694)
         , windAverage     : Math.round(value * 2.23694)
         , windGust        : Math.round(value * 2.23694)
         }[property] || value;
};


exports.start = function() {
  var colors, status;

  colors = [];
  for (status in devices.rainbow) if (devices.rainbow.hasOwnProperty(status)) colors.push(devices.rainbow[status].color);

  steward.actors.place =
      { $info     : { type       : '/place'
                    , observe    : [ 'cron', 'solar' ]
                    , perform    : [ 'wake' ]
                    , properties : { name        : true
                                   , status      : colors
                                   , version     : true
                                   , pairing     : [ 'off', 'on', 'code' ]
                                   , pairingCode : true
                                   , strict      : [ 'off', 'on' ]
                                   , displayUnits: [ 'customary', 'metric' ]
                                   , physical    : true
                                   , location    : 'coordinates'
                                   , identity    : true
                                   , remote      : true
                                   , review      : []
                                   , conditions  : { code        : true
                                                   , text        : true
                                                   , temperature : 'celsius'
                                                   , humidity    : 'percentage'
                                                   , pressure    : 'millibars'
                                                   , windchill   : 'celsius'
                                                   , visibility  : 'kilometers'
                                                   , lastSample  : 'timestamp'
                                                   }
                                   , forecasts   : 'array'
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

  fs.readFile(__dirname + '/../../.git/logs/HEAD', function(err, data) {
    var line, lines;

    if (!!err) return logger.warning('place/1', { event: 'read .git/logs/HEAD', diagnostic: err.message });

    lines = data.toString('utf-8').split('\n');
    if (lines.length < 2) return;
    line = lines[lines.length - 2].split('\t')[0].split(' ');
    version = 'commit ' + line[1].substr(0, 9);
    try { version += ' from ' + utility.relativity(line[line.length - 2] * 1000); } catch(ex) {}
  });

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
  db.get('SELECT value FROM deviceProps WHERE deviceID=0', function(err, row) {
    if (!!err) logger.error('place/1', { event: 'SELECT deviceProps.value for deviceID=0', diagnostic: err.message });
    else if (row !== undefined) {
      params = null;
      try { params = JSON.parse(row.value); } catch(ex) {
        params = null;
        if (row.value.length > 0) logger.error('place/1', { event: 'JSON.parse', data: row.value, diagnostic: ex.message });
      }
      if (!!params) {
        new Place(JSON.parse(row.value));
        review();
        scan();
        return;
      }
    }

    db.run('INSERT INTO deviceProps(deviceID, key, value) VALUES($deviceID, $key, $value)',
           { $deviceID: 0, $key: 'info', $value: '' }, function(err) {
      if (!!err) logger.error('place/1', { event: 'INSERT deviceProps for deviceID=0', diagnostic: err.message });
    });

    new Place({ deviceType: '/place', name: 'Home' });
    review();
    scan();
  });
};
