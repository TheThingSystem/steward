// Tesla Motors, Inc. - Model S - Electric Vehicle (for the WIN)

var tesla       = require('teslams')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , motive      = require('./../device-motive')
  ;


var logger   = motive.logger;


var ModelS = exports.device = function(deviceID, deviceUID, info) {
  var self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.vehicle = info.vehicle;
  self.vehicle.lastSample = { timestamp: 0 };
  self.vehicle.streamingP = false;
  self.vehicle.updatingP = false;

  self.info = { locations: [] };

  self.status = null;
  self.newstate(self);
  self.gateway = info.gateway;

  self.last6 = [];

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'attention') {
      if (self.status === 'reset') self.alert('please enable remote access from vehicle console');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.refresh(self);
};
util.inherits(ModelS, motive.Device);


ModelS.prototype.checkAPI = function(self, call, retry) {
  var diff, now;

  now = new Date().getTime();

  if (self.last6.length < 6) {
    self.last6.push({ call: call, timestamp: now });
    return true;
  }

  diff = self.last6[0].timestamp - (now - 60 * 1000);
  if (diff >= 0) {
    logger.info('device/' + self.deviceID, { event: 'self.checkAPI', call: call, early: (diff / 1000).toFixed(2) });
    if (!!retry) {
      if (!!self.timer) { clearTimeout(self.timer); self.timer = null; }
      self.timer = setTimeout(retry, diff + 1);
    }

    return false;
  }

  self.last6.splice(0, 1);
  self.last6.push({ call: call, timestamp: now });
  return true;
};

ModelS.prototype.newstate = function(self, enabled) {
  var status = (self.vehicle.state !== 'online') ? self.vehicle.state : (enabled ? 'ready' : 'reset');

  if ((self.status === null) || (status === 'asleep')) status = 'waiting';
  if (self.status == status) return;
  self.status = status;
  self.changed();
};

ModelS.prototype.refresh = function(self) {
  if (!!self.timer) { clearTimeout(self.timer); self.timer = null; }

  if ((self.vehicle.state !== 'waiting') && (self.vehicle.tokens.length !== 0)) {
    return setTimeout(function() { self.scan(self); }, 60 * 1000);
  }

  if (!self.checkAPI(self, 'tesla.wake_up', function() { self.refresh(self); })) return;
  tesla.wake_up(self.vehicle.id, function(data) {
    if (utility.toType(data) === 'error') {
      if ((data.message.indexOf('503:') !== 0) && (data.message.indexOf('408:') !== 0)) {
        logger.error('device/' + self.deviceID, { event: 'wake_up', diagnostic: data.message });
      }
      return self.scan(self);
    }

    if (!self.checkAPI(self, 'tesla.all', function() { self.refresh(self); })) return;
    tesla.all({ email: self.gateway.info.email, password: self.gateway.info.passphrase }, function(error, response, body) {
      var data, i, lastSample, streamingP;

      try {
        if (!!error) throw error;
        if (response.statusCode !== 200) throw new Error('response statusCode ' + response.statusCode);
        data = JSON.parse(body);
        if (!util.isArray(data)) throw new Error('expecting an array from Tesla Motors cloud service');

        for (i = 0; i < data.length; i++) if (data[i].id === self.vehicle.id) {
          lastSample = self.vehicle.lastSample;
          streamingP = self.vehicle.streamingP;
          self.vehicle = data[i];
          self.vehicle.lastSample = lastSample;
          self.vehicle.streamingP = streamingP;
          self.vehicle.updatingP = true;
          break;
        }
        if (i >= data.length) throw new Error('unable to find vehicle.id ' + self.vehicle.id);
      } catch(ex) { logger.error('device/' + self.deviceID, { event: 'wake_up', diagnostic: ex.message }); }

      self.scan(self);
    });
  });
};

ModelS.prototype.scan = function(self) {
// NB: i doubt the clearTimeout() is needed...
  if (!!self.timer) clearTimeout(self.timer);
  self.timer = setTimeout(function() { self.refresh(self); }, (self.vehicle.updatingP ? 5 : 300 ) * 1000);

  if (!self.checkAPI(self, 'tesla.mobile_enabled', function() { self.scan(self); })) return;
  tesla.mobile_enabled(self.vehicle.id, function(data) {
    if (utility.toType(data) === 'error') {
      if (data.message.indexOf('429:') === 0) {
        self.updatingP = false;
        if (!!self.timer) clearTimeout(self.timer);
        self.timer = setTimeout(function() { self.refresh(self); }, 600 * 1000);
      }
      if ((data.message.indexOf('503:') === 0) || (data.message.indexOf('408:') === 0)) return;
      return logger.error('device/' + self.deviceID, { event: 'mobile_enabled', diagnostic: data.message });
    }

    self.newstate(self, data.result);
    if (!data.result) return;

    self.stream(self, false);

    if (!self.checkAPI(self, 'tesla.get_vehicle_state')) return;
    tesla.get_vehicle_state(self.vehicle.id, function(data) {
      var didP, doors, sunroof;

      if (utility.toType(data) === 'error') {
        if ((data.message.indexOf('503:') === 0) || (data.message.indexOf('408:') === 0)) return;
        return logger.error('device/' + self.deviceID, { event: 'get_vehicle_state', diagnostic: data.message });
      }

      didP = false;

      sunroof = (!data.sun_roof_installed)            ? 'none'
                : (data.sun_roof_state !== 'unknown') ? data.sun_roof_state
                : (data.sun_roof_percent_open !== 0)  ? 'open' : 'closed';
      if (self.info.sunroof !== sunroof) {
        didP = true;
        self.info.sunroof = sunroof;
      }

      doors = data.locked ? 'locked' : ((data.df || data.dr || data.pf || data.pr) ? 'open' : 'unlocked');
      if (self.info.doors !== doors) {
        didP = true;
        self.info.doors = doors;
      }
      doors = data.ft ? 'open' : 'closed';
      if (self.info.frunk !== doors) {
        didP = true;
        self.info.frunk = doors;
      }
      doors = data.rt ? 'open' : 'closed';
      if (self.info.trunk !== doors) {
        didP = true;
        self.info.trunk = doors;
      }

      self.info.lastSample = new Date().getTime();
      if (didP) self.changed();
    });

    if (!self.checkAPI(self, 'tesla.get_climate_state')) return;
    tesla.get_climate_state(self.vehicle.id, function(data) {
      var didP, hvac;

      if (utility.toType(data) === 'error') {
        if ((data.message.indexOf('503:') === 0) || (data.message.indexOf('408:') === 0)) return;
        return logger.error('device/' + self.deviceID, { event: 'get_climate_state', diagnostic: data.message });
      }

      didP = false;

      hvac = (!!data.is_auto_conditioning_on) ? 'on' : 'off';
      if ((hvac === 'on') && (!!data.driver_temp_setting)) hvac = data.driver_temp_setting;
      if (self.info.hvac !== hvac) {
        didP = true;
        self.info.hvac = hvac;
      }

      if ((!!data.inside_temp) && (self.info.intTemperature !== data.inside_temp)) {
        didP = true;
        self.info.intTemperature = data.inside_temp;
      }

      if ((!!data.outside_temp) && (self.info.extTemperature !== data.outside_temp)) {
        didP = true;
        self.info.extTemperature = data.outside_temp;
      }

      self.info.lastSample = new Date().getTime();
      if (didP) self.changed();
    });

    if (!self.checkAPI(self, 'tesla.get_drive_state')) return;
    tesla.get_drive_state(self.vehicle.id, function(data) {
      var didP, speed;

      if (utility.toType(data) === 'error') {
        if ((data.message.indexOf('503:') === 0) || (data.message.indexOf('408:') === 0)) return;
        return logger.error('device/' + self.deviceID, { event: 'get_drive_state', diagnostic: data.message });
      }

      didP = false;

      if (!util.isArray(self.info.location)) {
        self.info.location = [ 0, 0 ];
        setInterval(function() { self.reverseGeocode(self); }, 60 * 1000);
        setTimeout(function() { self.reverseGeocode(self); }, 0);
      }
      if ((self.info.location[0] != data.latitude) || (self.info.location[1] != data.longitude)) {
        didP = true;
        self.info.location[0] = data.latitude;
        self.info.location[1] = data.longitude;
        self.addlocation(self);
      }

      if (self.info.heading !== data.heading) {
        didP = true;
        self.info.heading = data.heading;
      }

      if (!!data.speed) {
        speed = data.speed * 0.44704;    // miles/hour -> meters/second
        if (self.info.velocity !== speed) {
          didP = true;
          self.info.velocity = speed;
        }
      } else if (!self.info.velocity) self.info.velocity = '0';

      self.info.lastSample = new Date().getTime();
      if (didP) self.changed();
      if (self.vehicle.updatingP != didP) {
        self.vehicle.updatingP = didP;

        if (!!self.timer) clearTimeout(self.timer);
        self.timer = setTimeout(function() { self.refresh(self); }, (self.vehicle.updatingP ? 5 : 300 ) * 1000);
      }
    });

    if (!self.checkAPI(self, 'tesla.get_charge_state')) return;
    tesla.get_charge_state(self.vehicle.id, function(data) {
      var charger, didP;

      if (utility.toType(data) === 'error') {
        if ((data.message.indexOf('503:') === 0) || (data.message.indexOf('408:') === 0)) return;
        return logger.error('device/' + self.deviceID, { event: 'get_charge_state', diagnostic: data.message });
      }
      if ((!self.vehicle_speed) && (typeof data.charging_state === 'undefined')) {
        return logger.error('device/' + self.deviceID, { event: 'get_charge_state', data: data });
      }

      didP = false;

      charger = (!self.vehicle.speed)    ? data.charging_state.toLowerCase()
                : self.vehicle.power < 0 ? 'regenerating' : 'drawing';
           if (charger === 'complete') charger = 'completed';
      else if (charger === 'stopped') charger = 'connected';
      if (self.info.charger != charger) {
        didP = true;

        self.info.charger = charger;
      }

      self.info.lastSample = new Date().getTime();
      if (didP) self.changed();
    });
  });
};

ModelS.prototype.stream = function(self, fastP) {
  if ((self.vehicle.streamingP) || (self.vehicle.tokens.length === 0)) return;
  self.vehicle.streamingP = true;

  if (!self.checkAPI(self, 'tesla.stream', function() { self.stream(self, fastP); })) return;
  tesla.stream({ vehicle_id : self.vehicle.vehicle_id
               , email      : self.gateway.info.email
               , password   : self.vehicle.tokens[0]
               }, function(error, response, body) {
    var didP, i, j, odometer, range, record, records, sample, speed;

    self.vehicle.streamingP = false;
    try {
      if (!!error) throw error;
      if (response.statusCode !== 200) throw new Error('response statusCode ' + response.statusCode);
    } catch(ex) {
      logger.info('device/' + self.deviceID, { event: 'stream', diagnostic: ex.message });
      self.vehicle.tokens = [];
      if (!fastP) return;

      return self.refresh(self);
    }
    if (!body) return;

    didP = false;

    records = body.split('\r\n');
    for (i = 0; i < records.length; i++) {
      record = records[i].split(',');
      if (record.length < tesla.stream_columns.length) continue;

      sample = { timestamp: record.shift() };
      for (j = 0; j < tesla.stream_columns.length; j++) sample[tesla.stream_columns[j]] = record[j];

      if (sample.timestamp <= self.vehicle.lastSample.timestamp) continue;
      self.vehicle.lastSample = sample;

      if (!util.isArray(self.info.location)) self.info.location = [ 0, 0, 0 ];
      if (self.info.location[2] !== sample.elevation) {
        didP = true;
        self.info.location[2] = parseInt(sample.elevation, 10);
      }

      if (!!sample.speed) {
        speed = sample.speed * 0.44704;    // miles/hour -> meters/second
        if (self.info.velocity !== speed) {
          didP = true;
          self.info.velocity = speed;
        }
      } else if (!self.info.velocity) self.info.velocity = '0';

      odometer = sample.odometer * 1.60934;    // miles -> kilometers
      if (self.info.odometer != odometer) {
        didP = true;
        self.info.odometer = odometer;
      }

      range = sample.range * 1.60934;    // miles -> kilometers
      if (self.info.range != range) {
        didP = true;
        self.info.range = range;
      }
    }

    if (!didP) return;
    self.changed();
    setTimeout(function() { self.stream(self, true); }, 500);
  });
};


ModelS.prototype.perform = function(self, taskID, perform, parameter) {
  var cb, deg, f, params, pct, state;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  f = null;
  switch (perform) {
    case 'set':
      return self.setName(params.name, taskID);

    case 'doors':
      f = function() { tesla.door_lock({ id: self.vehicle.id, lock : params.doors || parameter }, cb); };
      break;

    case 'lock':
      f = function() { tesla.door_lock({ id: self.vehicle.id, lock : true }, cb); };
      break;

    case 'unlock':
      f = function() { tesla.door_lock({ id: self.vehicle.id, lock : false }, cb); };
      break;

    case 'lights':
      f = function() { tesla.flash(self.vehicle.id, cb); };
      break;

    case 'horn':
      f = function() { tesla.honk(self.vehicle.id, cb); };
      break;

    case 'hvac':
      if (!!params.hvac) parameter = params.hvac;
      if (parameter === 'off') {
        f = function() { tesla.auto_conditioning({ id: self.vehicle.id, climate: tesla.CLIMATE_OFF }, cb); };
        break;
      }
      if (parameter === 'on') {
        f = function() { tesla.auto_conditioning({ id: self.vehicle.id, climate: tesla.CLIMATE_ON }, cb); };
        break;
      }
      deg = parseInt(parameter, 10);
      if ((deg < tesla.TEMP_LO) || (deg >= tesla.TEMP_HI)) break;
      if (self.info.hvac === 'off') {
        f = function() { tesla.auto_conditioning({ id: self.vehicle.id, climate: tesla.CLIMATE_ON }, cb); };
        break;
      }
      f = function() { tesla.set_temperature({ id: self.vehicle.id, dtemp: deg }, cb); };
      break;

    case 'sunroof':
      if (!!params.sunroof) parameter = params.sunroof;
      state = { open: tesla.ROOF_OPEN, comfort: tesla.ROOF_COMFORT, vent: tesla.ROOF_VENT, close: tesla.ROOF_CLOSE }[parameter];
      if (typeof state !== 'undefined') f = function() { tesla.sun_roof({ id: self.vehicle.id, roof: state }, cb); };
      else {
        pct = parseInt(parameter, 10);
        if ((pct < 0) || (pct > 100)) break;
        f = function() { tesla.sun_roof({ id: self.vehicle.id, roof: 'move', percent: pct }, cb); };
      }
      break;

    default:
      break;
  }
  if (!f) return false;

  cb = function(data) {
    if (utility.toType(data) === 'error') {
      logger.error('device/' + self.deviceID,
                   { event: 'perform', perform: perform, parameter: parameter, diagnostic: data.message });
    } else if (!data.result) {
      logger.error('device/' + self.deviceID,
                   { event: 'perform', perform: perform, parameter: parameter, diagnostic: 'failed' });
    } else if ((perform === 'hvac') && (!!deg)) {
      perform = null;
      tesla.set_temperature({ id: self.vehicle.id, dtemp: deg }, cb);
    }

    self.refresh(self);
  };
  f();

  self.checkAPI(self, 'tesla.perform');
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var deg
    , pct
    , params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  switch (perform) {
    case 'set':
      if (!params.name) result.requires.push('name');
      break;

    case 'doors':
      if (!!params.doors) parameter = params.doors;
      if (!{ lock    : true
           , unlock  : true }[parameter]) result.invalid.push('doors');
      break;

    case 'lock':
    case 'unlock':
      break;

    case 'lights':
      if (!params.lights) parameter = 'flash';
      if (!{ flash   : true }[parameter]) result.invalid.push('lights');
      break;

    case 'horn':
      if (!params.horn) parameter = 'honk';
      if (!{ honk    : true }[parameter]) result.invalid.push('horn');
      break;

    case 'hvac':
      if (!!params.hvac) parameter = params.hvac;
      if (!{ on      : true
           , off     : true }[parameter]) {
        deg = parseInt(parameter, 10);
        if ((deg < tesla.TEMP_LO) || (deg >= tesla.TEMP_HI))
                                          result.invalid.push('hvac');
      }
      break;

    case 'sunroof':
      if (!!params.sunroof) parameter = params.sunroof;
      if (!{ open    : true
           , comform : true
           , vent    : true
           , close   : true }[parameter]) {
        pct = parseInt(parameter, 10);
        if ((pct < 0) || (pct > 100))    result.invalid.push('sunroof');
      }
      break;

    default:
      result.invalid.push('perform');
      break;
  }

  return result;
};


exports.start = function() {
  steward.actors.device.motive.tesla = steward.actors.device.motive.tesla ||
      { $info     : { type: '/device/motive/tesla' } };

  steward.actors.device.motive.tesla['model-s'] =
      { $info     : { type       : '/device/motive/tesla/model-s'
                    , observe    : [ ]
                    , perform    : [ 'doors'    // door_lock / door_unlock
                                   , 'lights'   // flash_lights
                                   , 'horn'     // honk_horn
                                   , 'hvac'     // off or celsius
                                   , 'sunroof'  // open, comfort, vent, or closed
                                   ]
                    , properties : { name           : true
                                   , status         : [ 'ready', 'reset', 'waiting' ]
                                   , lastSample     : 'timestamp'
                                   , charger        : [ 'connected'
                                                      , 'charging'
                                                      , 'completed'
                                                      , 'disconected'
                                                      , 'drawing'
                                                      , 'regenerating' ]
                                   , hvac           : [ 'on', 'off', 'celsius' ]
                                   , intTemperature : 'celsius'
                                   , extTemperature : 'celsius'

                                   , location       : 'coordinates'
//                                 , accuracy       : 'meters'
                                   , physical       : true
                                   , distance       : 'kilometers'
                                   , heading        : 'degrees'
                                   , velocity       : 'meters/second'
                                   , odometer       : 'kilometers'
                                   , range          : 'kilometers'

                                   , sunroof        : [ 'open', 'comfort', 'vent', 'closed', 'none' ]
                                   , doors          : [ 'open', 'unlocked', 'locked' ]
                                   , frunk          : [ 'open', 'closed' ]
                                   , trunk          : [ 'open', 'closed' ]
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/motive/tesla/model-s'] = ModelS;
};
