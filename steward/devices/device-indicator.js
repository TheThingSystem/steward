var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('indicator');


exports.start = function() {
  steward.actors.device.indicator = { $info: { type: '/device/indicator' }};

  utility.acquire(logger, __dirname + '/devices-indicator', /^indicator-.*\.js/, 10, -3, ' driver');
};


var Indicator = exports.Device = function() {
  var self = this;

  self.whatami = '/device/indicator';
};
util.inherits(Indicator, devices.Device);
