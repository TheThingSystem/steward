// RoboSmart Lightbulb: http://www.smarthome-labs.com

var util        = require('util')
  , robosmart   = require('robosmart')
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
  self.info = { color : { model: 'rgb', rgb: { r: 255, g: 255, b: 255 }, fixed: true }
              , rssi  : self.peripheral.rssi
              };

  self.peripheral.connect(function(err) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'connect', diagnostic: err.message });

    self.robosmart = new robosmart(self.peripheral);
    self.refresh(self);
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
  if (!self.robosmart) return;

  self.robosmart.getLightName(function(lightName) {
    if (self.name !== lightName) {
      self.name = lightName;
      self.changed();
    }
  });

  self.robosmart.isOn(function(on) {
    var onoff = on ? 'on' : 'off';

    if (self.status !== onoff) {
      self.status = onoff;
      self.changed();
    }

    if (self.status !== 'on') return;

    self.robosmart.getDim(function(dim) {
      var bri = devices.percentageValue(dim & 0xff, 255);

      if (self.info.brightness !== bri) {
        self.info.brightness = bri;
        self.changed();
      }
    });
  });
};


var roboSmartBrightness = function(pct) { return devices.scaledPercentage(pct, 1,  255); };

RoboSmart.prototype.perform = function(self, taskID, perform, parameter) {
  var params, refresh, state;

  if (!self.robosmart) return false;

  state = {};
  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  refresh = function() { setTimeout (function() { self.refresh(self); }, 0); };

  if (perform === 'set') {
    if (!params.name) return false;

    self.robosmart.setLightName(params.name, refresh);

    return steward.performed(taskID);
  }

  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    if (!!params.brightness) state.bri = roboSmartBrightness(params.brightness);
  }

  logger.info('device/' + self.deviceID, { perform: state });

  if (!state.on) self.robosmart.switchOff(refresh);
  else
    self.robosmart.switchOn(function() {
      if (!!state.bri) self.robosmart.setDim(roboSmartBrightness(state.bri), refresh); else refresh();
    });

  return steward.performed(taskID);
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

  require('./../../discovery/discovery-ble').register('/device/lighting/robosmart/led', null, [ 'ff10', 'ff20' ]);
};
