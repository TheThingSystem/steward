// Chromecast (Eureka Dongle) media player: www.google.com/chromecast

var mdns
  , utility     = require('./../../core/utility')
  ;

try {
  mdns          = require('mdns');
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing video-chromecast media (continuing)', { diagnostic: ex.message });
}

var Dongle      = require('eureka-dongle')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , media       = require('./../device-media')
  ;


var logger = media.logger;


var Chromecast = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/media/chromecast/video';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;

  self.chromecast = new Dongle(info.url);
  self.status = 'idle';
  self.changed();

  self.chromecast.statusInterval = 2000;
  self.chromecast.start();

  self.info = { track : { title: '', position: 0, duration: 0} };

  self.chromecast.on('error', function(err) {
    logger.error('device/' + self.deviceID, {
        event: 'ramp failure'
      , msg: err.message
    });
    self.status = 'error';
    self.changed();
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
        self.chromecast.statusInterval = (newStatus === 'idle') ? (2 * 1000) : 500;

        changed = true;
      }

      self.status = newStatus;
    }

    applyIf('title');
    applyIf('image_url', 'albumArtURI');
    if (status.hasOwnProperty('time_progress') && !status.time_progress) delete(status.current_time);
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

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Chromecast, media.Device);


Chromecast.operations = {
  'stop' : function(self, params) {/* jshint unused: false */
    self.chromecast.stop('YouTube');
  }
, 'play' : function(self, params) {/* jshint unused: false */
    if ((self.status === 'paused') || (self.status === 'idle')) {
      self.chromecast.resume();
      self.status = 'playing';
      self.changed();
    }
    if (params.url) {
      self.chromecast.start('YouTube', params.url);
    }
  }
, pause : function(self, params) {/* jshint unused: false */
    if (self.status !== 'paused') {
      self.chromecast.pause();
      self.status = 'paused';
      self.changed();
    }
  }
};


Chromecast.prototype.perform = function(self, taskID, perform, parameter) {
  var params, position, volume;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!!Chromecast.operations[perform]) {
    Chromecast.operations[perform](self, params);

    return steward.performed(taskID);
  }

  if (perform === 'set') {
    if (!!params.position) {
      position = parseFloat(params.position);
      if (isNaN(position)) {
        position = 0;
      }

      self.chromecast.resume(position/1000);
    }

    if ((!!params.volume) && (media.validVolume(params.volume))) self.chromecast.volume(volume / 100);

    if (!!params.muted) self.chromecast.muted(params.muted === 'on');
  }

  return devices.perform(self, taskID, perform, parameter);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!!Chromecast.operations[perform]) {
    result.invalid.push('perform');
    return result;
  }

  if (perform === 'set') {
    if ((!!params.position) && (!media.validPosition(params.position))) result.invalid.push('position');
    if ((!!params.volume)   && (!media.validVolume(params.volume)))     result.invalid.push('volume');
    if ((!!params.muted)    && (params.muted !== 'on') && (params.muted !== 'off')) result.invalid.push('volume');

    if (result.invalid.length > 0) return result;
  }

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
                                   , 'pause'
                                   ]
                    , properties : { name    : true
                                   , status  : [ 'idle', 'playing', 'paused', 'error' ]
                                   , track   : { title       : true
                                               , albumArtURI : true
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
