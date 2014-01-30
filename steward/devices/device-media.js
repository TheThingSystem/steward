var util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('media');


exports.start = function() {
  steward.actors.device.media = { $info: { type: '/device/media' }};

  utility.acquire(logger, __dirname + '/devices-media', /^media-.*\.js$/, 6, -3, ' driver');
};


var Media = exports.Device = function() {
  var self = this;

  self.whatami = '/device/media';
};
util.inherits(Media, devices.Device);


exports.validPosition = function(pos)  { return ((!isNaN(pos)) && (  0 <= pos)                ); };
exports.validVolume   = function(vol)  { return ((!isNaN(vol)) && (  0 <= vol) && (vol <= 100)); };
