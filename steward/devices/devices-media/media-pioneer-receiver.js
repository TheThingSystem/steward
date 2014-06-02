// http://www.pioneerelectronics.com/StaticFiles/PUSA/Files/Home%20Custom%20Install/SC-37-RS232.pdf

var avr         = require('pioneer-avr')
  , underscore  = require('underscore')
  , url         = require('url')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , discovery   = require('./../../discovery/discovery-ssdp')
  , media       = require('./../device-media')
  ;


var logger = media.logger;

var Pioneer_AVR = exports.Device = function(deviceID, deviceUID, info) {
  var o, self;

  self = this;

  self.whatami = '/device/media/pioneer/receiver';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  o = url.parse(info.url);
  o.port = info.upnp.root.device[0]['av:X_ipRemoteTcpPort'][0].$t;
  self.url = url.format(o);
  self.connect(self);
  self.inputs = utility.clone(avr.Inputs);
  self.info = { sources: utility.keys(self.inputs) };

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.avr.on('connect', function() {
    logger.info('device/' + self.deviceID, { event: 'connection established' });
  }).on('end', function() {
    self.error(self, new Error('premature close'), 'connection');
  }).on('error', function(err) {
    self.error(self, err, 'connection');
  }).on('power', function(onoff) {
    var status = onoff ? 'on' : 'off';

    if (self.status === status) return;
    self.status = status;
    self.changed();
  }).on('volume', function(decibels) {
    var volume = devices.scaledLevel(decibels, -80, 12);

    if (self.info.volume === volume) return;
    self.info.volume = volume;
    self.changed();
  }).on('mute', function(mute) {
    var muted = mute ? 'on' : 'off';

    if (self.info.muted === muted) return;
    self.info.muted = muted;
    self.changed();
  }).on('input', function(input) {
    var name, source;

    source = underscore.invert(avr.Inputs)[input];
    if (!source) return logger.info('device/' + self.deviceID, { event: 'input', input: input });

    if (!!self.avr.inputNames[source]) {
      name = self.avr.inputNames[source];

      if (!self.inputs[name]) {
        self.inputs[name] = input;
        self.info.sources = utility.keys(self.inputs);
        source = '';
      }
    }

    if (self.info.source === source) return;
    self.info.source = source;
    self.changed();
  });
};
util.inherits(Pioneer_AVR, media.Device);


Pioneer_AVR.prototype.connect = function(self) {
  var o = url.parse(self.url);

  self.avr = new avr.VSX({ port: o.port, host: o.hostname, logger: logger });
  self.status = 'waiting';
  self.changed();

  delete(self.timer);
};

Pioneer_AVR.prototype.error = function(self, err, event) {
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
  if (self.status !== 'error') {
    self.status = 'error';
    self.changed();
  }

  self.avr = null;
  if (!!self.timer) clearTimeout(self.timer);
  self.timer = setTimeout(self.connect, 60 * 1000);
};


Pioneer_AVR.operations =
{ on        : function(self, taskID, params, validateP) {
                if (!!validateP) return true;
                if (!self.avr) return false;

                self.avr.power(true);
                return steward.performed(taskID);
              }

, off       : function(self, taskID, params, validateP) {
                if (!!validateP) return true;
                if (!self.avr) return false;

                self.avr.power(true);
                return steward.performed(taskID);
              }

, wake      : function(self, taskID, params, validateP) {
                if (!!validateP) return true;

                return devices.perform(self, taskID, 'wake', JSON.stringify(params));
              }
};

Pioneer_AVR.prototype.perform = function(self, taskID, perform, parameter) {
  var input, params;

  try { params = JSON.parse(parameter); } catch(e) { params = {}; }

  if (!!Pioneer_AVR.operations[perform]) return Pioneer_AVR.operations[perform](self, taskID, params, false);

  if (perform !== 'set') return devices.perform (self, taskID, perform, parameter);

  if (!!params.volume) {
         if (params.volume === 'up') self.avr.volumeUp();
    else if (params.volume === 'down') self.avr.volumeDown();
    else if (isNaN(params.volume)) return false;
    else self.avr.volume(devices.scaledPercentage(params.volume, -80, 12));
  }

  if (!!params.muted) self.avr.mute(params.muted === 'on');
  if (!!params.input) {
    input = self.inputs[params.input];
    if (!input) return false;

    self.avr.selectInput(input);
  }
  if (!!params.name) devices.perform (self, taskID, perform, parameter);

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) {
    result.invalid.push('parameter');
    return result;
  }

  if (!!Pioneer_AVR.operations[perform]) return Pioneer_AVR.operations[perform](null, null, params, true);

  if (perform !== 'set') return devices.validate_perform (perform, parameter);
  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }

  if ((!!params.volume) && (params.volume !== 'up') && (params.volume !== 'down') && (!media.validVolume(params.volume))) {
    result.invalid.push('volume');
  }
  if ((!!params.muted) && (params.muted !== 'on') && (params.muted !== 'off')) result.invalid.push('volume');

  return devices.validate_perform (perform, parameter);
};


exports.start = function() {
  steward.actors.device.media.pioneer = steward.actors.device.media.pioneer ||
      { $info     : { type: '/device/media/pioneer' } };

  steward.actors.device.media.pioneer.receiver =
      { $info     : { type       : '/device/media/pioneer/receiver'
                    , observe    : [ ]
                    , perform    : utility.keys(Pioneer_AVR.operations)
                    , properties : { name    : true
                                   , status  : [ 'waiting', 'off', 'on', 'error' ]
                                   , source  : true
                                   , sources : utility.keys(avr.Inputs)
                                   , volume  : 'percentage'
                                   , muted   : [ 'on', 'off' ]
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };

  discovery.upnp_register('/device/media/pioneer/receiver', function(upnp) {
    if ((upnp.root.device[0]['av:X_ipRemoteReady'][0].$t !== 1)
            || (isNaN(upnp.root.device[0]['av:X_ipRemoteTcpPort'][0].$t))) {
      return;
    }

    return '/device/media/pioneer/receiver';
  });
  devices.makers['/device/media/pioneer/receiver'] = Pioneer_AVR;
};
