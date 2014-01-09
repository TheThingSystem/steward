// Wink: http://www.quirky.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , indicator   = require('./../device-indicator')
  ;


var logger = indicator.logger;


var Nimbus = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = { gauges: [] };
  self.gateway = info.gateway;
  self.params = info.params;
  self.update(self);

  self.status = 'present';
  self.changed();

  utility.broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if ((request === 'perform') && (observe === 'set')) return self.perform(self, eventID, observe, parameter);
  });

  setInterval(function() { self.scan(self); }, 60 * 1000);
};
util.inherits(Nimbus, indicator.Device);


Nimbus.prototype.scan = function(self) {
  if (!self.gateway.wink) return;

  self.gateway.wink.getDevice(self.params, function(err, device) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'getDevice', diagnostic: err.message});

    if (!device) return;

    self.params = device;
    self.update(self);
  });
};

Nimbus.prototype.update = function(self) {
  var d, dial, gauge, gauges, info, udn;

  if (self.params.name !== self.name) {
    self.name = self.params.name;
    self.changed();
  }

  gauges = [];
  for (d in self.params.dials) if (self.params.dials.hasOwnProperty(d)) {
    dial = self.params.dials[d];

    udn = 'wink:' + dial.type + ':' + dial.id;
    if (!!devices.devices[udn]) {
      gauge = devices.devices[udn].device;
      gauge.update(gauge, dial);
      gauges.push('device/' + gauge.deviceID);
      continue;
    }

    info = { source: self.deviceID, gateway: self.gateway, params: dial };
    info.device = { url                          : null
                  , name                         : dial.name
                  , manufacturer                 : 'Quirky'
                  , model        : { name        : dial.type
                                   , description : ''
                                   , number      : ''
                                   }
                  , unit         : { serial      : dial.id
                                   , udn         : udn
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = '/device/indicator/wink/gauge';
    info.id = info.device.unit.udn;

    logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  type: info.params.type });
    devices.discover(info);
    self.changed();
  }

  gauges.sort();
  if (!utility.array_cmp(self.info.gauges, gauges)) {
    self.info.gauges = gauges;
    self.changed();
  }
};

Nimbus.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if ((perform !== 'set') || (!params.name)) return false;
  if (!self.gateway.wink) return false;
  self.gateway.wink.setDevice(self.params, { name: params.name }, function(err, params) {
    if (!!err) return self.logger.error('device/' + self.deviceID, { event: 'setDevice', diagnostic: err.message});

    self.params = params;
    self.update(self);
  });

  return steward.performed(taskID);
};


exports.start = function() {
  steward.actors.device.indicator.wink = steward.actors.device.indicator.wink ||
      { $info     : { type: '/device/indicator/wink' } };

  steward.actors.device.indicator.wink.nimbus =
      { $info     : { type       : '/device/indicator/wink/nimbus'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'present' ]
                                   , gauges     : []
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/indicator/wink/nimbus'] = Nimbus;
};
