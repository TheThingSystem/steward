var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('presence');


exports.start = function() {
  steward.actors.device.presence = { $info: { type: '/device/presence' }};

  utility.acquire(logger, __dirname + '/devices-presence', /^presence-.*\.js/, 9, -3, ' driver');
};


var Presence = exports.Device = function() {
  var self = this;

  self.whatami = '/device/presence';
};
util.inherits(Presence, devices.Device);
