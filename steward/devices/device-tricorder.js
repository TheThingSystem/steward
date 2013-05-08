var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('sensor');


exports.start = function() {
  steward.actors.device.tricorder = { $info: { type: '/device/tricorder' }};

  utility.acquire(logger, __dirname + '/devices-tricorder', /^tricorder-.*\.js/, 8, -3, ' driver');
};


var Tricorder = exports.Device = function() {
  var self = this;

  self.whatami = '/device/tricorder';
};
util.inherits(Tricorder, devices.Device);
