// Nest - the learning thermostat: http://nest.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , sensor      = require('./../device-sensor')
  ;


// var logger = sensor.logger;


var Protect = exports.Device = function(deviceID, deviceUID, info) {
  var param, self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.serial = info.device.unit.serial;

  self.info = {};
  if (!!info.params.status) {
    self.status = info.params.status;
    delete(info.params.status);
  } else self.status = 'absent';
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  sensor.update(self.deviceID, info.params);

  self.changed();
  self.gateway = info.gateway;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Protect, sensor.Device);
Protect.prototype.perform = devices.perform;


Protect.prototype.update = function(self, params, status) {
  var param, updateP;

  updateP = false;
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }
  if (updateP) {
    self.changed();
    sensor.update(self.deviceID, params);
  }
};


exports.start = function() {
  steward.actors.device.sensor.nest = steward.actors.device.sensor.nest ||
      { $info     : { type: '/device/sensor/nest' } };

  steward.actors.device.sensor.nest.smoke =
      { $info     : { type       : '/device/sensor/nest/smoke'
                    , observe    : [ ]
                    , perform    : [ 'wake' ]
                    , properties : { name            : true
                                   , status          : [ 'safe', 'unsafe', 'absent' ]
                                   , lastSample      : 'timestamp'
                                   , smoke           : [ 'detected', 'absent' ]
                                   , coStatus        : [ 'detected', 'absent' ]
//                                 , batteryLevel    : 'percentage'
                                   }
                    }
        , $validate : { perform    : devices.validate_perform }
      };
  devices.makers['/device/sensor/nest/smoke'] = Protect;
};
