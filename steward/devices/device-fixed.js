var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('fixed');


exports.start = function() {
  steward.actors.device.fixed = { $info: { type: '/device/fixed' }};

  utility.acquire(logger, __dirname + '/devices-fixed', /^fixed-.*\.js/, 6, -3, ' driver');
};


var Fixed = exports.Device = function() {
  var self = this;

  self.whatami = '/device/fixed';
};
util.inherits(Fixed, devices.Device);
