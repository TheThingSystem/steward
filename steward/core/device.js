var events      = require('events')
  , url         = require('url')
  , util        = require('util')
  , steward     = require('./steward')
  , utility     = require('./utility')
  ;


var logger   = exports.logger   = utility.logger('devices');
var devices  = exports.devices  = {};
var makers   = exports.makers   = {};

var db;


var id2device = function(id) {
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

  steward.actors.device =
      { $info   : { type       : '/device'
                  }
      , $lookup : id2device
      , $list   : idlist
      };
  utility.acquire(logger, __dirname + '/../devices', /^device-.*\.js/, 7, -3, ' driver');
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

  db.get('SELECT deviceID FROM devices WHERE deviceUID=$deviceUID', { $deviceUID: deviceUID }, function(err, row) {
    if (err) {
      logger.error('devices', { event: 'SELECT device.deviceUID for ' + deviceUID, diagnostic: err.message });
    } else if (row !== undefined) {
      if (!!callback) callback(null, null);

      devices[deviceUID].device = new (makers[deviceType])(row.deviceID, deviceUID, info);
      devices[deviceUID].proplist = Device.prototype.proplist;
      logger.info('found ' + info.device.name, { deviceType: deviceType });
      return;
    }

    db.run('INSERT INTO devices(deviceUID, deviceType, deviceName, created) '
           + 'VALUES($deviceUID, $deviceType, $deviceName, datetime("now"))',
           { $deviceUID: deviceUID, $deviceType: deviceType, $deviceName: info.device.name }, function(err) {
      var deviceID;

      if (err) {
        logger.error('devices', { event: 'INSERT device.deviceUID for ' + deviceUID, diagnostic: err.message });
        if (!!callback) callback(err, null);
        return;
      }

      deviceID = this.lastID;

      devices[deviceUID].device = new (makers[deviceType])(deviceID, deviceUID, info);
      devices[deviceUID].proplist = Device.prototype.proplist;
      logger.notice('adding ' + info.device.name, { deviceType: deviceType });

      if (!!callback) callback(null, deviceID);
    });
  });
};


var Device = exports.Device = function() {
  var self = this;

  self.whatami = '/device';
  self.state = 'unknown';
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

Device.prototype.getName = function() {
  var self = this;

  db.get('SELECT deviceName FROM devices WHERE deviceID=$deviceID',
         { $deviceID : self.deviceID }, function(err, row) {
    if (err) {
      logger.error('devices', { event: 'SELECT device.deviceName for ' + self.deviceID, diagnostic: err.message });
      return;
    }
    if (row !== undefined) {
      self.name = row.deviceName;
      self.changed();
    }
  });
};


Device.prototype.setName = function(deviceName) {
  var self = this;

  if (!deviceName) return false;

  db.run('UPDATE devices SET deviceName=$deviceName WHERE deviceID=$deviceID',
         { $deviceName: deviceName, $deviceID : self.deviceID }, function(err) {
    if (err) {
      logger.error('devices', { event: 'UPDATE device.deviceName for ' + self.deviceID, diagnostic: err.message });
    } else {
      self.name = deviceName;
      self.changed();
    }
  });

  return true;
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

  now = now || new Date();
  now = now.getTime();

  self.updated = now;
  if (exports.lastupdated < now) exports.lastupdated = now;
};


exports.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) return self.setName(params.name);

  return false;
};

exports.validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }
  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }

  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!params.name) result.requires.push('name');

  return result;
};

exports.rainbow =
{ error:     { color: 'red',    rgb: '#ff0000' }
, attention: { color: 'indigo', rgb: '#4b0082' }
, warning:   { color: 'blue',   rgb: '#0000ff' }
, normal:    { color: 'green',  rgb: '#00ff00' }

};


var boundedValue = exports.boundedValue = function(value, lower, upper) {
  return ((isNaN(value) || (value < lower)) ? lower : (upper < value) ? upper : value);
};


exports.percentageValue = function(value, maximum) {
  return Math.floor((boundedValue(value, 0, maximum) * 100) / maximum);
};


exports.scaledPercentage = function(percentage, minimum, maximum) {
  return boundedValue(Math.round((boundedValue(percentage, 0, 100) * maximum) / 100), minimum, maximum);
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

    console.log('          '.substr(-(2*depth)) + prefix + actor + ': ' + (!!devices.makers[prefix + actor]));
    exports.traverse(actors[actor], prefix + actor + '/', depth + 1);
  }
};
