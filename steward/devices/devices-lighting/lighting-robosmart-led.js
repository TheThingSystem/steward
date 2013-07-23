// RoboSmart Lightbulb: http://www.smarthome-labs.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var RoboSmart = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.status = 'waiting';
  self.changed();
  self.peripheral = info.peripheral;
  self.ble = info.ble;
  self.info = { color: { model: 'rgb', rgb: { r: 255, g: 255, b: 255 }, fixed: true } };

  self.peripheral.on('connect', function() {
    self.peripheral.updateRssi();
  });

  self.peripheral.on('disconnect', function() {
    logger.info('device/' + self.deviceID, { status: self.status });
// TBD: handle connection timeout...
    setTimeout(function() { self.status = 'waiting'; self.changed(); self.peripheral.connect(); }, 1 * 1000);
  });
  self.peripheral.on('rssiUpdate', function(rssi) {
    self.info.rssi = rssi;
    self.refresh(self);
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.refresh(self);
  setInterval(function() { self.heartbeat(self); }, 30 * 1000);
};
util.inherits(RoboSmart, lighting.Device);


RoboSmart.prototype.heartbeat = function(self) {
  if (self.status !== 'waiting') self.refresh(self); else self.peripheral.connect();
};

RoboSmart.prototype.refresh = function(self) {
  var c;

  if (!self.ble.ff10) return;
  c = self.ble.ff10.characteristics;

  if (!!c.ff17) {
    if (!c.ff17.endpoint) {
      logger.error('device/' + self.deviceID, { event: 'refresh', diagnostic: 'no endpoint for ff10.ff17' });
      return;
    }

    c.ff17.endpoint.on('read', function(data, isNotification) {/* jshint unused: false */
      var name;

      if (data === undefined) return;
      self.name = self.nv(data);
    });
    c.ff17.endpoint.read();
  }

  if (!!c.ff11) {
    if (!c.ff11.endpoint) {
      logger.error('device/' + self.deviceID, { event: 'refresh', diagnostic: 'no endpoint for ff10.ff11' });
      return;
    }

    c.ff11.endpoint.on('read', function(data, isNotification) {/* jshint unused: false */
      var onoff;

      if (data === undefined) return;
      onoff = (data[0] & 0xff) ? 'on' : 'off';
      if (self.status !== onoff) { self.status = onoff; self.changed(); }

      if (self.status !== 'on') return;

      if (!c.ff12) return;
      if (!c.ff12.endpoint) {
        logger.error('device/' + self.deviceID, { event: 'refresh', diagnostic: 'no endpoint for ff10.ff12' });
        return;
      }

      c.ff12.endpoint.on('read', function(data, isNotification) {/* jshint unused: false */
        var bri;

        if (data === undefined) return;
        bri = data[0] & 0xff;
        if (self.info.brightness !== bri) { self.info.brightness = bri; self.changed(); }
      });
      c.ff12.endpoint.read();
    });
    c.ff11.endpoint.read();
  }
};


var roboSmartBrightness = function(pct) { return devices.scaledPercentage(pct, 1,  255); };

RoboSmart.prototype.perform = function(self, taskID, perform, parameter) {
  var c, params, state;

  if (!self.ble.ff10) return false;

  state = {};
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if ((!c.ff17) || (!params.name)) return false;

    c.ff17.endpoint.write(new Buffer(params.name));
    return true;
  }

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    if (!!params.brightness) state.bri = roboSmartBrightness(params.brightness);
  }

  logger.info('device/' + self.deviceID, { perform: state });

  c = self.ble.ff10.characteristics;
  if (!c.ff11) return false;
  try {
    c.ff11.endpoint.write(new Buffer(state.on ? 0x01 : 0x00));

    if ((!!state.bri) && (!!c.ff12)) c.ff12.endpoint.write(new Buffer(state.bri));

    setTimeout (function() { self.refresh(self); }, 1 * 1000);
    steward.performed(taskID);
  } catch(ex) { logger.error('device/' + self.deviceID, { event: 'perform', diagnostic: ex.message }); }

  return true;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  if (perform === 'off') return result;

  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }
  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
    return result;
  }

  if (perform !== 'on') result.invalid.push('perform');

  if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) result.invalid.push('brightness');

  return result;
};


exports.start = function() {
  steward.actors.device.lighting.robosmart = steward.actors.device.lighting.robosmart ||
      { $info     : { type: '/device/lighting/robosmart' } };

  steward.actors.device.lighting.robosmart.led =
      { $info     : { type       : '/device/lighting/robosmart/led'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'on', 'off' ]
                                   , brightness : 'percentage'
                                   , rssi       : 's8'
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/lighting/robosmart/led'] = RoboSmart;

  require('./../../discovery/discovery-ble').register(
    { 'Smart Home Labs, Inc.' : { '2a24' : { '900-0100-01'            : { name : 'RoboSmart'
                                                                        , type : '/device/lighting/robosmart/led'
                                                                        }
                                           }
                                }
    });
};
