// http://www.quirky.com/shop/633-Strip-Power-Genius

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , plug        = require('./../device-switch')
  ;


var logger = plug.logger;


var Strip = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = { plugs: [] };
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
util.inherits(Strip, plug.Device);


Strip.prototype.scan = function(self) {
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

Strip.prototype.update = function(self, params) {
  var o, outlet, plug, plugs, info, status, udn, updateP;

  self.params = params;
  updateP = false;

  if (self.params.name !== self.name) {
    self.name = self.params.name;
    self.changed();
  }

  status = self.params.props.last_reading.connection ? 'present' : 'absent';
  if (status !== self.status) {
    self.status = status;
    updateP = true;
  }

  plugs = [];
  for (o in self.params.outlets) if (self.params.outlets.hasOwnProperty(o)) {
    outlet = self.params.outlets[o];

    udn = 'wink:' + outlet.type + ':' + outlet.id;
    if (!!devices.devices[udn]) {
      plug = devices.devices[udn].device;
      plug.update(plug, outlet);
      plugs.push('device/' + plug.deviceID);
      continue;
    }

    info = { source: self.deviceID, gateway: self.gateway, params: outlet };
    info.device = { url                          : null
                  , name                         : outlet.name
                  , manufacturer                 : 'Quirky'
                  , model        : { name        : outlet.type
                                   , description : ''
                                   , number      : ''
                                   }
                  , unit         : { serial      : outlet.id
                                   , udn         : udn
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = '/device/switch/wink/onoff';
    info.id = info.device.unit.udn;

    logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  type: info.params.type });
    devices.discover(info);
    updateP = true;
  }

  plugs.sort();
  if (!utility.array_cmp(self.info.plugs, plugs)) {
    self.info.plugs = plugs;
    updateP = true;
  }

  if (updateP) self.changed();
};

Strip.prototype.perform = function(self, taskID, perform, parameter) {
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
  steward.actors.device['switch'].wink = steward.actors.device['switch'].wink ||
      { $info     : { type: '/device/switch/wink' } };

  steward.actors.device['switch'].wink.strip =
      { $info     : { type       : '/device/switch/wink/strip'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'present', 'absent' ]
                                   , plugs      : []
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/switch/wink/strip'] = Strip;
};
