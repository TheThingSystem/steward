var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('devices');


exports.start = function() {
  steward.actors.device.gateway = { $info: { type: '/device/gateway' }};

  utility.acquire(logger, __dirname + '/devices-gateway', /^gateway-.*\.js$/, 8, -3, ' gateway');
};


var Gateway = exports.Device = function() {
  var self = this;

  self.whatami = '/device/gateway';
};
util.inherits(Gateway, devices.Device);
