// Chromecast (Eureka Dongle) media player: www.google.com/chromecast

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

  self.chromecast = new Dongle(info.url);
  self.status = 'idle';
  self.changed();
  self.refreshID = null;

  self.chromecast.start();

  self.info = {
    track : {
    }
  };

  self.chromecast.on('status', function(data) {
    data = data[1];
    var status = data.status || {};
    var changed = false;
    var applyIf = function(k, k2, fi) {
      if (!k2) {
        k2 = k;
      }

      if (typeof status[k] !== undefined && status[k] !== self.info.track[k2]) {
        if ((fi && fi(status[k])) || !fi) {
          self.info.track[k2] = status[k];
          changed = true;
        }
      }
    };

    if (status.state) {
      var newStatus = 'idle';
      if (status.state === 2) {
        newStatus = 'playing';
      }

      if (newStatus !== self.status) {
        changed = true;
      }

      self.status = newStatus;
    }

    applyIf('title');
    applyIf('current_time', 'position', function(v) {
      return (v * 1000) !== self.info.track.position;
    });
    applyIf('duration', 'duration', function(v) {
      return (v * 1000) !== self.info.track.duration;
    });
    applyIf('muted');
    applyIf('volume');

    if (changed) {
      self.changed();
    }
  });

};
util.inherits(Chromecast, media.Device);


Chromecast.operations = {
  'stop' : function(device, params) {/* jshint unused: false */
    device.stop('YouTube');
  }
, 'play' : function(device, params) {/* jshint unused: false */
    if (params.url) {
      device.start('YouTube', params.url);
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
                                   , status  : [ 'idle', 'playing' ]
                                   , track   : { title       : true
                                               , position    : 'milliseconds'
                                               , duration    : 'milliseconds'
                                               }
                                   , volume  : 'percentage'
                                   , muted   : [ 'on', 'off' ]
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['Eureka Dongle'] = Chromecast;
};
