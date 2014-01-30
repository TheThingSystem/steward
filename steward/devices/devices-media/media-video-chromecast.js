// Chromecast (Eureka Dongle) media player: www.google.com/chromecast

var Dongle      = require('eureka-dongle')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , media       = require('./../device-media')
  , utility     = require('./../../core/utility')
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
    logger.error('device/' + self.deviceID, { event: 'ramp failure', msg: err.message });
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


Chromecast.operations =
{ stop  : function(self, params) {/* jshint unused: false */
            self.chromecast.stop('YouTube');
          }

, play  : function(self, params) {/* jshint unused: false */
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


, set   : function(self, params) {
            devices.attempt_perform('name', params, function(value) {
              self.setName(value);
            });

            devices.attempt_perform('position', params, function(value) {
              value = parseFloat(value);
              if (media.validPosition(value)) self.chromecast.resume( value / 1000);
            });

            devices.attempt_perform('volume', params, function(value) {
              if (media.validVolume(value)) self.chromecast.volume(value);
            });

            devices.attempt_perform('muted', params, function(value) {
              self.chromecast.muted(value === 'on');
            });
          }
};


Chromecast.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!Chromecast.operations[perform]) return devices.perform(self, taskID, perform, parameter);

  Chromecast.operations[perform](self, params);
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!Chromecast.operations[perform]) return devices.validate_perform(perform, parameter);

  devices.validate_param('name',     params, result, false,               {                 });
  devices.validate_param('position', params, result, media.validPosition, {                 });
  devices.validate_param('volume',   params, result, media.validVolume,   {                 });
  devices.validate_param('muted',    params, result, false,               { off:  1, on:  1 });

  return result;
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
                                   , 'wake'
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
