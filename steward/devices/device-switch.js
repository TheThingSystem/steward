var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('switch');


exports.start = function() {
  steward.actors.device['switch'] = { $info: { type: '/device/switch' }};

  utility.acquire(logger, __dirname + '/devices-switch', /^switch-.*\.js$/, 7, -3, ' driver');
};


var Switch = exports.Device = function() {
  var self = this;

  self.whatami = '/device/switch';
};
util.inherits(Switch, devices.Device);


exports.validLevel       = function(lvl) { return ((  0 <= lvl) && (lvl <= 100)); };
