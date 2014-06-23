// Philips Hue: http://meethue.com

var http        = require('http')
  , https       = require('https')
  , md5         = require('MD5')
  , stringify   = require('json-stringify-safe')
  , url         = require('url')
  , util        = require('util')
  , db          = require('./../../core/database').db
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var Hue = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/gateway/hue/bridge';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'busy';
  self.changed();
  self.lights = {};
  self.waitingP = false;
  self.inflight = 0;
  self.maxflights = 3;

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    var light;

    if (request === 'attention') {
      if (self.status === 'reset') self.alert('please push pairing button on Hue bridge');
      return;
    }

    if (request !== 'perform') return;

    deviceID = actor.split('/')[1];
    if (self.deviceID === deviceID) return self.perform(self, taskID, perform, parameter, null, 0);
    for (light in self.lights) {
      if (!self.lights.hasOwnProperty(light)) continue;

      if (self.lights[light].deviceID === deviceID) return self.perform(self, taskID, perform, parameter, light, 0);
    }
  });

  db.get('SELECT value FROM deviceProps WHERE deviceID=$deviceID AND key=$key',
               { $deviceID: self.deviceID, $key: 'username' }, function(err, row) {
    if (err) {
      logger.error('device/' + self.deviceID, { event: 'SELECT username for ' + self.deviceID, diagnostic: err.message });
      return;
    }
    if (row !== undefined) {
      self.username = row.value;
      self.changed();
    }
    self.heartbeat(self);
  });
};
util.inherits(Hue, lighting.Device);


Hue.prototype.children = function() {
  var self = this;

  var children, light;

  children = [];
  for (light in self.lights) if (self.lights.hasOwnProperty(light)) children.push(childprops(self, light));

  return children;
};

var childprops = function(self, light) {
  var child, color, prop, props;

  child = {};
  props = self.lights[light];
  for (prop in props) if (props.hasOwnProperty(prop)) child[prop] = props[prop];

  child.id = light;
  child.discovery = { id: child.id, source: 'device/' + self.deviceID, deviceType: child.type };
  child.whoami = 'device/' + child.deviceID;

  if (!!child.state) {
    child.status = !child.state.reachable ? 'waiting' :  child.state.on ? 'on' : 'off';
    color = {};
    if (child.state.colormode === 'ct')  {
      color.model       = 'temperature';
      color.temperature = { temperature: child.state.ct };
    } else if (child.state.colormode === 'hue') {
      color.model       = 'hue';
      color.hue         = { hue: degreesHue(child.state.hue), saturation: percentageSat(child.state.sat) };
    } else if (child.state.colormode === 'xy') {
      color.model       = 'cie1931';
      color.cie1931     = { x: child.state.xy[0], y: child.state.xy[1] };
    } else {
      color.model       = 'hue';
      color.hue         = { hue: 0, saturation: 0 };
    }
    child.info = { color: color, brightness: percentageBri(child.state.bri) };
    child.updated = props.updated;
  }

  child.proplist = devices.Device.prototype.proplist;

  child.perform = function(bulb, taskID, perform, parameter) { return self.perform(self, taskID, perform, parameter, light); };

  return child;
};


Hue.prototype.perform = function(self, taskID, perform, parameter, id, oops) {
  var color, params, state;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  state = {};
  if (!id) {
    if (perform === 'wake') return self.wake();

    if ((perform !== 'set') || (!params.name)) return false;
    state.name = params.name;

    logger.debug('device/' + self.deviceID, { perform: state });
    self.roundtrip(self, 'device/' + self.deviceID, { method: 'PUT', pathname: '/api/' + self.username + '/config' }, state,
                   function(err, state, response, result) {
      var i, errors;

      logger.debug('config: ' + state + ' code ' + response.statusCode, { err: stringify(err), result: stringify(result) });
      if (err) {
        if (oops++ < 3) setTimeout(function() { self.perform(self, perform, parameter, id, oops); }, self.interval(3, 15));
        return;
      }

      errors = result.errors;
      for (i = 0; i < errors.length; i++) {
        logger.error('device/' + self.deviceID, { event: 'controller', parameter: 'config', diagnostic: stringify(errors[i]) });
      }
      if (errors.length > 0) return;

      self.refresh(self);
    });

    return steward.performed(taskID);
  }

  if (perform === 'set') {
    if (!params.name) return false;

    if (self.lights[id].name === params.name) return steward.performed(taskID);

    db.run('UPDATE devices SET deviceName=$deviceName WHERE deviceID=$deviceID',
           { $deviceName: params.name, $deviceID : self.lights[id].deviceID }, function(err) {
      if (err) {
        return logger.error('devices',
                            { event: 'UPDATE device.deviceName for ' + self.lights[id].deviceID, diagnostic: err.message });
      }

      self.lights[id].name = params.name;
      self.lights[id].updated = new Date().getTime();
      self.changed();
    });

    return steward.performed(taskID);
  }

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return;
  else {
    state.on = true;

    if (!!params.brightness) state.bri = hueBrightness(params.brightness);

    color = params.color;
    if (!!color) {
      switch (color.model) {
        case 'temperature':
          state.ct = temperature(color.temperature.temperature);
          break;

        case 'hue':
          state.hue = hueHue(color.hue.hue);
          state.sat = hueSaturation(color.hue.saturation);
          break;

        case 'cie1931':
          state.xy = lighting.colors.cie1931([ color.cie1931.x, color.cie1931.y]);
          break;

        case 'rgb':
          state.xy = lighting.colors.rgbToCIE1931(color.rgb.r, color.rgb.g, color.rgb.b);
          break;

        default:
          break;
      }
    }
  }

  logger.debug('device/' + self.lights[id].deviceID, { perform: state });
  self.roundtrip(self, 'device/' + self.deviceID,
                 { method: 'PUT', pathname: '/api/' + self.username + '/lights/' + id + '/state' }, state,
                 function(err, state, response, result) {
    var i, errors;

    logger.debug('lights/' + id + ': code ' + response.statusCode, { err: stringify(err), result: stringify(result) });
    if (err) {
      if (oops++ < 3) setTimeout(function() { self.perform(self, perform, parameter, id, oops); }, self.interval(5, 30));
      return;
    }

    errors = result.errors;
    for (i = 0; i < errors.length; i++) {
      logger.error('device/' + self.deviceID, { event: 'light ' + id, parameter: 'config', diagnostic: stringify(errors[i]) });
    }
    if (errors.length > 0) return;

    self.refresh2(self, id, 0);
  });

  return steward.performed(taskID);
};


Hue.prototype.heartbeat = function(self) {
  self.status = (self.waitingP) || (!self.username) ? 'reset' : 'ready';

  if (!!self.username) {
    self.refresh(self);
  } else {
    self.pair(self, 0);
  }
};


Hue.prototype.pair = function(self, oops) {
  if (!steward.uuid) {
    oops++;
    self.timer = setTimeout(function() { self.pair(self, oops); },  ((oops < 3) ? 5 : 30) * 1000);
    return logger.warning('device/' + self.deviceID, { event: 'pair', diagnostic: 'steward.uuid not yet set' });
  }

  self.roundtrip(self, 'device/' + self.deviceID, { method: 'POST', pathname: '/api' },
                 { username: md5(steward.uuid), devicetype: 'steward' }, function(err, state, response, result) {
    var i, results, errors;

    self.waitingP = false;
    self.timer = setTimeout(function() { self.heartbeat(self); },  1 * 1000);
    logger.debug('pair: ' + state + ' code ' + response.statusCode, { err: stringify(err), result: stringify(result) });

    if ((err) || (state !== 'end')) return;

    if (!!(results = result.results)) {
      for (i = 0; i < results.length; i++) {
        if (results[i].success) {
          self.username = results[i].success.username;
          self.changed();
          db.run('INSERT INTO deviceProps(deviceID, key, value) VALUES($deviceID, $key, $value)',
                         { $deviceID: self.deviceID, $key: 'username', $value: self.username });
          return;
        }
      }
    }

    errors = result.errors;
    for (i = 0; i < errors.length; i++) {
      if (errors[i].type == 101) {
        self.waitingP = true;
        break;
      }
      logger.error('device/' + self.deviceID, { event: 'controller', parameter: 'pair', diagnostic: stringify(errors[i]) });
    }
    self.changed();
  });
};


Hue.prototype.unpair = function(self) {
  self.roundtrip(self, 'device/' + self.deviceID,
                 { method: 'DELETE', pathname: '/api/' + self.username + '/config/whitelist/' + self.username },
                 function(err, state, response, result) {
    logger.debug('unpair: ' + state + ' code ' + response.statusCode, { err: stringify(err), result: stringify(result) });

    self.username = undefined;
    self.waitingP = false;
    db.run('DELETE FROM deviceProps WHERE deviceID=$deviceID AND key=$key',
                   { $deviceID: self.deviceID, $key: 'username' }, function(err) {
      if (err) logger.error('device/' + self.deviceID, { event: 'DELETE username', diagnostic: err.message });
    });
    self.changed();
  });
};


Hue.prototype.refresh = function(self) {
  self.roundtrip(self, 'device/' + self.deviceID, '/api/' + self.username, function(err, state, response, result) {
    var config, i, light, lights, results, errors;

    self.timer = setTimeout(function() { self.heartbeat(self); }, 30 * 1000);
    logger.debug('config: ' + state + ' code ' + response.statusCode, { err: stringify(err), result: stringify(result) });
    if (err) return;

    errors = result.errors;
    for (i = 0; i < errors.length; i++) {
      logger.error('device/' + self.deviceID, { event: 'controller', parameter: 'refresh', diagnostic: stringify(errors[i]) });
    }
    if (errors.length > 0) {
      self.username = undefined;
      self.waitingP = false;
      db.run('DELETE FROM deviceProps WHERE deviceID=$deviceID AND key=$key',
             { $deviceID: self.deviceID, $key: 'username' }, function(err) {
        if (err) logger.error('device/' + self.deviceID, { event: 'DELETE username', diagnostic: err.message });
      });
      return self.changed();
    }

    if (!(results = result.results)) return;

    config = results.config;
    self.name = config.name;
    db.run('UPDATE devices SET deviceName=$deviceName, deviceIP=$deviceIP, deviceMAC=$deviceMAC WHERE deviceID=$deviceID',
           { $deviceName: config.name, $deviceIP: config.ipaddress, $deviceMAC: config.mac, $deviceID: self.deviceID },
           function(err) {
      if (err) logger.error('device/' + self.deviceID, { event: 'REPLACE name/address', diagnostic: err.message });
    });

    lights = results.lights;
    for (light in lights) if (lights.hasOwnProperty(light)) self.addlight(self, light, lights[light]);
  });
};


Hue.prototype.addlight = function(self, id, props) {
  var name, prop, type, whatami;

  var deviceUID = self.deviceUID + '/lights/' + id;

  if (self.lights[id]) {
    name = self.lights[id].name;
// a name set by the user wins over the Hue configuration name...
    if (name !== id.toString()) props.name = name;
    type = self.lights[id].type;
    for (prop in props) if (props.hasOwnProperty(prop)) self.lights[id][prop] = props[prop];
    if ((name !== self.lights[id].name) || (type !== self.lights[id].type)) {

      db.run('UPDATE devices SET deviceType=$deviceType, deviceName=$deviceName WHERE deviceID=$deviceID',
             { $deviceType: self.lights[id].type, $deviceName: self.lights[id].name, $deviceID: self.lights[id].deviceID });
      logger.info('device/' + self.lights[id].deviceID, childprops(self, id));
    }

    self.refresh3(self, id, props);
    return;
  }

  if (!props.state.reachable) return;

  switch (props.modelid.substr(0, 3)) {
    case 'LLC':
      whatami = '/device/lighting/hue/uplight';
      break;

    case 'LST':
      whatami = '/device/lighting/hue/lightstrip';
      break;

    default:
      whatami = (props.modelid !== 'LCT002') ? '/device/lighting/hue/bulb' : '/device/lighting/hue/downlight';
      break;
  }
  self.lights[id] = { whatami : whatami
                    , name    : id.toString()
                    , status  : 'busy'
                    };
  db.get('SELECT deviceID, deviceType, deviceName FROM devices WHERE deviceUID=$deviceUID',
         { $deviceUID: deviceUID }, function(err, row) {
    var prop;

    if (err) {
      logger.error('device/' + self.deviceID, { event: 'SELECT device.deviceUID for light ' + id, diagnostic: err.message });
      return;
    }

    if (row !== undefined) {
      for (prop in props) if (props.hasOwnProperty(prop)) self.lights[id][prop] = props[prop];
      self.lights[id].deviceID = row.deviceID.toString();
      self.lights[id].type = row.deviceType;
      self.lights[id].name = row.deviceName;

      self.lights[id].status = 'waiting';
      self.refresh3(self, id, props);
      return;
    }

    db.run('INSERT INTO devices(deviceUID, parentID, childID, created) '
           + 'VALUES($deviceUID, $parentID, $childID, datetime("now"))',
           { $deviceUID: deviceUID, $parentID: self.deviceID, $childID: id }, function(err) {
      var lightID;

      if (err) {
        logger.error('device/' + self.deviceID, { event: 'INSERT device.deviceUID for light ' + id, diagnostic: err.message });
        return;
      }

      lightID = this.lastID;

      self.lights[id] = props;
      self.lights[id].deviceID = lightID.toString();
      self.lights[id].whatami = whatami;
      if (!self.lights[id].name) self.lights[id].name = id.toString();
      self.lights[id].status = 'waiting';
      self.refresh3(self, id, props);
    });
  });
};

Hue.prototype.refresh2 = function(self, id, oops) {
  self.lights[id].status = 'refreshing';
  self.roundtrip(self, 'device/' + self.deviceID, '/api/' + self.username + '/lights/' + id,
                 function(err, state, response, result) {
    var i, results, errors;

    logger.debug('lights/' + id + ': code ' + response.statusCode, { err: stringify(err), result: stringify(result) });
    if (err) {
      if (oops++ < 3) setTimeout (function() { self.refresh2(self, id, oops); }, self.interval(5, 30));
      return;
   }

    errors = result.errors;
    for (i = 0; i < errors.length; i++) {
      logger.error('device/' + self.deviceID, { event: 'light ' + id, parameter: 'lights', diagnostic: stringify(errors[i]) });
    }
    if (errors.length > 0) return;

    if (!(results = result.results)) return;

    self.refresh3 (self, id, results);
  });
};

Hue.prototype.refresh3 = function(self, id, results) {
  if (self.lights[id].name !== id.toString()) results.name = self.lights[id].name;
  db.run('UPDATE devices SET deviceType=$deviceType, deviceName=$deviceName WHERE deviceID=$deviceID',
         { $deviceType: results.type, $deviceName: results.name, $deviceID: self.lights[id].deviceID },
         function(err) {
    var child, info, prev, prop;

    if (err) {
      logger.error('device/' + self.deviceID, { event: 'REPLACE type/name for light ' + id, diagnostic: err.message });
      return;
    }

    for (prop in results) if (results.hasOwnProperty(prop)) self.lights[id][prop] = results[prop];
    child = childprops(self, id);
    info = child.proplist();
    delete(info.updated);
    prev = stringify(info);
    if (self.lights[id].prev === prev) return;

    self.changed();
    self.lights[id].prev = prev;
    self.lights[id].updated = self.updated;
    info.updated = self.updated;

    if (broker.has('beacon-egress')) broker.publish('beacon-egress', '.updates', info);
  });
};


var percentageU8 = function(u8)  { return devices.percentageValue (u8,      254); };
var scaledU8     = function(pct) { return devices.scaledPercentage(pct, 0,  254); };
var degreesU16   = function(u16) { return devices.degreesValue    (u16,   65535); };
var scaledU16    = function(deg) { return devices.scaledDegrees   (deg,   65535); };
var temperature  = function(ct)  { return devices.boundedValue    (ct, 154, 500); };

var percentageBri = function(bri) { return percentageU8(bri); };
var hueBrightness = function(bri) { return scaledU8(bri);     };
var degreesHue    = function(hue) { return degreesU16(hue);   };
var hueHue        = function(hue) { return scaledU16(hue);    };
var percentageSat = function(sat) { return percentageU8(sat); };
var hueSaturation = function(sat) { return scaledU8(sat);     };


// in seconds

Hue.prototype.interval = function(min, max) {
  var secs = Math.round((Math.random() * (max - min) + min) * 1000) ;

  return secs;
};

Hue.prototype.roundtrip = function(self, tag, params) {
  var body    = null
    , cb      = null
    , options = url.parse(self.url);

  if (typeof params !== 'object') params = { pathname : params };
  if (arguments.length == 4) {
    if (typeof arguments[3] === 'function') {
      cb = arguments[3];
    } else {
      body = arguments[3];
    }
  } else if (arguments.length > 4) {
    body = (typeof arguments[3] === 'object') ? JSON.stringify(arguments[3]) : arguments[3];
    cb = arguments[4];
  }

  if (self.inflight >= self.maxflights) {
    setTimeout(function() {
      if (body) self.roundtrip(self, tag, params, body, cb); else self.roundtrip(self, tag, params, cb);
    }, 100);
    return;
  }
  self.inflight++;

  options.agent    = false;
  options.method   = params.method   || 'GET';
  options.pathname = params.pathname || '/';
  options.search   = params.search   || '';
  options.path     = params.path     || options.pathname;
  options.query    = params.query    || '';
  options.hash     = params.hash     || '';
  options.headers  = params.headers  || {};

  http.request(options, function(response) {
    var content = '';

    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      content += chunk.toString();
    }).on('end', function() {
      var errors, i, results;

      if (response.statusCode !== 200) logger.warning(tag, { event: 'http', code: response.statusCode, content: content });

      try { results = JSON.parse(content); } catch(ex) {
        logger.error(tag, { event: 'JSON', data: content, diagnostic: ex.message });
        results = [];
      }

      errors = [];
      if (util.isArray(results)) {
        for (i = 0; i < results.length; i++) {
          if (results[i].error) {
            errors.push(results[i].error);
            results.splice(i);
            break;
          }
        }
      }

      cb(null, 'end', response, { results: results, errors: errors });
      self.inflight--;
    }).on('close', function() {
      logger.warning(tag, { event:'http', diagnostic: 'premature eof' });
      cb(null, 'close', response);
      self.inflight--;
    });
  }).on('error', function(err) {
    if (err.message === 'read ECONNRESET') logger.debug(tag, { event: 'http', options: options, diagnostic: err.message });
    else logger.error(tag, { event: 'http', options: options, diagnostic: err.message });
    cb(err, 'error', { statusCode: 'busy' });
    self.inflight--;
  }).end(body);
};


var validate_perform_hue = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'wake') return result;

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.name) result.requires.push('name');

  return result;
};

var validate_perform_bulb = function(perform, parameter) {
  var color
    , params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'off') return result;

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
    return result;
  }

  if (perform !== 'on') {
    result.invalid.push('perform');
    return result;
  }

  color = params.color;
  if (!!color) {
    switch (color.model) {
        case 'temperature':
          if (!color.temperature) { result.requires.push('color.temperature'); break; }
          if (!lighting.validTemperature(color.temperature.temperature)) result.invalid.push('color.temperature.temperature');
          break;

        case 'hue':
          if (!color.hue) { result.requires.push('color.hue'); break; }
          if (!lighting.validHue(color.hue.hue)) result.invalid.push('color.hue.hue');
          if (!lighting.validSaturation(color.hue.saturation)) result.invalid.push('color.hue.saturation');
          if (!params.brightness) result.requires.push('brightness');
          break;

        case 'cie1931':
          if (!lighting.validCIE1931(color.cie1931)) result.invalid.push('color.cie1931');
          break;

        case 'rgb':
          if (!lighting.validRGB(color.rgb)) result.invalid.push('color.rgb');
          break;

        default:
          result.invalid.push('color.model');
          break;
    }
  }

  if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) result.invalid.push('brightness');

  return result;
};


var scan = function() {
  var logger2, options;

  logger2 = utility.logger('discovery');

  options = url.parse('https://www.meethue.com/api/nupnp');
  options.agent = false;

  https.request(options, function(response) {
    var content = '';

    var done = function() {
//    [{"id":"001788fffe092100","internalipaddress":"192.168.1.xx","macaddress":"01:23:45:67:89:ab"}]

      var i, info, results, serialNo;

      if (response.statusCode === 302) {
        logger2.warning('nUPnP', { event: 'http', options: options, code: response.statusCode, headers: response.headers });
      } else if (response.statusCode !== 200) {
        logger2.warning('nUPnP', { event: 'http', options: options, code: response.statusCode, content: content });
      }

      try { results = JSON.parse(content); } catch(ex) {
        logger2.error('nUPnP', { event: 'JSON', data: content, diagnostic: ex.message });
        results = [];
      }

      for (i = 0; i < results.length; i++) {
        if (results[i].macaddress === undefined) {
          serialNo = results[i].id;
        } else {
          serialNo = results[i].macaddress.split(':').join('');
        }

        if (serialNo.length === 16) serialNo = serialNo.substr(0, 6) + serialNo.substr(-6);

        info = { source     : 'nupnp'
               , nupnp      : results[i]
               , device     : { url          : 'http://' + results[i].internalipaddress + ':80/'
                              , name         : 'Phillips hue (' + results[i].internalipaddress + ')'
                              , manufacturer : 'Royal Philips Electronics'
                              , model        : { name        : 'Philips hue bridge 2012'
                                               , description : 'Philips hue Personal Wireless Lighting'
                                               , number      : '929000226503'
                                               }
                              , unit         : { serial      : serialNo
                                               , udn         : 'uuid:2f402f80-da50-11e1-9b23-' + serialNo
                                               }
                              }
               , deviceType : steward.actors.device.lighting.hue.$info.type
               };
        info.url = info.device.url;
        info.deviceType = info.device.model.name;
        info.deviceType2 = 'urn:schemas-upnp-org:device:Basic:1';
        info.id = info.device.unit.udn;
        if (!!devices.devices[info.id]) return;

        logger2.debug('nUPnP ' + info.device.name, { url: info.url });
        devices.discover(info);
      }
    };

    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      content += chunk.toString();
    }).on('end', done).on('close', function() {
      if (content.length === 0) return logger2.warning('nUPnP', { event: 'http', diagnostic: 'premature eof' });
      done();
    });
  }).on('error', function(err) {
    logger2.error('nUPnP', { event: 'http', options: options, diagnostic: err.message });
  }).end();
};


// TBD: add on/off for all bulbs
// PUT /api/.../groups/0/action
//   { on : true/false }

// TBD: discovery
// PUT /api/.../lights
// (no body)
// -> [ { success: { "/lights" : " ..." } } ]
//
// GET /api/.../lights/new
// -> { lastscan : "active" }

// TBD: add automatic restoration of bulbs

exports.start = function() {
  steward.actors.device.gateway.hue = steward.actors.device.gateway.hue ||
      { $info     : { type: '/device/gateway/hue' } };

  steward.actors.device.gateway.hue.bridge =
      { $info     : { type       : '/device/gateway/hue/bridge'
                    , observe    : [ ]
                    , perform    : [ 'wake' ]
                    , properties : { name   : true
                                   , status : [ 'ready', 'reset', 'busy' ]
                                   }
                    }
      , $validate : { perform    : validate_perform_hue }
      };
  devices.makers['Philips hue bridge 2012'] = Hue;

  steward.actors.device.lighting.hue = steward.actors.device.lighting.hue ||
      { $info     : { type: '/device/lighting/hue' } };

  steward.actors.device.lighting.hue.bulb =
      { $info     : { type       : '/device/lighting/hue/bulb'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , color      : { model: [ { temperature : { temperature: 'mireds' } }
                                                           , { hue         : { hue: 'degrees', saturation: 'percentage' } }
                                                           , { cie1931     : { x: 'fraction', y: 'fraction' } }
                                                           , { rgb         : { r: 'u8', g: 'u8', b: 'u8' } }
                                                           ]
                                                  }
                                   , brightness : 'percentage'
                                   }
                    }
      , $validate : { perform    : validate_perform_bulb }
      };

  steward.actors.device.lighting.hue.downlight = utility.clone(steward.actors.device.lighting.hue.bulb);
  steward.actors.device.lighting.hue.downlight.$info.type = '/device/lighting/hue/downlight';

  steward.actors.device.lighting.hue.uplight = utility.clone(steward.actors.device.lighting.hue.bulb);
  steward.actors.device.lighting.hue.uplight.$info.type = '/device/lighting/hue/uplight';

  steward.actors.device.lighting.hue.lightstrip = utility.clone(steward.actors.device.lighting.hue.bulb);
  steward.actors.device.lighting.hue.lightstrip.$info.type = '/device/lighting/hue/lightstrip';

  scan();
  setInterval(scan, 5 * 60 * 1000);
};
