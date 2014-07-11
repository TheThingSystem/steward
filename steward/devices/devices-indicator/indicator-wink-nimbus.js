// http://www.quirky.com/shop/596-Nimbus

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
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
  self.status = 'absent';
  self.update(self, info.params);

  self.changed();

  broker.subscribe('actors', function(request, eventID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, perform, parameter);
  });

  setInterval(function() { self.scan(self); }, 60 * 1000);
};
util.inherits(Nimbus, indicator.Device);


Nimbus.prototype.scan = function(self) {
  if (!self.gateway.wink) return;

  self.gateway.wink.getDevice(self.params, function(err, params) {
    if (!!err) {
      if (!self.errorP) logger.error('device/' + self.deviceID, { event: 'getDevice', diagnostic: err.message });
      self.errorP = true;
      return;
    }
    delete(self.errorP);

    if (!!params) self.update(self, params);
  });
};

Nimbus.prototype.update = function(self, params) {
  var d, dial, gauge, gauges, info, status, udn, updateP;

  self.params = params;
  updateP = false;

  if (self.params.name !== self.name) {
    self.name = self.params.name;
    updateP = true;
  }

  status = self.params.props.last_reading.connection ? 'present' : 'absent';
  if (status !== self.status) {
    self.status = status;
    updateP = true;
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
    updateP = true;
  }

  gauges.sort();
  if (!utility.array_cmp(self.info.gauges, gauges)) {
    self.info.gauges = gauges;
    updateP = true;
  }

  if (updateP) self.changed();
};

Nimbus.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if ((perform !== 'set') || (!params.name)) return false;
  if (!self.gateway.wink) return false;

// short-ciruit round-trip time to cloud
  self.name = params.name;
  self.changed();
  self.gateway.wink.setDevice(self.params, { name: params.name }, function(err, params) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'setDevice', diagnostic: err.message });

    if (!!params) self.update(self, params);
  });

  return steward.performed(taskID);
};


exports.start = function() {
  steward.actors.device.indicator.wink = steward.actors.device.indicator.wink ||
      { $info     : { type: '/device/indicator/wink' } };

  steward.actors.device.indicator.wink.gauges =
      { $info     : { type       : '/device/indicator/wink/gauges'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'present', 'absent' ]
                                   , gauges     : []
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/indicator/wink/gauges'] = Nimbus;
};
