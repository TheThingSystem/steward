// Roku media player: http://www.roku.com/developer

var Roku        = require('roku')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , media       = require('./../device-media')
  , utility     = require('./../../core/utility')
  ;


// var logger = media.logger;


var Roku_Video = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/media/roku/video';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;

  self.roku = new Roku(info.url);
  self.status = 'idle';
  self.changed();

  self.info = { };

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  // TODO: it would be nice if roku supported querying or any sort of
  //       feedback.  The rest api right now is mostly input based,
  //       except for things that are somewhat useless for our use case:
  //       * app list
  //       * app icons
  //
  //  Support is horrible, but I've attempted to get some help by using the
  //  developer forum (http://forums.roku.com/viewtopic.php?f=34&t=60159&p=397673#p397673)
  //  with no luck to date.
};
util.inherits(Roku_Video, media.Device);


Roku_Video.operations =
{ stop     : function(device, params) {/* jshint unused: false */
              device.press(Roku.BACK);
              device.delay(500);
             }

, play     : function(device, params) {/* jshint unused: false */
               if (params && params.url) {
                 device.launch(params.url);
               } else {
                 device.press(Roku.PLAY);
               }
             }

, pause    : function(device, params) {/* jshint unused: false */
               device.press(Roku.PLAY);
             }

, previous : function(device, params) {/* jshint unused: false */
               device.press(Roku.REV);
             }

, next     : function(device, params) {/* jshint unused: false */
               device.press(Roku.FWD);
             }

};


Roku_Video.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!Roku_Video.operations[perform]) return devices.perform(self, taskID, perform, parameter);

  Roku_Video.operations[perform](this.roku, params);
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!Roku_Video.operations[perform]) return devices.validate_perform(perform, parameter);

  return result;
};


exports.start = function() {
  steward.actors.device.media.roku = steward.actors.device.media.roku ||
      { $info     : { type: '/device/media/roku' } };

  steward.actors.device.media.roku.video =
      { $info     : { type       : '/device/media/roku/video'
                    , observe    : [ ]
                    , perform    : [ 'play'
                                   , 'stop'
                                   , 'pause'
                                   , 'next'
                                   , 'previous'
                                   , 'wake'
                                   ]
                    , properties : { name    : true
                                   , status  : [ 'idle' ]
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['urn:roku-com:device:player:1-0'] = Roku_Video;
};
