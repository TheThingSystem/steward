// Dongle media player: http://www.chromecast.com/developer

var Dongle      = require('eureka-dongle')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , media       = require('./../device-media')
  , discovery   = require('./../../discovery/discovery-ssdp')
  ;


// var logger = media.logger;


var Chromecast = exports.Device = function(deviceID, deviceUID, info) {
  var self;
  self = this;

  self.whatami = '/device/media/chromecast/video';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.sid = null;
  self.seq = 0;

  self.chromecast = new Dongle(info.url);
  self.status = 'idle';
  self.changed();
  self.refreshID = null;
};
util.inherits(Chromecast, media.Device);


Chromecast.operations = {
  'stop' : function(device, params) {/* jshint unused: false */
    device.stop()
  }
, 'play' : function(device, params) {/* jshint unused: false */
    if (params.url) {
      device.launch(params.url);
    }
  }
};


Chromecast.prototype.perform = function(self, taskID, perform, parameter) {
  var params;
  try { params = JSON.parse(parameter); } catch(e) {}

  if (!!Chromecast.operations[perform]) {
    Chromecast.operations[perform](this.chromecast, params);
    return steward.performed(taskID);
  }

  return devices.perform(self, taskID, perform, parameter);
};

var validate_perform = function(perform, parameter) {

  var params, result = { invalid: [], requires: [] };

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'play' && !params.url) {
    result.requires.push('url');
  }

  if (!!Chromecast.operations[perform]) return result;

  return devices.validate_perform(perform, parameter);
};


exports.start = function() {
  steward.actors.device.media.chromecast = steward.actors.device.media.chromecast ||
      { $info     : { type: '/device/media/chromecast' } };

  steward.actors.device.media.chromecast.video =
      { $info     : { type       : '/device/media/chromecast/video'
                    , observe    : [ ]
                    , perform    : [
                                     'play'
                                   , 'stop'
                                   ]
                    , properties : { name    : true
                                   , status  : [ 'idle' ]
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['Eureka Dongle'] = Chromecast;
};
