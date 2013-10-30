var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('climate');


exports.start = function() {
  steward.actors.device.climate = { $info: { type: '/device/climate' }};

  utility.acquire(logger, __dirname + '/devices-climate', /^climate-.*\.js$/, 8, -3, ' driver');
};


var Climate = exports.Device = function() {
  var self = this;

  self.whatami = '/device/climate';
};
util.inherits(Climate, devices.Device);
