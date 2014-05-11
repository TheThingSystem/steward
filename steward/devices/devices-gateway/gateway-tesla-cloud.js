// Tesla Motors, Inc. - Zero emissions. Zero compromises.

var https       = require('https')
  , tesla       = require('teslams')
  , underscore  = require('underscore')
  , url         = require('url')
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
  self.fails = 0;
  self.chargers = chargers;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'attention') {
      if (self.status === 'reset') self.alert('please check login credentials at https://www.teslamotors.com/mytesla');
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if ((!!info.email) || (!!info.passphrase)) self.scan(self);
};
util.inherits(Cloud, require('./../device-gateway').Device);


Cloud.prototype.error = function(self, err, body) {
  var props = { diagnostic: err.message };

  if (!!body) props.body = body;
  self.status = (err.message.indexOf('connect') !== -1) ? 'error' : 'reset';
  self.changed();
  logger.error('device/' + self.deviceID, props);

  if (self.fails < 11) self.fails++;

  if (!!self.timer) clearTimeout(self.timer);
  self.timer = setTimeout(function() { self.scan(self); }, (self.fails + 1) * 600 * 1000);
};

Cloud.prototype.scan = function(self) {
  tesla.all({ email: self.info.email, password: self.info.passphrase }, function (error, response, body) {
    var data, i;

    if (error) return self.error(self, error, body);
    if (response.statusCode !== 200) return self.error(self, new Error('response statusCode ' + response.statusCode));
    try { data = JSON.parse(body); } catch(ex) { return self.error(self, ex, body); }
    if (!util.isArray(data)) return self.error(self, new Error('expecting an array from Tesla Motors cloud service'), body);
    self.status = 'ready';
    self.fails = 0;

    for (i = 0; i < data.length; i++) self.addvehicle(self, data[i]);
  });

  if (!!self.timer) clearTimeout(self.timer);
  self.timer = setTimeout(function() { self.scan(self); }, (self.fails + 1) * 600 * 1000);
};

Cloud.prototype.addvehicle = function(self, vehicle) {
  var color, colors, description, i, info, name, number, option, options, udn;

  udn = 'tesla:' + vehicle.id;
  if (!!devices.devices[udn]) return;

  colors = { PBSB : 'Black'
           , PBCW : 'Solid White'
           , PMSS : 'Silver'
           , PMTG : 'Dolphin gray metallic'
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
                , unit         : { serial      : vehicle.id
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/motive/tesla/model-s';
  info.id = info.device.unit.udn;

  logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial });
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


var chargers = {};

var getChargers = function() {
  var options;

  options = url.parse('https://raw.githubusercontent.com/kdwink/tesla_supercharger_map/master/webcontent/scripts/siteload/superchargers.txt');
  options.agent = false;

  https.request(options, function(response) {
    var body = '';

    response.setEncoding('utf8');
    response.on('data', function(data) {
      body += data.toString();
    }).on('end', function() {
      var record = null;

      var ready = function(site) {
        if ((!site) || (site.count === true) || ((!!site.status) && (site.status !== 'OPEN'))) return false;

        site.location = underscore.map(site.gps.split(','), function(part) { return part.trim(); });
        site.location.push(site.elevation);
        site.physical = site.street + ', ' + site.city + ', ';
        if (site.state !== '') site.physical += site.state + ' ';
        if (site.zip !== '?') site.physical += site.zip + ', ';
        site.physical += site.country;
        return true;
      };

      if (response.statusCode !== 200) {
        return logger.error('tesla-cloud', { event: 'http', code: response.statusCode, body: body });
      }

      underscore.each(body.toString().split('\n'), function(line) {
        var k, v, x;

        line = line.trim();
        if ((line.length === 0) || (line.charAt(0) === '#')) return;

        x = line.indexOf(':');
        if (x.length <= 2) return logger.error('tesla-cloud', { event: 'parse', diagnostic: 'invalid key in line: ' + line });

        k = line.substr(0, x).trim();
        v = line.substr(x + 1).trim();
        if (k === 'name') {
          if (ready(record)) chargers[record.name] = record;
          record = {};
        }
        record[k] = v;
      });
      if (ready(record)) chargers[record.name] = record;
    }).on('close', function() {
      logger.warning('tesla-cloud', { event:'http', diagnostic: 'premature eof' });
    });
  }).on('error', function(err) {
    logger.error('tesla-cloud', { event: 'http', diagnostic: err.message });
  }).end();
};


exports.start = function() {
  steward.actors.device.gateway.tesla = steward.actors.device.gateway.tesla ||
      { $info     : { type: '/device/gateway/tesla' } };

  steward.actors.device.gateway.tesla.cloud =
      { $info     : { type       : '/device/gateway/tesla/cloud'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'ready', 'error', 'reset' ]
                                   , email      : true
                                   , passphrase : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/tesla/cloud'] = Cloud;

  getChargers();
  setInterval(getChargers, 24 * 60 * 60 * 1000);

  utility.acquire2(__dirname + '/../*/*-tesla-*.js', function(err) {
    if (!!err) logger('tesla-cloud', { event: 'glob', diagnostic: err.message });
  });
};
