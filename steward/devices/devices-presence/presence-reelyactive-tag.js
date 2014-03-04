// reelyActive tags -- http://reelyactive.com/corporate/technology.htm


var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , presence    = require('./../device-presence')
  ;


var logger = presence.logger;


var Tag = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'present';
  self.changed();
  self.info = { rankings: [] };

  self.events = {};
  self.rankings = [];
  self.rolling = 30;
  self.rolling2 = self.rolling * 2;
  self.waitingP = true;

  self.update(self, info.params.v, info.params.timestamp);

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      if ((observe !== 'closest') && (observe !== 'sequence')) return;

      self.events[eventID] = { observe: observe, parameter: parameter, active: false };
      return;
    }
    if (request === 'perform') return devices.perform(self, eventID, observe, parameter);
  });

  setInterval(function() { if (!self.waitingP) self.update(self, null, new Date().getTime()); }, 10 * 1000);
};
util.inherits(Tag, presence.Device);
Tag.prototype.perform = devices.perform;


// TBD: multiple reels reporting the same tag...

Tag.prototype.update = function(self, v, timestamp) {
  var eventID, i, latest, rankings, status;

  if (!!v) {
    if (v.length === 0) return;
    self.waitingP = false;
    self.rankings.push({ reels: v, timestamp: timestamp, observed: {} });
  }
  if (self.rankings.length > self.rolling2) self.rankings.splice(0, 1);

  timestamp -= self.rolling * 1000;
  for (i = self.rankings.length - 1; i >= 0; i--) if (self.rankings[i].timestamp < timestamp) break;
  if (i >= 0) self.rankings.splice(0, i + 1);

  rankings = [];
  if (self.rankings.length !== 0) {
    latest = self.rankings[self.rankings.length - 1].reels;
    for (i = 0; i < latest.length; i++) rankings.push(latest[i].deviceID);
    try {
      self.info.lqi = latest[0].reading;
    } catch(ex) {
      logger.warning('device/' + self.deviceID, { event: 'empty ranking', rankings: self.rankings });    }
    status = 'present';
  } else {
    delete(self.info.lqi);
    status = 'absent';
  }

  for (eventID in self.events) if (self.events.hasOwnProperty(eventID)) self.examine(self, eventID);

  if ((self.status === status) && (self.info.rankings.length === rankings.length)) {
    for (i = 0; i < rankings.length; i++) if (self.info.rankings[i] !== rankings[i]) break;
    if (i === rankings.length) return;
  }

  self.status = status;
  self.info.rankings = rankings;
  self.changed();
};

Tag.prototype.examine = function(self, eventID) {
  var event, i, j, k, n, params;

  var f = function() { self.events[eventID].active = false; };

  event = self.events[eventID];

  try { params = JSON.parse(event.parameter); } catch(ex) {
    return logger.error ('device/' + self.deviceID,
                         { event: 'invalid parameter', eventID: eventID, diagnostic: ex.message });
  }

  if (event.observe === 'closest') {
    n = parseInt(params.consecutive, 10);
    if ((isNaN(n)) || (n < 1)) n = 2;
    k = self.rankings.length - n;
    if (k < 0) return f();
    for (j = 0; j < n; j++) if (self.rankings[k + j].reels[0].deviceID !== params.device) return f();

    if (self.rankings[k].observed[eventID]) {
      for (j = 1; j < n; j++) self.rankings[k + j].observed[eventID] = true;
      return;
    }

    for (j = 0; j < n; j++) self.rankings[k + j].observed[eventID] = true;
    if (self.events[eventID].active) return;

    self.events[eventID].active = true;
    return steward.observed(eventID);
  }

  if ((!util.isArray(params)) || (params.length < 1)) return f();

  for (k = 0; k < self.rankings.length; k++) if (!self.rankings[k].observed[eventID]) break;
  if (k === self.rankings.length) return f();

  for (i = 0, j = k; i < params.length; i++, j = k + 1) {
    k = self.examine2(self, params[i], j);
    if (k < 0) return f();
  }

  for (j = 0; j <= k; j++) self.rankings[j].observed[eventID] = true;
  if (self.events[eventID].active) return;

  self.events[eventID].active = true;
  steward.observed(eventID);
};

Tag.prototype.examine2 = function(self, param, start) {
  var duration, i, t0;

  var f = function(ranking) {
    var deviceID, i, j, k;

    for (i = k = 0; i < ranking.reels.length; i++) {
      deviceID = ranking.reels[i].deviceID;
      for (j = k; j < param.rankings.length; j++) {
        if (param.rankings[j] === deviceID) break;
      }
      if (j === param.rankings.length) return false;
      k = j + 1;
    }

    return true;
  };

  for (i = start; i < self.rankings.length; i++) if (f(self.rankings[i])) break;
  if (i === self.rankings.length) return (-1);
  if ((!param.time) || (param.time === 0)) return i;
  t0 = self.rankings[i].timestamp;

  for (i++; i < self.rankings.length; i++) {
    duration = self.rankings[i].timestamp - t0;
    if (f(self.rankings[i])) {
      if (duration >= param.time) return i;
      continue;
    }
    if (duration >= param.time) return (i - 1);
    if ((start + 1) === self.rankings.length) return (-1);
    return self.examine2(self, param, start + 1);
  }

  return (-1);
};

var validate_observe = function(observe, parameter) {
  var i, j, ranking, rankings;

  var params = {}
    , result = { invalid: [], requires: [] };

  if (observe.charAt(0) === '.') return result;

  if ((observe !== 'closest') && (observe !== 'sequence')) {
    result.invalid.push('observe');
    return result;
  }
  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }

  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (observe === 'closest') {
    if ((!params.device)
          || ((!!params.consecutive) && isNaN(parseInt(params.consecutive, 10)))) result.invalid.push('parameter');
    return result;
  }

  if ((!util.isArray(params)) || (params.length < 1)) {
    result.invalid.push('parameter');
    return result;
  }
  for (i = 0; i < params.length; i++) {
    if ((!!params[i].time) && isNaN(parseInt(params[i].time, 10))) break;
    rankings = params[i].rankings;
    if ((!util.isArray(rankings)) || (rankings.length < 1)) break;
    for (j = 0; j < rankings.length; j++) {
      ranking = rankings[j].split('/');
      if ((ranking[0] !== '/device') || (parseInt(ranking[1], 10) < 1)) break;
    }
    if (j !== rankings.length) break;
  }
  if (i !== params.length) result.invalid.push('parameter');

  return result;
};

exports.start = function() {
  steward.actors.device.presence.reelyactive = steward.actors.device.presence.reelyactive ||
      { $info     : { type: '/device/presence/reelyactive' } };

  steward.actors.device.presence.reelyactive.fob =
      { $info     : { type       : '/device/presence/reelyactive/fob'
                    , observe    : [ 'closest', 'sequence' ]
                    , perform    : [ ]
                    , properties : { name     : true
                                   , status   : [ 'present', 'absent' ]
                                   , lqi      : 's8'
                                   , rankings : []
                                   }
                    }
      , $validate : { observe    : validate_observe
                    , perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/presence/reelyactive/fob'] = Tag;
};
