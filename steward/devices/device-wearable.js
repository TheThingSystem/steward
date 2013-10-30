var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('wearable');


exports.start = function() {
  steward.actors.device.wearable = { $info: { type: '/device/wearable' }};

  utility.acquire(logger, __dirname + '/devices-wearable', /^wearable-.*\.js$/, 9, -3, ' driver');
};


var Wearable = exports.Device = function() {
  var self = this;

  self.whatami = '/device/wearable';
};
util.inherits(Wearable, devices.Device);
