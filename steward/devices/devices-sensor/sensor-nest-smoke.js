// Nest - the learning thermostat: http://nest.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , sensor      = require('./../device-sensor')
  ;


// var logger = sensor.logger;


var Protect = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.serial = info.device.unit.serial;

  self.status = self.initInfo(info.params);
  sensor.update(self.deviceID, normalize(info.params));
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
  var updateP = false;

  if ((!!status) && (status !== self.status)) {
    self.status = status;
    updateP = true;
  }
  if (self.updateInfo(params)) updateP = true;

  if (updateP) {
    self.changed();
    sensor.update(self.deviceID, normalize(params));
  }
};

var normalize = function(params) {
  var param;

  params = utility.clone(params);

  for (param in params) {
    if ((params.hasOwnProperty(param)) && (isNaN(params[param]))) params[param] = param === 'detected' ? '5' : '0';
  }

  return params;
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
