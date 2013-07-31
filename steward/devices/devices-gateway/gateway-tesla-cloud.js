// Tesla Motors, Inc. - Zero emissions. Zero compromises.

var tesla       = require('teslams')
  , util        = require('util')
  , validator   = require('validator')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  ;


var logger   = exports.logger = utility.logger('gateway');


var Cloud = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.status = 'waiting';
  self.elide = [ 'passphrase' ];
  self.changed();
  self.timer = null;

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'attention') {
      if (self.status === 'error') self.alert('please check login credentials');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.email) || (!!info.passphrase)) self.scan(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.error = function(self, err) {
  self.status = 'error';
  self.changed();
  logger.error('device/' + self.deviceID, { diagnostic: err.message });

  if (!!self.timer) clearTimeout(self.timer);
  self.timer = setTimeout(function() { self.scan(self); }, 300 * 1000);
};

Cloud.prototype.scan = function(self) {
  tesla.all({ email: self.info.email, password: self.info.passphrase }, function (error, response, body) {
    var data, i;

    if (error) return self.error(self, error);
    if (response.statusCode !== 200) return self.error(self, new Error('response statusCode ' + response.statusCode));
    try { data = JSON.parse(body); } catch(ex) { return self.error(self, ex); }
    if (!util.isArray(data)) return self.error(self, new Error('expecting an array from Tesla Motors cloud service'));
    self.status = 'ready';

    for (i = 0; i < data.length; i++) self.addvehicle(self, data[i]);
  });

  if (!!self.timer) clearTimeout(self.timer);
  self.timer = setTimeout(function() { self.scan(self); }, 300 * 1000);
};

Cloud.prototype.addvehicle = function(self, vehicle) {
  var color, colors, description, i, info, name, number, option, options, udn;

  udn = 'tesla:' + vehicle.id;
  if (devices.devices[udn]) return;

  colors = { PBSB : 'Black'
           , PBCW : 'Solid White'
           , PMSS : 'Silver'
           , PMTG : 'dolphin gray metallic'
           , PMAB : 'Metallic Brown'
           , PMMB : 'Metallic Blue'
           , PMSG : 'Metallic Green'
           , PPSW : 'Pearl White'
           , PPMR : 'Red'
           , PPSR : 'Signature Red'
           };

  color = ''; description = ''; name = ''; number = ['S', '60'];
  options = vehicle.option_codes.split(',');
  for (i = 0; i < options.length; i++) {
    option = options[i];

    if (!!colors[option]) {
      color = colors[option] + ' ';
      continue;
    }
    if (option.indexOf('MS') === 0) {
      description = 'Premium Electric Sedan';
      name = 'Model S';
      continue;
    }
    if ((option.indexOf('PF') === 0) && (option.indexOf('PF00') !== 0)) { number[0] = 'P';              continue; }
    if (option.indexOf('BT') === 0)                                     { number[1] = option.substr(2); continue; }
  }
  number = number.join('');

  info =  { source: self.deviceID, gateway: self, vehicle: vehicle };
  info.device = { url                          : null
                , name                         : vehicle.display_name || (color + number)
                , manufacturer                 : 'Tesla Motors'
                , model        : { name        : name
                                 , description : description
                                 , number      : number.join
                                 }
                , unit         : { serial      : self.vehicle_id
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/motive/tesla/model-s';
  info.id = info.device.unit.udn;

  logger.debug(info.device.name, { id: info.device.unit.serial,  params: info.params });
  devices.discover(info);
  self.changed();
};

Cloud.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') return false;

  if (!!params.name) self.setName(params.name);

  if (!!params.email) self.info.email = params.email;
  if (!!params.passphrase) self.info.passphrase = params.passphrase;
  self.scan(self);

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
  else if (info.passphrase.length < 1) result.invalid.push('passphrase');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.email) params.email = 'nobody@example.com';
  if (!params.passphrase) params.passphrase = ' ';

  return validate_create(params);
};


exports.start = function() {
  steward.actors.device.gateway.tesla = steward.actors.device.gateway.tesla ||
      { $info     : { type: '/device/gateway/tesla' } };

  steward.actors.device.gateway.tesla.cloud =
      { $info     : { type       : '/device/gateway/tesla/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'ready', 'error' ]
                                   , email      : true
                                   , passphrase : true
                                   }
                    }
      , $validate : {  create    : validate_create
                    ,  perform   : validate_perform
                    }
      };
  devices.makers['/device/gateway/tesla/cloud'] = Cloud;
};
