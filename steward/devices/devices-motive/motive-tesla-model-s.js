// Tesla Motors, Inc. - Model S - Electric Vehicle (for the WIN)

var tesla       = require('teslams')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , motive      = require('./../device-motive')
  ;


var logger = motive.logger;


var ModelS = exports.device = function(deviceID, deviceUID, info) {
  var self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.vehicle = info.vehicle;
  self.vehicle.lastSample = { timestamp: 0 };
  self.vehicle.streamingP = false;
  self.vehicle.updatingP = false;
  self.events = {};

  self.info = {};

  self.status = null;
  self.newstate(self);
  self.gateway = info.gateway;

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (request === 'attention') {
      if (self.status === 'reset') self.alert('please enable remote access from vehicle console');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      if (observe === 'charger') self.events[eventID] = { observe: observe, parameter: parameter };
      return;
    }
    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });

  self.refresh(self);
};
util.inherits(ModelS, motive.Device);


ModelS.prototype.newstate = function(self, enabled) {
  var status = (self.vehicle.state !== 'online') ? self.vehicle.state : (enabled ? 'ready' : 'reset');

  if (status === 'asleep') status = 'waiting';
  if (self.status == status) return;
  self.status = status;
  self.changed();
};

ModelS.prototype.refresh = function(self) {
  if (!!self.timer) { clearTimeout(self.timer); self.timer = null; }

  if ((self.vehicle.state !== 'waiting') && (self.vehicle.tokens.length !== 0)) return self.scan(self);

  tesla.wake_up(self.vehicle.id, function(data) {
    if (utility.toType(data) === 'error') {
      logger.error('device/' + self.deviceID, { event: 'wake_up', diagnostic: data.message });
      return self.scan(self);
    }

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
  self.timer = setTimeout(function() { self.refresh(self); }, (self.vehicle.updatingP ? 1 : 300 ) * 1000);

  tesla.mobile_enabled(self.vehicle.id, function(data) {
    if (utility.toType(data) === 'error') {
      return logger.error('device/' + self.deviceID, { event: 'mobile_enabled', diagnostic: data.message });
    }

    self.newstate(self, data.result);
    if (!data.result) return;

    self.stream(self, false);

    tesla.get_vehicle_state(self.vehicle.id, function(data) {
      var didP, doors, sunroof;

      if (utility.toType(data) === 'error') {
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

    tesla.get_climate_state(self.vehicle.id, function(data) {
      var didP, hvac;

      if (utility.toType(data) === 'error') {
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

    tesla.get_drive_state(self.vehicle.id, function(data) {
      var didP, speed;

      if (utility.toType(data) === 'error') {
        return logger.error('device/' + self.deviceID, { event: 'get_drive_state', diagnostic: data.message });
      }

      didP = false;

      if (!util.isArray(self.info.location)) self.info.location = [ 0, 0 ];
      if ((self.info.location[0] != data.latitude) || (self.info.location[1] != data.longitude)) {
        didP = true;
        self.info.location[0] = data.latitude;
        self.info.location[1] = data.longitude;
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
        self.timer = setTimeout(function() { self.refresh(self); }, (self.vehicle.updatingP ? 1 : 300 ) * 1000);
      }
    });

    tesla.get_charge_state(self.vehicle.id, function(data) {
      var charger, didP, event, eventID;

      if (utility.toType(data) === 'error') {
        return logger.error('device/' + self.deviceID, { event: 'get_charge_state', diagnostic: data.message });
      }

      didP = false;

      charger = (!self.vehicle.speed)    ? data.charging_state.toLowerCase()
                : self.vehicle.power < 0 ? 'regenerating' : 'drawing';
           if (charger === 'complete') charger = 'completed';
      else if (charger === 'stopped') charger = 'connected';
      if (self.info.charger != charger) {
        didP = true;

        if (!!self.info.charger) {
          for (eventID in self.events) {
            if (!self.events.hasOwnProperty(eventID)) continue;
            event = self.events[eventID];

            if ((event.observe === 'charger') && ((event.parameter === charger) || (event.parameter === ''))) {
              steward.observed(eventID);
            }
          }
        }
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
      if (!params.name) return false;
      self.setName(params.name);
      return steward.performed(taskID);

    case 'doors':
      f = function() { tesla.door_lock({ id    : self.vehicle.id
                                       , state : parameter !== 'unlock' ? tesla.LOCK_ON : tesla.LOCK_OFF
                                       }, cb); };
      break;

    case 'lights':
      f = function() { tesla.flash(self.vehicle.id, cb); };
      break;

    case 'horn':
      f = function() { tesla.honk(self.vehicle.id, cb); };
      break;

    case 'hvac':
      if (parameter === 'off') {
        f = function() { tesla.auto_conditioning({ id: self.vehicle.id, state: tesla.CLIMATE_OFF }, cb); };
        break;
      }
      if (parameter === 'on') {
        f = function() { tesla.auto_conditioning({ id: self.vehicle.id, state: tesla.CLIMATE_ON }, cb); };
        break;
      }
      deg = parseInt(parameter, 10);
      if ((deg < tesla.TEMP_LO) || (deg >= tesla.TEMP_HI)) break;
      if (self.info.hvac === 'off') {
        f = function() { tesla.auto_conditioning({ id: self.vehicle.id, state: tesla.CLIMATE_ON }, cb); };
        break;
      }
      perform = null;
      f = function() { tesla.set_temperature({ id: self.vehicle.id, dtemp: deg, ptemp: deg }, cb); };
      break;

    case 'sunroof':
      state = { open: tesla.ROOF_OPEN, comfort: tesla.ROOF_COMFORT, vent: tesla.ROOF_VENT, close: tesla.ROOF_CLOSE }[parameter];
      if (!!state) f = function() { tesla.sun_roof({ id: self.vehicle.id, state: state }, cb); };
      else {
        pct = parseInt(parameter, 10);
        if ((pct < 0) || (pct > 100)) break;
        f = function() { tesla.sun_roof({ id: self.vehicle.id, state: 'move',  percent: pct }, cb); };
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
      tesla.set_temperature({ id: self.vehicle.id, dtemp: deg, ptemp: deg }, cb);
    }

    self.refresh(self);
  };
  f();

  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var deg
    , pct
    , params = {}
    , result = { invalid: [], requires: [] }
    ;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  switch (perform) {
    case 'set':
      if (!params.name) result.requires.push('name');
      break;

    case 'doors':
      if (!{ lock    : true
           , unlock  : true }[parameter]) result.invalid.push('doors');
      break;

    case 'lights':
      if (!{ flash   : true }[parameter]) result.invalid.push('lights');
      break;

    case 'horn':
      if (!{ honk    : true }[parameter]) result.invalid.push('honk');
      break;

    case 'hvac':
      if (!{ on      : true
           , off     : true }[parameter]) {
        deg = parseInt(parameter, 10);
        if ((deg < tesla.TEMP_LO) || (deg >= tesla.TEMP_HI))
                                          result.invalid.push('hvac');
      }
      break;

    case 'sunroof':
      if (!{ open    : true
           , comform : true
           , vent    : true
           , close   : true }[parameter]) {
        pct = parseInt(parameter, 10);
        if ((pct < 0) || (pct > 100))    result.invalid.push('sunroof');
      }
      break;

    default:
      result.requires.push('perform');
      break;
  }

  return result;
};


exports.start = function() {
  steward.actors.device.motive.tesla = steward.actors.device.motive.tesla ||
      { $info     : { type: '/device/motive/tesla' } };

  steward.actors.device.motive.tesla['model-s'] =
      { $info     : { type       : '/device/motive/tesla/model-s'
                    , observe    : [ 'charger' ]
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
      , $validate : { perform    : validate_perform }
      };
  devices.makers['/device/motive/tesla/model-s'] = ModelS;
};

