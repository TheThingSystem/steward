// Chromecast (Eureka Dongle) media player: www.google.com/chromecast

var Dongle      = require('eureka-dongle')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , media       = require('./../device-media')
  ;


var logger = media.logger;


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

  self.chromecast.statusInterval = 2000;
  self.chromecast.start();

  self.info = { track : {} };

  self.chromecast.on('error', function(err) {
    logger.error('device/' + self.deviceID, {
        event: 'ramp failure'
      , msg: err.message
    });
  });

  self.chromecast.on('status', function(data) {
    data = data[1];
    var status = data.status || {};
    var changed = false;
    var applyIf = function(k, k2, fi, topP) {
      var v0, v1;

      if (!k2) k2 = k;

      v0 = !topP ? self.info.track[k2] : self.info[k2];
      v1 = (!!fi) ? fi(status[k]) : status[k];
      if (v0 !== v1) {
        if (!topP) self.info.track[k2] = v1; else self.info[k2] = v1;
        changed = true;
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
      return (v * 1000).toFixed(0);
    });
    applyIf('duration', 'duration', function(v) {
      return (v * 1000).toFixed(0);
    });
    applyIf('muted', 'muted', function(v) {
      return (v ? 'on' : 'off');
    }, true);
    applyIf('volume', 'volume', function(v) {
      return v.toFixed(0);
    }, true);

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
                    , perform    : [ 'play'
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
