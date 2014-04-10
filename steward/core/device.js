var arp         = require('arp-a')
  , events      = require('events')
  , geocoder    = require('geocoder')
  , serialport  = require('serialport')
  , stringify   = require('json-stringify-safe')
  , url         = require('url')
  , util        = require('util')
  , wakeonlan   = require('wake_on_lan')
  , steward     = require('./steward')
  , utility     = require('./utility')
  , broker      = utility.broker
  ;


var logger   = exports.logger   = utility.logger('devices');
var devices  = exports.devices  = {};
var makers   = exports.makers   = {};

var db;


var id2device = exports.id2device = function(id) {
  var child, children, device, i, uid;

  if (!id) return null;

  for (uid in devices) {
    if (!devices.hasOwnProperty(uid)) continue;

    device = devices[uid];
    if (!device.device) continue;
    if (device.device.deviceID === id) return device.device;

    children = device.device.children();
    for (i = 0; i < children.length; i++) {
      child = children[i];
      if (child.deviceID === id) return child;
    }
  }

  return null;
};

var idlist = function() {
  var children, device, i, results, uid;

  results = [];
  for (uid in devices) {
    if (!devices.hasOwnProperty(uid)) continue;

    device = devices[uid];
    if (!device.device) continue;
    results.push(device.device.deviceID);
    children = device.device.children();
    for (i = 0; i < children.length; i++) results.push(children[i].deviceID);
  }
  return results;
};


exports.start = function() {
  db = require('./database').db;

  if (!db) {
    logger.warning('database not ready, retrying...');
    setTimeout(exports.start, 1 * 1000);
  }

  steward.actors.device =
      { $info   : { type       : '/device'
                  }
      , $lookup : id2device
      , $list   : idlist
      };
  utility.acquire(logger, __dirname + '/../devices', /^device-.*\.js$/, 7, -3, ' driver');
// cf., utility.start()
  utility.acquiring--;

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    var d, data, i, ids, info;

    if ((request !== 'ping') || (!broker.has('beacon-egress'))) return;

    ids = idlist();
    data = [];
    for (i = 0; i < ids.length; i++) {
      d = id2device(ids[i]);
      if (!d) continue;

      if (!d.prev) {
        if (!!d.changed) d.changed();
        continue;
      }

      info = JSON.parse(d.prev);
      try { info.updated = d.updated.getTime(); } catch(ex) { info.updated = d.updated; }
      data.push(info);
    }
    if (data.length > 0) broker.publish('beacon-egress', '.updates', data);
  });

  arp.table(function(err, entry) {
    if (!!err) return logger.error('devices', { event: 'arp', diagnostic: err.message });

    if (!entry) return;

    if ((entry.ip !== '0.0.0.0')
            && (entry.ip !== '255.255.255.255')
            && (entry.mac !== '00:00:00:00:00:00')
            && (entry.mac !== 'ff:ff:ff:ff:ff:ff')) arptab[entry.ip] = entry.mac;
  });
};


exports.review = function() {
  var state, states, d, i, ids;

  ids = idlist();
  states = { warning: [], attention: [], error: [] };
  for (i = 0; i < ids.length; i++) {
    d = id2device(ids[i]);
    if (!d) continue;

    state = { blue    : 'warning'
            , busy    : 'warning'
            , waiting : 'warning'
            , orange  : 'attention'
            , red     : 'attention'
            , reset   : 'attention'
            , error   : 'error'
            }[d.status];
    if (!!state) states[state].push('device/' + d.deviceID);
  }

  return states;
};

var arptab = {};

exports.arp = function(ifname, ifaddr, arp) {/* jshint unused: false */
  if ((arp.sender_pa !== '0.0.0.0')
        && (arp.sender_pa !== '255.255.255.255')
        && (arp.sender_ha !== '00:00:00:00:00:00')
        && (arp.sender_ha !== 'ff:ff:ff:ff:ff:ff')) arptab[arp.sender_pa] = arp.sender_ha;

  if ((arp.target_pa !== '0.0.0.0')
        && (arp.target_pa !== '255.255.255.255')
        && (arp.target_ha !== '00:00:00:00:00:00')
        && (arp.target_ha !== 'ff:ff:ff:ff:ff:ff')) arptab[arp.target_pa] = arp.target_ha;
};

exports.prime = function(ipaddr, macaddr) {
  if (macaddr.indexOf(':') === -1) macaddr = macaddr.match(/.{2}/g).join(':');

  if ((ipaddr !== '0.0.0.0')
        && (ipaddr !== '255.255.255.255')
        && (macaddr !== '00:00:00:00:00:00')
        && (macaddr !== 'ff:ff:ff:ff:ff:ff')) arptab[ipaddr] = macaddr;
};

exports.ip2mac = function(ipaddr) { return arptab[ipaddr]; };

exports.mac2ip = function(macaddr) {
  var ipaddr;

  for (ipaddr in arptab) if ((arptab.hasOwnProperty(ipaddr)) && (arptab[ipaddr] === macaddr)) return ipaddr;
};

exports.wake = function(params) {
  var macaddress;

  if ((!params) || (!params.ipaddress)) return false;

  if (!arptab[params.ipaddress]) {
    logger.warning('no MAC address for ' + params.ipaddress);
    return false;
  }
  macaddress = arptab[params.ipaddress].toUpperCase();

  wakeonlan.wake(macaddress, { ipaddress: params.ipaddress }, function(err) {
    if (!!err) return logger.error('unable to wake ' + macaddress + ' for ' + params.ipaddress);

    logger.notice('woke ' + macaddress + ' for ' + params.ipaddress);
  });

  return true;
};


exports.discover = function(info, callback) {
  var deviceType, deviceUID;

  deviceUID = info.id;
  if (!!devices[deviceUID]) {
    if (!!callback) callback(null, null);
    return;
  }

  if ((!info.ipaddress) && (!!info.url)) info.ipaddress = url.parse(info.url).hostname;
  devices[deviceUID] = { discovery : info };

  deviceType = (makers[info.deviceType] || (!info.deviceType2)) ? info.deviceType : info.deviceType2;
  if (!makers[deviceType]) {
    logger.warning('no maker registered for ' + info.deviceType);
    if (!!callback) callback({ message: 'no maker registered for ' + info.deviceType }, null);
    return;
  }
  if (typeof makers[deviceType] !== 'function') return;

  db.get('SELECT deviceID FROM devices WHERE deviceUID=$deviceUID', { $deviceUID: deviceUID }, function(err, row) {
    var deviceMAC;

    if (!!info.ipaddress) deviceMAC = arptab[info.ipaddress];

    if (err) {
      logger.error('devices', { event: 'SELECT device.deviceUID for ' + deviceUID, diagnostic: err.message });
    } else if (row !== undefined) {
      if (!!callback) callback(null, null);

      if (!info.device.name) info.device.name = 'device/' +  row.deviceID;
      devices[deviceUID].device = new (makers[deviceType])(row.deviceID, deviceUID, info);
      devices[deviceUID].proplist = Device.prototype.proplist;
      logger.info('found ' + info.device.name, { deviceID: row.deviceID, deviceType: deviceType });

      db.run('UPDATE devices SET deviceIP=$deviceIP, deviceMAC=$deviceMAC, updated=datetime("now") WHERE deviceID=$deviceID',
         { $deviceIP: info.ipaddress, $deviceMAC: deviceMAC, $deviceID : row.deviceID }, function(err) {
        if (err) logger.error('devices', { event: 'UPDATE device.deviceUID for ' + deviceUID, diagnostic: err.message });
      });

      if (!!callback) callback(null, row.deviceID);
      return;
    }

    db.run('INSERT INTO devices(deviceUID, deviceType, deviceName, deviceIP, deviceMAC, created) '
           + 'VALUES($deviceUID, $deviceType, $deviceName, $deviceIP, $deviceMAC, datetime("now"))',
           { $deviceUID: deviceUID, $deviceType: deviceType, $deviceName: info.device.name, $deviceIP: info.ipaddress,
             $deviceMAC: deviceMAC }, function(err) {
      var deviceID;

      if (err) {
        logger.error('devices', { event: 'INSERT device.deviceUID for ' + deviceUID, diagnostic: err.message });
        if (!!callback) callback(err, null);
        return;
      }

      deviceID = this.lastID;

      if (!info.device.name) info.device.name = 'device/' +  deviceID;
      devices[deviceUID].device = new (makers[deviceType])(deviceID, deviceUID, info);
      devices[deviceUID].proplist = Device.prototype.proplist;
      logger.notice('adding ' + info.device.name, { deviceID: deviceID, deviceType: deviceType });

      if (!!callback) callback(null, deviceID);
    });
  });
};


var Device = exports.Device = function() {
  var self = this;

  self.whatami = '/device';
  self.status = 'unknown';
  self.elide = [];
};
util.inherits(Device, events.EventEmitter);


Device.prototype.children = function() { return []; };

Device.prototype.proplist = function() {
  var i, info, self;

  self = this;
  info = utility.clone(!!self.info ? self.info : {});
  delete(info.name);
  if (!!self.elide) for (i = 0; i < self.elide.length; i++) if (!!info[self.elide[i]]) info[self.elide[i]] = '********';
  if (!!info.lastSample) info.lastSample = new Date(info.lastSample);

  return { whatami   : self.whatami
         , whoami    : 'device/' + self.deviceID
         , name      : !!self.name ? self.name : ''
         , status    : self.status
         , info      : info
         , updated   : !!self.updated ? new Date(self.updated) : null
         };
};

var sensor = null;

Device.prototype.addinfo = function(info, changedP) {
  var self = this;

  var actors, i, now, params, path, prop, v;

  if (!self.$properties) {
    path = self.whatami.split('/');
    actors = steward.actors;
    for (i = 1; i < path.length; i++) {
      if (!actors[path[i]]) break;
      actors = actors[path[i]];
    }
    self.$properties = ((!!actors) && (!!actors.$info)) ? actors.$info.properties : {};
  }

  params = {};
  for (prop in info) {
    if (!info.hasOwnProperty(prop)) continue;

    v = info[prop];
    params[prop] = parseFloat(v);
    if (isNaN(params[prop])) delete(params[prop]);

    if (self.$properties[prop] === 'sigmas') {
      if (!self.$sigmas) self.$sigmas = {};
      if (!self.$sigmas[prop]) self.$sigmas[prop] = new Sigma();
      v = self.$sigmas[prop].add(v);
    }
    if (self.info[prop] !== v) {
      changedP = true;
      self.info[prop] = v;
    }
  }
  if (changedP) {
    self.changed();

    now = new Date().getTime();
    if ((!self.sensing) || (self.sensing < now)) {
      if (!sensor) sensor = require('../devices/device-sensor');
      self.sensing = now + 20 * 1000;
      params.lastSample = now;
      sensor.update(self.deviceID, params);
    }
  }
};

Device.prototype.getName = function() {
  var self = this;

  db.get('SELECT deviceName FROM devices WHERE deviceID=$deviceID',
         { $deviceID : self.deviceID }, function(err, row) {
    if (err) {
      logger.error('devices', { event: 'SELECT device.deviceName for ' + self.deviceID, diagnostic: err.message });
      return;
    }
    if ((row !== undefined) && (!!row.deviceName) && (self.name !== row.deviceName)) {
      self.name = row.deviceName;
      self.changed();
    }
  });
};

Device.prototype.setName = function(deviceName, taskID) {
  var self = this;

  if (!deviceName) return false;
  if (self.name === deviceName) return ((!taskID) || steward.performed(taskID));

  db.run('UPDATE devices SET deviceName=$deviceName WHERE deviceID=$deviceID',
         { $deviceName: deviceName, $deviceID : self.deviceID }, function(err) {
    if (err) {
      return logger.error('devices', { event: 'UPDATE device.deviceName for ' + self.deviceID, diagnostic: err.message });
    }

    self.name = deviceName;
    self.changed();
  });

  return ((!taskID) || steward.performed(taskID));
};

Device.prototype.setInfo = function() {
  var self = this;

  var info = utility.clone(self.info);
  if (!info.id) info.id = self.deviceUID;
  if (!info.deviceType) info.deviceType = self.whatami;
  if (!info.device) info.device = { name: self.name };

  db.run('UPDATE deviceProps SET value=$value WHERE deviceID=$deviceID AND deviceProps.key="info"',
         { $value: JSON.stringify(info), $deviceID : self.deviceID }, function(err) {
    if (err) {
      logger.error('devices', { event: 'UPDATE deviceProps.value for ' + self.deviceID, diagnostic: err.message });
    } else self.changed();
  });

  return true;
};

Device.prototype.getState = function(callback) {
  var self = this;

  db.get('SELECT value FROM deviceProps WHERE deviceID=$deviceID AND key="state"', { $deviceID : self.deviceID },
         function(err, row) {
    var state = null;

    if (!!err) return callback(err);

    if (row === undefined) return callback(null, null);
    try { state = JSON.parse(row.value); } catch(ex) {
      if (row.value.length > 0) logger.error('devices', { event: 'JSON.parse', data: row.value, diagnostic: ex.message });
    }
    callback(null, state);
  });
};

Device.prototype.setState = function(state) {
  var self = this;

  db.serialize(function() {
    db.run('DELETE FROM deviceProps WHERE deviceID=$deviceID AND key="state"', { $deviceID : self.deviceID });

    db.run('INSERT INTO deviceProps(deviceID, key, value) VALUES($deviceID, $key, $value)',
           { $deviceID : self.deviceID, $key: 'state', $value: JSON.stringify(state) });
  });

  return true;

};

Device.prototype.nv = function(v) {
  var b, h, r, u;

  r = /00$/;
  for (h = v.toString('hex'); r.test(h); h = h.replace(r, '')) ;
  if (h !== v.toString('hex')) {
    b = new Buffer(h, 'hex');
    u = b.toString('utf8');
    if (u === b.toString('ascii')) return u;
  }

  return v.toString('hex');
};

exports.lastupdated = new Date().getTime();

Device.prototype.changed = function(now) {
  var self = this;

  var info, prev, updated;

  now = now || new Date();
  now = now.getTime();

  self.updated = now;
  if (exports.lastupdated < now) exports.lastupdated = now;

  info = self.proplist();
  try { info.lastSample = info.lastSample.getTime(); } catch(ex) {}
  try { updated = info.updated.getTime(); } catch(ex) { updated = info.updated; }
  delete(info.updated);
  prev = stringify(info);
  if (self.prev === prev) return;
  self.prev = prev;
  info.updated = updated;

  if (broker.has('beacon-egress')) {
    broker.publish('beacon-egress', '.updates', info);
    if ((self.status === 'reset') || (self.status === 'error')) broker.publish('actors', 'attention');
  }
};

Device.prototype.alert = function(message) {
  var self = this;

  var info, now, updated;

  now = new Date().getTime();
  if ((!!self.nextAlert) && (self.nextAlert > now)) return;
  self.nextAlert = now + (60 * 1000);

  if (broker.has('beacon-egress')) {
    info = self.proplist();

    updated = info.updated.getTime() || now;
    delete(info.updated);

    broker.publish('beacon-egress', '.updates',
                   { updated: updated, level: 'alert', message: message, whoami: info.whoami, name: info.name, info: info });
  }
};

Device.prototype.wake = function() {
  return exports.wake(devices[this.deviceUID].discovery);
};


var geocache = {};
var places   = null;
var maxpts   = 100;

Device.prototype.addlocation = function(self) {
  var entry;

  if (!self.info.location) return;

  if (!places) places = require('./../actors/actor-place');

  if (!places.place1.info.location) delete(self.info.distance);
  else {
    self.info.distance = Math.round(utility.getDistanceFromLatLonInKm(self.info.location[0], self.info.location[1],
                                                                      places.place1.info.location[0],
                                                                      places.place1.info.location[1]));
    if (!self.info.distance) self.info.distance = "0";
  }

  entry = self.info.location.slice(0, 2).join(',');
  if (self.info.locations.length === 0) {
    self.info.locations.push(entry);
    return;
  }
  if (entry === self.info.locations[self.info.locations.length - 1]) return;

  self.info.locations.push(entry);
  if ((self.info.locations.length > maxpts) && (!self.timerB)) self.timerB = setTimeout (function() { self.balance(self); }, 0);
};

Device.prototype.addpath = function(self, path) {
  var entry, i;

  if ((!util.isArray(path)) || (path.length < 1)) return false;

  for (i = 0; i < path.length; i++) {
    entry = path[i].slice(0, 2).join(',');
    if ((self.info.locations.length !== 0) && (entry === self.info.locations[self.info.locations.length - 1])) continue;

    self.info.locations.push(entry);
  }

  self.addlocation(self);
  return true;
};

Device.prototype.balance = function(self) {
  var d, i, location, points, previous, q;

  self.timerB = null;
  if (self.info.locations.length <= maxpts) return;

  if (self.info.locations.length > maxpts) self.info.locations.splice (0, self.info.locations.length - maxpts);
  q = Math.round(maxpts / 2);

  d = [];
  for (i = 1, previous = self.info.locations[0].split(','); i < self.info.locations.length - 1; i++, previous = location) {
    location = self.info.locations[i].split(',');
    d.push([ i
           , self.info.locations[i],
           , utility.getDistanceFromLatLonInKm(location[0], location[1], previous[0], previous[1])
           ]);
  }
  d.sort(function(a,b) { return (b[2] - a[2]); });
  d.splice(0, q);

  points = [];
  d.sort(function(a,b) { return (b[0] - a[0]); });
  for (i = 0; i < d.length; i++) points.push(d[i][1]);
  points.push(self.info.locations[self.info.locations.length - 1]);

  self.info.locations = points;
};

Device.prototype.reverseGeocode = function(self, logger) {
  var key, location;

  if (self.info.locations.length < 1) return;

  if (!places) places = require('./../actors/actor-place');

  location = self.info.locations[self.info.locations.length - 1].split(',');
  key = parseFloat(location[0]).toFixed(3) + ',' + parseFloat(location[1]).toFixed(3);

  if ((!!places.place1.info.location)
          && (location[0] === places.place1.info.location[0])
          && (location[1] === places.place1.info.location[1])) {
    geocache[key] = places.place1.info.physical;
  }
  if (!!geocache[key]) {
    if (self.info.physical !== geocache[key]) {
      self.info.physical = geocache[key];
      self.changed();
    }

    return;
  }

  geocoder.reverseGeocode(location[0], location[1], function(err, result) {
    if (!!err) return logger.error('device/' + self.deviceID, { event      : 'reverseGeocode'
                                                              , location   : location
                                                              , diagnostic : err.message });
    if (result.status !== 'OK') return logger.debug('device/' + self.deviceID, { event      : 'reverseGeocode'
                                                                               , location   : location
                                                                               , diagnostic : result.status });
    if (result.results.length < 1) return;

    geocache[key] = result.results[0].formatted_address;
    self.info.physical = geocache[key];
    self.changed();
  });
};


var Sigma = function() {
  var self = this;

  if (!(self instanceof Sigma)) return new Sigma();

  self.n = 0;
  self.sum = 0;
  self.sumsq = 0;
};

Sigma.prototype.add = function(v) {
  var self = this;

  var mu, sigma, sigmas;

  self.n++;
  self.sum += v;
  self.sumsq += v * v;

  if (self.n < 2) return 0;

  mu = self.sum / self.n;
  sigma = Math.sqrt((self.sumsq - (self.sum * self.sum / self.n)) / (self.n - 1));
  sigmas = (v - mu) / sigma;
  return (isNaN(sigmas) ? 0 : sigmas.toFixed(2));
};


exports.attempt_perform = function(key, params, fn) {
  if (typeof params[key] === 'undefined') return;

  fn(params[key]);
  return true;
};

exports.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'wake') return self.wake();

  if (perform !== 'set') return false;

  if (!!params.name) return self.setName(params.name);

  return false;
};

exports.validate_param = function(key, params, result, numericP, map) {
  var value;

  if (typeof params[key] === 'undefined') return;
  value = params[key];

  if ((typeof map[value] !== 'undefined') || (typeof numericP === 'undefined')) return;

  if (typeof numericP === 'boolean') {
    if (numericP) numericP = function(value) { return !isNaN(parseInt(value, 10)); };
  }

  if ((typeof numericP === 'function') && (!numericP(value))) result.invalid.push(key);
};

exports.validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'wake') {
    if (!params.ipaddress) result.requires.push('ipaddress');
    return result;
  }

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.name) result.requires.push('name');

  return result;
};

exports.rainbow =
{ error:     { color: 'red',    rgb: { r: 255, g:   0, b:   0 } }
, attention: { color: 'orange', rgb: { r: 255, g: 131, b:   0 } }
, warning:   { color: 'blue',   rgb: { r:   0, g:   0, b: 255 } }
, normal:    { color: 'green',  rgb: { r:   0, g: 255, b:   0 } }
};


var boundedValue = exports.boundedValue = function(value, lower, upper) {
  return ((isNaN(value) || (value < lower)) ? lower : (upper < value) ? upper : value);
};


exports.percentageValue = function(value, maximum) {
  return Math.floor((boundedValue(value, 0, maximum) * 100) / maximum);
};


exports.scaledPercentage = function(percentage, minimum, maximum) {
  return boundedValue(Math.round((boundedValue(percentage, 0, 100) * (maximum - minimum) / 100)) + minimum, minimum, maximum);
};

exports.scaledLevel = function(level, minimum, maximum) {
  return boundedValue(Math.round(((boundedValue(level, minimum, maximum) - minimum) * 100) / (maximum - minimum)), 0, 100);
};

exports.degreesValue = function(value, maximum) {
  return Math.floor((boundedValue(value, 0, maximum) * 360) / maximum);
};


exports.scaledDegrees = function(degrees, maximum) {
  while (degrees <    0) degrees += 360;
  while (degrees >= 360) degrees -= 360;

  return boundedValue(Math.round((degrees * maximum) / 360), 0, maximum);
};


exports.traverse = function(actors, prefix, depth) {
  var actor;

  if (!actors) return exports.traverse(steward.actors, '/', 1);

  for (actor in actors) {
    if (!actors.hasOwnProperty(actor)) continue; if (actor.indexOf('$') !== -1) continue;

    console.log('          '.substr(-(2*depth)) + prefix + actor + ': ' + (!!makers[prefix + actor]));
    exports.traverse(actors[actor], prefix + actor + '/', depth + 1);
  }
};

// expansion of '.[deviceID.property].'
exports.expand = function(line, defentity) {
  var entity, field, info, p, part, parts, result, who, x;

  if (typeof line !== 'string') return line;
  result = '';
  while ((x = line.indexOf('.[')) >= 0) {
    if (x > 0) result += line.substring(0, x);
    line = line.substring(x + 2);

    x = line.indexOf('].');
    if (x === -1) {
      result += '.[';
      continue;
    }

    parts = line.substring(0, x).split('.');
    line = line.substring(x + 2);

    entity = null;
    if (parts[0] === '') {
      if (typeof defentity === 'string') parts[0] = defentity; else entity = defentity;
    }
    if (!entity) {
      if (parts[0].indexOf('/') !== -1) {
        who = parts[0].split('/');
        entity = steward.actors[who[0]];
        if (!!entity) entity = entity.$lookup(who[1]);
      } else entity = id2device(parts[0]);
    }
    if (!entity) {
      result += '.[' + parts.join('.') + '].';
      continue;
    }

    if ((parts.length == 2) && ((parts[1] === 'name') || (parts[1] === 'status'))) {
      result += entity[parts[1]];
      continue;
    }

    info = entity.info;
    field = '';
    for (p = 1; p < parts.length; p++) {
      part = parts[p];
      if (!info) return null;
      if ((typeof info[part] === 'undefined') || (info[part].length === 0)) {
        field = '';
        break;
      }
      info = info[part];
      field = info;
    }
    result += field;
  }
  result += line;

  return result;
};


var scanning = {};

exports.scan_usb = function(logger2, tag, fingerprints, callback) {
  serialport.list(function(err, info) {
    var i, j;

    var f = function(comName) {
      return function(err) { if (!!err) delete(scanning[comName]); };
    };

    if (!!err) return logger2.error(tag, { diagnostic: err.message });

    for (i = 0; i < info.length; i++) {
      for (j = fingerprints.length - 1; j !== -1; j--) {
        if ((info[i].pnpId.indexOf(fingerprints[j].pnpId) === 0)
              || ((     fingerprints[j].manufacturer === info[i].manufacturer)
                    && (fingerprints[j].vendorId     === parseInt(info[i].vendorId, 16))
                    && (fingerprints[j].productId    === parseInt(info[i].productId, 16)))) {
          info[i].vendor = fingerprints[j].vendor;
          info[i].modelName = fingerprints[j].modelName;
          info[i].description = fingerprints[j].description;
          info[i].deviceType = fingerprints[j].deviceType;
          if (!info[i].vendorId)     info[i].vendorId     = fingerprints[j].vendorId;
          if (!info[i].productId)    info[i].productId    = fingerprints[j].productId;
          if (!info[i].manufacturer) info[i].manufacturer = fingerprints[j].manufacturer;
          if (!info[i].serialNumber) info[i].serialNumber = info[i].pnpId.substr(fingerprints[j].pnpId.length).split('-')[0];

          if (!!scanning[info[i].comName]) continue;
          scanning[info[i].comName] = true;

          callback(info[i], f(info[i].comName));
        }
      }
    }
  });
};
