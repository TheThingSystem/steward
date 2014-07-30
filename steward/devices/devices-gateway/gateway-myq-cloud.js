// MyQ: http://www.chamberlain.com/smartphone-control-products/myq-garage/model-myq-g0201

var MyQ         = require('liftmaster')
  , util        = require('util')
  , validator   = require('validator')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  ;


var logger   = exports.logger = utility.logger('gateway');


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
  self.elide = [ 'passphrase' ];
  self.changed();
  self.timer = null;

  self.doorStates = { '1' : 'open'
                    , '2' : 'closed'
                    , '3' : 'stopped'
                    , '4' : 'opening'
                    , '5' : 'closing'
                    , '8' : 'moving'
                    , '9' : 'open'
                    };

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.email) && (!!info.passphrase)) setTimeout(function() { self.login(self); }, 0);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.login = function(self) {
  self.myq = new MyQ(self.info.email, self.info.passphrase).login(function(err) {
    if (!!err) { self.myq = null; return self.error(self, 'login', err); }

    self.status = 'ready';
    self.changed();

    if (!!self.timer) clearInterval(self.timer);
    self.timer = setInterval(function() { self.scan(self); }, 300 * 1000);
    self.scan(self);
  });
};

Cloud.prototype.error = function(self, event, err) {
  self.status = 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, { event: event, diagnostic: err.message });
};

Cloud.prototype.scan = function(self) {
  if (!self.myq) return;

  self.myq.getDevices(function(err, results) {
    var device, door, i, info, params, udn;

    if (!!err) return self.error(self, 'getDevices', err);

    for (i = 0; i < results.length; i++) {
      device = results[i];

      params = { status     : self.doorStates[device.state] || 'error'
               , physical   : device.location
               , lastSample : parseInt(device.updated, 10)
               };

      udn = 'myq:' + device.type + ':' + device.serialNo;
      if (!!devices.devices[udn]) {
        door = devices.devices[udn].device;
        if (!!door) door.update(door, params);
        continue;
      }

      info =  { source: self.deviceID, gateway: self, params: params, myqId: device.id };
      info.device = { url                          : null
                    , name                         : device.name
                    , manufacturer                 : 'Chamberlain'
                    , model        : { name        : device.type
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serial      : device.id
                                     , udn         : udn
                                     }
                    };
      info.url = info.device.url;
      info.deviceType = '/device/motive/myq/garage-door';
      info.id = info.device.unit.udn;

      logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  type: device.type });
      devices.discover(info);
      self.changed();
    }
  });
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);
  if (!!params.ikon) self.setIkon(params.ikon);

  if (!!params.email) self.info.email = params.email;
  if (!!params.passphrase) self.info.passphrase = params.passphrase;
  self.login(self);

  self.setInfo();

  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.email) result.requires.push('email');
  else {
    try { validator.check(info.email).isEmail(); } catch(ex) { result.invalid.push('email'); }
  }

  if (!info.passphrase) result.requires.push('passphrase');
  else if ((typeof info.passphrase !== 'string') || (info.passphrase.length < 1)) result.invalid.push('passphrase');

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

  if (!params.email) params.email = 'nobody@example.com';
  if (!params.passphrase) params.passphrase = ' ';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.myq = steward.actors.device.gateway.myq ||
      { $info     : { type: '/device/gateway/myq' } };

  steward.actors.device.gateway.myq.cloud =
      { $info     : { type       : '/device/gateway/myq/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name         : true
                                   , status       : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , email        : true
                                   , passphrase   : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/myq/cloud'] = Cloud;

  utility.acquire2(__dirname + '/../*/*-myq-*.js', function(err) {
    if (!!err) logger('myq-cloud', { event: 'glob', diagnostic: err.message });
  });
};
