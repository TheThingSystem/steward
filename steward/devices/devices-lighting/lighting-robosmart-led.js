// RoboSmart Lightbulb: http://www.smarthome-labs.com

var robosmart
  , utility     = require('./../../core/utility')
  ;

try {
  robosmart     = require('robosmart');
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing robosmart-led lighting (continuing)', { diagnostic: ex.message });
}

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , lighting    = require('./../device-lighting')
  ;


var logger = lighting.logger;


var RoboSmart = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();
  self.peripheral = info.peripheral;
  self.info = { color : { model: 'rgb', rgb: { r: 255, g: 255, b: 255 }, fixed: true }
              , rssi  : self.peripheral.rssi
              };

  self.peripheral.on('disconnect', function() {
    logger.info('device/' + self.deviceID, { status: self.status });
// TBD: handle connection timeout...

    self.robosmart = null;
    setTimeout(function() { self.status = 'waiting'; self.changed(); self.connect(self); }, 1 * 1000);
  }).on('rssiUpdate', function(rssi) {
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


RoboSmart.prototype.connect = function(self) {
  self.peripheral.connect(function(err) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'connect', diagnostic: err.message });

    var bulb = new robosmart(self.peripheral);

    bulb.discoverServicesAndCharacteristics(function(err) {
      if (err) return logger.error('device/' + self.deviceID,
                                   { event: 'discoverServicesAndCharacteristics', diagnostic: err.message });

      self.robosmart = bulb;
      self.refresh(self);
    });
  });
};

RoboSmart.prototype.heartbeat = function(self) {
  if (self.status !== 'waiting') self.refresh(self); else self.connect(self);
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

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  refresh = function() { setTimeout (function() { self.refresh(self); }, 0); };

  if (perform === 'set') {
    if (!params.name) return false;

    self.robosmart.setLightName(params.name, refresh);

    return steward.performed(taskID);
  }

  state = {};
  if (perform === 'off') state.on = false;
  else if (perform !== 'on') return false;
  else {
    state.on = true;

    if (!params.brightness) params.brightness = self.info.brightness;
    if ((!lighting.validBrightness(params.brightness)) || (params.brightness === 0)) params.brightness = 100;
    state.brightness = roboSmartBrightness(params.brightness);
  }

  logger.info('device/' + self.deviceID, { perform: state });

  if (!state.on) self.robosmart.switchOff(refresh);
  else
    self.robosmart.switchOn(function() {
      if (!!state.brightness) self.robosmart.setDim(roboSmartBrightness(state.brightness), refresh); else refresh();
    });

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
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

  if ((!!params.brightness) && (!lighting.validBrightness(params.brightness))) result.invalid.push('brightness');

  return result;
};


exports.start = function() {
  steward.actors.device.lighting.robosmart = steward.actors.device.lighting.robosmart ||
      { $info     : { type: '/device/lighting/robosmart' } };

  steward.actors.device.lighting.robosmart.bulb =
      { $info     : { type       : '/device/lighting/robosmart/bulb'
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
  devices.makers['/device/lighting/robosmart/bulb'] = RoboSmart;

  require('./../../discovery/discovery-ble').register('/device/lighting/robosmart/bulb', null, [ 'ff10', 'ff20' ]);
};
