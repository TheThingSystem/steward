// http://www.quirky.com/shop/596-Nimbus

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  , places      = require('./../../actors/actor-place')
  ;


var logger = indicator.logger;


var Gauge = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = { display: null };
  self.gateway = info.gateway;
  self.update(self, info.params);

  self.status = 'present';
  self.changed();

  broker.subscribe('beacon-egress', function(category, data) {
    var i;

    if (category !== '.updates') return;

    if (!util.isArray(data)) data = [ data ];
    for (i = 0; i < data.length; i++) if (data[i].whoami === self.info.actor) self.egress(self);
  });

  broker.subscribe('actors', function(request, eventID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, perform, parameter);
  });

  self.getState(function(err, state) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'getState', diagnostic: err.message });
    if (!state) return;

    self.info.actor = state.actor;
    self.info.property = state.property;
    if ((!!self.info.actor) && (!!self.info.property)) self.egress(self);
  });
};
util.inherits(Gauge, indicator.Device);


Gauge.prototype.update = function(self, params) {
  var updateP = false;

  self.params = params;

  if (self.params.name !== self.name) {
    self.name = self.params.name;
    updateP = true;
  }

  if (updateP) self.changed();
};

Gauge.prototype.egress = function(self) {
  var metricP, parts, property, value;

  if (!self.gateway.wink) return;

  if (self.info.property.indexOf('.[') !== -1) {
    value = devices.expand(self.info.property, self.info.actor);
    if (!value) return;
  } else {
    value = devices.expand('.[' + self.info.actor + '.' + self.info.property + '].');
    if (!value) return;

    parts = self.info.property.split('.');
    property = parts[parts.length - 1];
    if (places.place1.info.displayUnits === 'customary') value = places.customary(property, value, true);

    if (!isNaN(value)) {
      metricP = places.place1.info.displayUnits === 'metric';

      value += { accuracy        : metricP ? 'M'    : 'FT'
               , batteryLevel    : '%'
               , co              : 'PPM'
               , co2             : 'PPM'
               , distance        : metricP ? 'KM'   : 'MI'
               , extTemperature  : metricP ? 'C'    : 'F'
               , goalTemperature : metricP ? 'C'    : 'F'
               , humidity        : '%'
               , intTemperature  : metricP ? 'C'    : 'F'
               , light           : 'LX'
               , moisture        : 'MB'
               , no              : 'PPM'
               , no2             : 'PPM'
               , noise           : 'DB'
               , odometer        : metricP ? 'KM'   : 'MI'
               , pressure        : 'MB'
               , rainRate        : metricP ? 'MM/H' : 'IN/H'
               , rainTotal       : metricP ? 'MM'   : 'IN'
               , range           : metricP ? 'KM'   : 'MI'
               , temperature     : metricP ? 'C'    : 'F'
               , velocity        : metricP ? 'MPS'  : 'MPH'
               , visibility      : metricP ? 'KM'   : ' MI'
               , voc             : 'PPM'
               , waterVolume     : '%'
               , windAverage     : metricP ? 'MPS'  : 'MPH'
               , windchill       : metricP ? 'C'    : 'F'
               , windGust        : metricP ? 'MPS'  : 'MPH'
              }[property] || '';
    }
  }

  self.gateway.wink.setDial(self.params, { name                  : 'dial:' + self.deviceID
                                         , label                 : value
                                         , labels                : [ value, '' ]
                                         , position              : 0
                                         , brightness            : 75
                                         , channel_configuration : { channel_id: 10 }
                                         }, function(err, params) {
    var updateP = false;

    if (!!err) {
      if (!self.errorP) logger.error('device/' + self.deviceID, { event: 'setDial', diagnostic: err.message });
      self.errorP = true;
      return;
    }
    delete(self.errorP);

    if (self.info.display != value) {
      self.info.display = value;
      updateP = true;
    }
    if (!!params) updateP = true;

    if (updateP) {
      self.changed();
      self.update(self, params);
    }

  });
};


Gauge.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) {
    if (!self.gateway.wink) return false;

// short-ciruit round-trip time to cloud
    self.name = params.name;
    self.changed();
    self.gateway.wink.setDevice(self.params, { name: params.name }, function(err, params) {
      if (!!err) return logger.error('device/' + self.deviceID, { event: 'setDevice', diagnostic: err.message });

      if (!!params) self.update(self, params);
    });
  }

  if (!!params.actor) self.info.actor = params.actor;
  if (!!params.property) self.info.property = params.property;
  if ((!!params.actor) || (!!params.property)) {
    self.setState({ actor: self.info.actor, property: self.info.property });
    self.egress(self);
  }

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!!params.actor) {
    if ((typeof params.actor !== 'string') || (params.actor.split('/').length !== 2)) result.invalid.push('actor');
  }
  if ((!!params.property) && (typeof params.property !== 'string')) result.invalid.push('property');

  return result;
};



exports.start = function() {
  steward.actors.device.indicator.wink = steward.actors.device.indicator.wink ||
      { $info     : { type: '/device/indicator/wink' } };

  steward.actors.device.indicator.wink.gauge =
      { $info     : { type       : '/device/indicator/wink/gauge'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name     : true
                                   , status   : [ 'present' ]
                                   , actor    : true
                                   , property : true
                                   , display  : true
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/wink/gauge'] = Gauge;
};
