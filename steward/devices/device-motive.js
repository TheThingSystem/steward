var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('motive');


exports.start = function() {
  steward.actors.device.motive = { $info: { type: '/device/motive' }};

  utility.acquire(logger, __dirname + '/devices-motive', /^motive-.*\.js/, 7, -3, ' driver');
};


var Motive = exports.Device = function() {
  var self = this;

  self.whatami = '/device/motive';
};
util.inherits(Motive, devices.Device);
