var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('switch');


exports.start = function() {
  steward.actors.device['switch'] = { $info: { type: '/device/switch' }};

  utility.acquire(logger, __dirname + '/devices-switch', /^switch-.*\.js/, 7, -3, ' driver');
};


var Switch = exports.Device = function() {
  var self = this;

  self.whatami = '/device/switch';
};
util.inherits(Switch, devices.Device);


var boundedValue = exports.boundedValue = function(value, lower, upper) {
  return ((isNaN(value) || (value < lower)) ? lower : (upper < value) ? upper : value);
};


exports.percentageValue = function(value, maximum) {
  return Math.floor((boundedValue(value, 0, maximum) * 100) / maximum);
};


exports.scaledPercentage = function(percentage, minimum, maximum) {
  return boundedValue(Math.round((boundedValue(percentage, 0, 100) * maximum) / 100), minimum, maximum);
};


exports.validLevel       = function(lvl) { return ((  0 <= lvl) && (lvl <= 100)); };
