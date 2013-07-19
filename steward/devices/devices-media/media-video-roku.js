// Roku media player: http://www.roku.com/developer

var Roku        = require('roku')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , discovery   = require('./../../discovery/discovery-ssdp')
  , media       = require('./../device-media')
  ;


var logger = media.logger;

var Roku_Video = exports.Device = function(deviceID, deviceUID, info) {
  var o, self;
  self = this;

  self.whatami = '/device/media/roku/video';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.sid = null;
  self.seq = 0;

  self.roku = new Roku(info.url);
  self.status = 'idle';
  self.changed();
  self.refreshID = null;

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


Roku_Video.prototype.operations = {
  'back' : function(device, params) {
    device.roku.press(Roku.BACK);
    device.roku.delay(500);
  }
, 'home' : function(device, params) {
    device.roku.press(Roku.HOME);
    device.roku.delay(1500);
  }
, 'up' : function(device, params) {
    device.roku.press(Roku.UP);
  }
, 'left' : function(device, params) {
    device.roku.press(Roku.LEFT);
  }
, 'right' : function(device, params) {
    device.roku.press(Roku.RIGHT);
  }
, 'down' : function(device, params) {
    device.roku.press(Roku.DOWN);
  }
, 'replay' : function(device, params) {
    device.roku.press(Roku.INSTANTREPLAY);
  }
, 'info' : function(device, params) {
    device.roku.press(Roku.INFO);
  }
, 'select' : function(device, params) {
    device.roku.press(Roku.SELECT);
  }
, 'rewind' : function(device, params) {
    device.roku.press(Roku.REV);
  }
, 'play-pause' : function(device, params) {
    device.roku.press(Roku.PLAY);
  }
, 'forward' : function(device, params) {
    device.roku.press(Roku.FWD);
  }
, 'type' : function(device, params) {
    device.roku.type(params.string);
  }
, 'launch' : function(device, params) {
    device.roku.launch(params.application);
  }
};


Roku_Video.prototype.perform = function(self, taskID, perform, parameter) {
  var params;
  try { params = JSON.parse(parameter); } catch(e) {}


  if (self.ops[perform]) {
    self.operations[perform](self, params);
    return steward.performed(taskID);
  }
  return false;
};

Roku_Video.prototype.notify = function() {
  this.changed();
}

exports.start = function() {
  steward.actors.device.media.roku = steward.actors.device.media.roku ||
      { $info     : { type: '/device/media/roku/video' } };

  steward.actors.device.media.roku.video =
      { $info     : { type       : '/device/media/roku/video'
                    , observe    : [ ]
                    , perform    : [ 'back'
                                   , 'home'
                                   , 'up'
                                   , 'left'
                                   , 'right'
                                   , 'down'
                                   , 'replay'
                                   , 'info'
                                   , 'select'
                                   , 'rewind'
                                   , 'play-pause'
                                   , 'forward'
                                   // application actions
                                   , 'type'
                                   , 'launch'
                                   ]
                    , properties : { name    : true
                                   }
                    }
      };
  devices.makers['urn:roku-com:device:player:1-0'] = Roku_Video;
};
