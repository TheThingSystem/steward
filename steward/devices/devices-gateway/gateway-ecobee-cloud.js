// ecobee - more than just a thermostat: http://www.ecobee.com

/* This is a little more complicated that usual. Sorry!

   0. Only the Smart Si series is supported.

   1. Make sure your thermostat is registered with ecobee. If not, go to

          https://www.ecobee.com/home/addSmartSi.jsp

      and either create a new account or sign in to an existing one.

   2. Make sure you have an ecobee developer's account. If not, go to

          https://www.ecobee.com/home/developer/loginDeveloper.jsp

      login with your ecobee account, and fill-out the form to become a developer.

   3. Once you are a developer, go to

          https://www.ecobee.com/home/developer/api/samples.shtml

      and you will find a link to the "reference application", which is a .zip file that extracts to a directory called

          apidemo/

   3a. Look at the file

          package.json

       and see if it has a line that looks like this:

          "main": "./ecobee-api.js",

       If so, go to step 4.

   3b. If not, then you need an updated version of the library. This is a two-step process: first, submit an issue to

          https://github.com/TheThingSystem/steward/issues/new

       and submit a 'question' with the Title 'Where is the updated version'? When a curator gets this, we'll ask you to post
       the same question to the developer's forum. This is how we know that you are a registered developer, and after seeing
       the question on the forum, we'll send you the diffs. (Of course, as soon as the library is updated, we'll remove this
       extra work. Sorry, sorry, sorry!

   4. Now run these commands in the shell:

        % mv apidemo .../steward/node_modules/ecobee-api
        % cd .../steward/node_modules/ecobee-api
        % mv config.js config.js.orig
        % npm install -l

      and restart the steward.

   5. Now go to the Apps widget on

          https://www.ecobee.com/home/secure/developer.jsf

      and click on 'Create New'. You can fill-out the first three fields (app name, summary, and description) however you wish;
      however, be sure that you have this setting:

          Auth Method: Ecobee PIN

   6. After you click on "Create New", you'll see an entry for the app with an API key.

   7. Make sure your steward is running and go to:

          http://127.0.0.1:8887/

      to get the HTML5/D3 client. Click on the steward's name on the bottom of the screen to get to the

          Steward Place Settings

      form and create a new Cloud Service for 'ecobee' entering the API key you received.

   8. An alert will flash on the screen asking you to go to the "My Apps" widget on

          https://www.ecobee.com/home/secure/settings.jsf

      and to enter a 4-character PIN. Please do so, this authorizes the steward.
 */

var ecobee
  , utility     = require('./../../core/utility')
  ;

try {
  ecobee      = require('ecobee-api');
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing ecobee-cloud gateway (continuing)', { diagnostic: ex.message });
}

var events      = require('events')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  ;


var climate  = null;
var logger   = exports.logger = utility.logger('gateway');

var macaddrs = {};
var newaddrs = {};


var Cloud = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.status = 'waiting';
  self.elide = [ 'appKey', 'authToken', 'accessToken', 'refreshToken' ];
  self.changed();
  self.timer = null;

  ecobee.logger = utility.logfnx(logger, 'device/' + self.deviceID);

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    var macaddr;

    if (request === 'attention') {
      if (self.status === 'reset') self.alert('please check login credentials at https://home.ecobee.com/');
      for (macaddr in macaddrs) if (macaddrs.hasOwnProperty(macaddr)) delete(newaddrs[macaddr]);
      for (macaddr in newaddrs) if (newaddrs.hasOwnProperty(macaddr)) {
        self.alert('discovered ecobee thermostat at ' + newaddrs[macaddr]);
        macaddrs[macaddr] = true;
      }

      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if (!!info.appKey) self.login(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


var Ecobee = function(gateway) {
  var api, p, self;

  self = this;

  api = ecobee.calls;
  self.api = {};
  for (p in api) if (api.hasOwnProperty(p)) self.api[p] = api[p];

  self.gateway = gateway;
  self.api.appKey = gateway.info.appKey;
  self.api.isHTTPS = true;

  return self;
};
util.inherits(Ecobee, events.EventEmitter);

Ecobee.prototype.login = function(callback) {
  var self = this;

  if (!self.api.appKey) {
// NB: should never get here...
    return callback(new Error('please go to the Apps widget on https://www.ecobee.com/home/secure/developer.jsf and click on '
                       + '"Create New"'));
  }

  if ((!self.gateway.info.authToken) || (!self.gateway.info.refreshToken)) {
    self.api.getPin(null, null, function(err, data) {
      if (err) return self.emit('error', err);

      self.callback = callback;
      self.authToken = data.code;
      self.gateway.info.ecobeePin = data.ecobeePin;
      self.retry = { expiresAt : new Date().getTime() + (data.expires_in * 60 * 1000)
                   , interval  : data.interval * 1000
                   };

      return self.prompt(self);
    });

    return;
  }

  self.api.refresh(self.gateway.info.refreshToken, function(err, data) {
    if (err) {
      delete(self.gateway.info.authToken);
      delete(self.gateway.info.accessToken);
      delete(self.gateway.info.refreshToken);
      if ((self.gateway.status !== 'error') && (err.message === '401')) return self.login(callback);
      return self.emit('error', err);
    }

    self.gateway.expiresAt = new Date().getTime() + ((data.expires_in * 60) * 1000);
    self.gateway.info.accessToken = data.access_token;
    self.gateway.info.refreshToken = data.refresh_token;
    self.gateway.setInfo();

    callback(null);
  });
};

Ecobee.prototype.prompt = function(self) {
  delete(self.gateway.nextAlert);
  self.gateway.alert('please go to the "My Apps" tab on https://www.ecobee.com/home/secure/settings.jsf and enter PIN "'
                     + self.gateway.info.ecobeePin + '"');
  setTimeout(function() { self.refresh(self); }, self.retry.interval);
};

Ecobee.prototype.refresh = function(self) {
  var gateway = self.gateway;

  if (new Date().getTime() > self.retry.expiresAt) {
    delete(gateway.info.ecobeePin);
  }

  self.api.registerPin(null, self.authToken, function(err, data) {
    delete(gateway.info.ecobeePin);

    if (err) {
      logger.error('device/' + gateway.deviceID, { event: 'registerPin', diagnostic: err.message });
      delete(self.gateway.info.authToken);
      delete(self.gateway.info.accessToken);
      delete(self.gateway.info.refreshToken);
      return self.emit('error', new Error(err.message));
    }

    gateway.info.authToken = self.authToken;
    gateway.expiresAt = new Date().getTime() + ((data.expires_in * 60) * 1000);
    gateway.info.accessToken = data.access_token;
    gateway.info.refreshToken = data.refresh_token;
    gateway.setInfo();

    self.callback(null);
  });
};

Ecobee.prototype.setAway = function(self, sensor, mode) {
  var climate, setHold;

  climate = self.climates[(mode === 'on') ? 'away' : 'home'];
  if (!climate) return;

  setHold = new ecobee.SetHoldFunction(climate.coolTemp, climate.heatTemp, 'indefinite', null);
  setHold.event = { isOccupied            : climate.isOccupied
                  , isCoolOff             : false
                  , isHeatOff             : false
                  , fan                   : ((climate.coolFan === 'auto') || (climate.heatFan === 'auto')) ? 'auto' : 'on'
                  , isTemperatureRelative : false
                  , isTemperatureAbsolute : true
                  };

  self.api.updateThermostats(self.gateway.info.accessToken, new ecobee.ThermostatsUpdateOptions(sensor.serial), [ setHold ],
                             null, function(err) {
    if (!err) return;

    if (climate === null) climate = require('./../device-climate');
    climate.logger.error('device/' + sensor.deviceID, { event: 'updateThermostats', diagnostic: err.message });
  });
};

Ecobee.prototype.setHold = function(self, sensor, mode, value) {
  var setHold;

  setHold = new ecobee.SetHoldFunction(1000, 500, 'indefinite', null);
  switch (mode) {
    case 'heat':
      setHold.params.heatHoldTemp = (value * 18) + 320;
      break;

    case 'cool':
      setHold.params.coolHoldTemp = (value * 18) + 320;
      break;

    default:    // 'fan' or 'off'
      setHold.event = { isTemperatureRelative: false, isTemperatureAbsolute: false, isCoolOff: true, isHeatOff: true };
      if (mode !== 'fan') value = 'auto';
      if ((value === 'on') || (value === 'auto')) {
        setHold.event.fan = value;
        break;
      }
      value = parseInt(value, 10);
      if (isNaN(value) || (value < 1)) {
        setHold.event.fan = 'auto';
        break;
      }
      setHold.event.fan = 'on';
      setHold.params.holdType = 'holdHours';
      setHold.params.holdHours = Math.round(value / (60 * 60 * 1000));
      if (setHold.params.holdHours < 1) setHold.params.holdHours = 1;
      break;
  }

  self.api.updateThermostats(self.gateway.info.accessToken, new ecobee.ThermostatsUpdateOptions(sensor.serial), [ setHold ],
                             null, function(err) {
    if (!err) return;

    if (climate === null) climate = require('./../device-climate');
    climate.logger.error('device/' + sensor.deviceID, { event: 'updateThermostats', diagnostic: err.message });
  });
};

Cloud.prototype.login = function(self) {
  self.ecobee = new Ecobee(self);
  self.ecobee.logger = utility.logfnx(logger, 'device/' + self.deviceID);

  self.ecobee.on('error', function(err) {
    self.error(self, err);

    if (!!self.timer) { clearInterval(self.timer); self.timer = null; }
    setTimeout(function() { self.login(self); }, 30 * 1000);
  }).login(function(err, data) {/* jshint unused: false */
    if (err) { self.ecobee = null; return self.error(self, err); }

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
    self.scan(self);
  });
};

Cloud.prototype.error = function(self, err) {
  self.status = 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { diagnostic: err.message, data: JSON.stringify(err.data || {}) });
};

Cloud.prototype.retry = function(self, err) {
  if ((self.status !== 'error') && ((!err.data) || (!err.data.status) || (err.data.status.code !== 14))) {
    return self.ecobee.emit('error', err);
  }

  logger.info('device/' + self.deviceID,
              { event: 'thermostatSummary', diagnostic: err.message, data: JSON.stringify(err.data || {}) });
  self.status = 'error';
  self.login(self);
};

Cloud.prototype.scan = function(self) {
  if (!self.ecobee) return;

  self.ecobee.api.thermostatSummary(self.info.accessToken, null, function(err, data) {
    var entry, event, events, i, id, options, revision, revisions, sensor, thermostats, udn;

    if (err) return self.retry(self, err);

    if (data.status.code !== 0) return self.ecobee.emit('error', new Error(data.status.code + ': ' + data.status.message));

    options = { selection: { selectionType   : 'thermostats'
                           , selectionMatch  : ''
                           , includeProgram  : true
                           , includeRuntime  : true
                           , includeSettings : true
                           , includeEvents   : true
                           }
              };

    revisions = {};
    thermostats = [];
    for (i = 0; i < data.revisionList.length; i++) {
      entry = data.revisionList[i].split(':');
      id = entry[0];
      revision = entry[5];

      udn = 'ecobee:' + id;
      if (!!devices.devices[udn]) {
        sensor = devices.devices[udn].device;
        if ((!!sensor) && (!!sensor.revision) && (sensor.revision === revision)) {
          sensor.updated = new Date().getTime();
          continue;
        }
      }

      thermostats.push(id);
      revisions[id] = revision;
    }
    if (thermostats.length <= 0) return;

    options.selection.selectionMatch = thermostats.join(',');
    self.ecobee.api.thermostats(self.info.accessToken, options, function(err, data) {
      var actual, climate, i, j, program, r, runtime, settings, thermostat;

      if (err) return self.retry(self, err);

      if (data.status.code !== 0) return self.ecobee.emit('error', new Error(data.status.code + ': ' + data.status.message));

      for (i = 0; i < data.thermostatList.length; i++) {
        thermostat = data.thermostatList[i];

        runtime = thermostat.runtime;
        for (r in runtime) if ((runtime.hasOwnProperty(r)) && (runtime[r] === -5002)) delete(runtime[r]);

        actual = { temperature : runtime.actualTemperature
                 , humidity    : runtime.actualHumidity
                 , connected   : runtime.connected
                 };

        if ((!!runtime.desiredHeat) && (runtime.actualTemperature < runtime.desiredHeat)) {
          actual.goalTemperature = runtime.desiredHeat;
          actual.hvacMode = 'heat';
        } else if ((!!runtime.desiredCool) && (runtime.actualTemperature > runtime.desiredCool)) {
          actual.goalTemperature = runtime.desiredCool;
          actual.hvacMode = 'cool';
        }
        else {
          actual.hvacMode = 'off';
        }

        settings = thermostat.settings;
        if (settings.useCelsius) {
          actual.temperature = actual.temperature / 10;
          if (!!actual.goalTemperature) actual.goalTemperature = actual.goalTemperature / 10;
        } else {
          actual.temperature = (actual.temperature - 320) / 18;
          if (!!actual.goalTemperature) actual.goalTemperature = (actual.goalTemperature - 320) / 18;
        }

        program = thermostat.program;
        self.ecobee.climates = {};
        for (j = 0; j < program.climates.length; j++) {
          climate = program.climates[j];
          if (climate.climateRef !== program.currentClimateRef) continue;

          actual.isOccupied = climate.isOccupied;
          break;
        }
        for (j = 0; j < program.climates.length; j++) {
          climate = program.climates[j];
          self.ecobee.climates[climate.climateRef] = climate;
        }

        events = thermostat.events;
        for (j = 0; j < events.length; j++) {
          event = events[j];
          if (!event.running) continue;

          if (event.fan === 'on') actual.hvacMode = 'fan';
          break;
        }

        self.addstation(self, thermostat.identifier, thermostat, thermostat.name, actual,
                        runtime.lastStatusModified, revisions[thermostat.identifier] || '');
      }
    });
  });
};

Cloud.prototype.addstation = function(self, id, station, name, actual, lastModified, revision) {
  var diff, info, timestamp, params, sensor, udn;

  timestamp = new Date().getTime();
  try {
    if (lastModified === '2010-01-01 01:01:01') new Error('');
    diff = (new Date(station.utcTime).getTime()) - (new Date(lastModified).getTime());
    if (diff > 0) timestamp -= diff;
  } catch(ex) {}

  params = { lastSample      : timestamp
           , temperature     : actual.temperature
           , goalTemperature : actual.goalTemperature || actual.temperature
           , humidity        : actual.humidity
           , hvac            : actual.hvacMode
           , away            : actual.isOccupied ? 'off'     : 'on'
           , status          : actual.connected  ? 'present' : 'absent'
           };

  udn = 'ecobee:' + id;
  if (!!devices.devices[udn]) {
    sensor = devices.devices[udn].device;
    if (!sensor) return;

    sensor.revision = revision;
    return sensor.update(sensor, params, actual.connected ? 'present' : 'absent');
  }

  info =  { source: self.deviceID, gateway: self, params: params, revision: revision };
  info.device = { url                          : null
                , name                         : name
                , manufacturer                 : 'ecobee'
                , model        : { name        : station.modelNumber
                                 , description : ''
                                 , number      : ''
                                 }
                , unit         : { serial      : id
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/climate/ecobee/control';
  info.id = info.device.unit.udn;
  macaddrs[station.mac_address] = true;

  logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: info.params });
  devices.discover(info);
  self.changed();
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);
  if (!!params.ikon) self.setIkon(params.ikon);

  if (!!params.appKey) {
    self.info.appKey = params.appKey;
    delete(self.info.authToken);
    delete(self.info.accessToken);
    delete(self.info.refreshToken);
  }
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.appKey) result.requires.push('appKey');
  else if ((typeof info.appKey !== 'string') || (info.appKey.length < 32)) result.invalid.push('appKey');

  return result;
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

  if (!params.appKey) return result;

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.ecobee = steward.actors.device.gateway.ecobee ||
      { $info     : { type: '/device/gateway/ecobee' } };

  steward.actors.device.gateway.ecobee.cloud =
      { $info     : { type       : '/device/gateway/ecobee/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , appKey       : true
                                   , authToken    : true
                                   , accessToken  : true
                                   , refreshToken : true
                                   , ecobeePin    : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/ecobee/cloud'] = Cloud;

  require('./../../discovery/discovery-mac').pairing([ '44:61:32' ], function(ipaddr, macaddr, tag) {
    if ((!!macaddrs[macaddr]) || (ipaddr === '0.0.0.0')) return;

    logger.debug(tag, { ipaddr: ipaddr, macaddr: macaddr });
    newaddrs[macaddr] = ipaddr;
  });

  utility.acquire2(__dirname + '/../*/*-ecobee-*.js', function(err) {
    if (!!err) logger('ecobee-cloud', { event: 'glob', diagnostic: err.message });
  });
};
