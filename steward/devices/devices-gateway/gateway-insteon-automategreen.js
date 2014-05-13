exports.start = function() {}; return;

// Insteon hub: http://www.insteon.com/2242-222-insteon-hub.html
// Insteon SmartLinc: http://www.insteon.com/2412N-smartlinc-central-controller.html

var Insteon     = require('home-controller').Insteon
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  ;


var logger  = exports.logger = utility.logger('gateway');
var logger2                  = utility.logger('discovery');


var Gateway = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'ready';
  self.changed();
  self.portscan = info.portscan;
  self.refreshID = null;
  self.seen = {};
  self.setup(self);

  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Gateway, require('./../device-gateway').Device);
Gateway.prototype.perform = devices.perform;

Gateway.prototype.setup = function(self) {
  if (!!self.refreshID) {
    clearTimeout(self.refreshID);
    self.refreshID = null;
  }

  self.insteon = new Insteon().on('connect', function() {
    self.scan(self);
  }).on('command', function(command) {
    logger.warning('device/' + self.device, { event: 'command', command: command });
  }).on('close', function() {
    logger.warning('device/' + self.device, { event: 'close' });

    setTimeout(function() { self.setup(self); }, 5 * 1000);
  }).on('error', function(err) {
    logger.error('device/' + self.device, { event: 'background', diagnostic: err.message });
  });

  self.insteon.connect(self.portscan.ipaddr, self.portscan.portno);
};

Gateway.prototype.scan = function(self) {
  self.insteon.links(function(err, links) {
    var i, id;

    if (!!err) return logger.error('device/' + self.device, { event: 'links', diagnostic: err.message });

    var f = function(id) {
      return function(err, info) {
        if (!!err) return logger.error('device/' + self.device, { event: 'info', id: id, diagnostic: err.message });

        self.announce(self, info);
      };
    };

    for (i = 0; i < links.length; i++) {
      id = links[i].id;

      if (!!self.seen[id]) continue;
      self.seen[id] = true;

      self.insteon.info(id, f(id));
    }
  });

  self.refreshID = setInterval(function() { self.scan(self); }, 60 * 1000);
};

Gateway.prototype.announce = function(self, data) {
  var deviceType, info;

console.log('>>> data');
console.log(util.inspect(data, { depth: null }));

  if ((!data.deviceCategory) || (!data.device.subCategory)) {
    return logger.warning('device/' + self.deviceID, { event: 'unable to determine deviceType', data: data });
  }
  deviceType = 'Insteon.' + (new Buffer([data.deviceCategory.id, data.deviceSubcategory.id])).toString('hex');

  info = { source: self.deviceID, gateway: self };
  info.device = { url          : null
                , name         : 'Insteon ' + sixtoid(data.id)
                , manufacturer : ''
                , model        : { name        : data.deviceCategory.name
                                 , description : data.productKey
                                 , number      : data.deviceCategory.id + data.deviceSubCategory.id
                                 }
                , unit         : { serial      : data.id
                                 , udn         : 'insteon:' + sixtoid(data.id)
                                 }
                };
  info.url = info.device.url;
  info.deviceType = deviceType;
  info.id = info.device.unit.udn;
  if (!!devices.devices[info.id]) return;

  logger.info('device/' + self.deviceID, { id: sixtoid(data.id), productKey: data.productKey });
  devices.discover(info);
};


var sixtoid = function(six) { return six.substr(0, 2) + ':' + six.substr(2, 2) + ':' + six.substr(4, 2); };

var pair = function(socket, ipaddr, portno, macaddr, tag) {
  var buffer = null, silentP = false;

  socket.setNoDelay();
  socket.on('data', function(data) {
    var address, deviceType, firmware, i, id, info, manufacturer, modelName, modelNo, message, productCode, x;

    buffer = !!buffer ? Buffer.concat([ buffer, data ]) : data;

    for (i = 0; i < buffer.length; i++) if (buffer[i] == 0x02) break;
    if (i !== 0) buffer = ((i + 1) < buffer.length) ? buffer.slice(i + 1) : null;
    if ((!buffer) || (buffer.length < 9)) return;

    socket.setTimeout(0);
    silentP = true;

    socket.destroy();
    if ((buffer[1] != 0x60) || (buffer[8] != 0x06)) {
      logger.error('PORT ' + ipaddr + ':' + portno, { event: 'response', content: buffer.toString('hex').toLowerCase() });
      return;
    }

    message = buffer.toString('hex').toLowerCase();
    id = message.substr(4, 6);
    address = sixtoid(id);
    productCode = message.substr(10, 4);
    deviceType =  { '0004' : 'ControlLinc [2430]'
                  , '0005' : 'RemoteLinc [2440]'
                  , '0006' : 'Icon/Tabletop Controller [2830]'
                  , '0008' : 'EZBridge/EZServer'
                  , '0009' : 'SignalLinc RF Signal Enhancer [2442]'
                  , '000a' : 'Balboa Instruments/Poolux LCD Controller'
                  , '000b' : 'Access Point [2443]'
                  , '000c' : 'IES/Color Touchscreen'
                  , '000d' : 'SmartLabs/KeyFOB'
                  , '0010' : 'Mini Remote - 4 Scene [2444A2WH4]'
                  , '0011' : 'Mini Remote - Switch [2444A3]'
                  , '0012' : 'Mini Remote - 8 Scene [2444A2WH8]'
                  , '0014' : 'Mini Remote - 4 Scene [2342-432]'
                  , '0015' : 'Mini Remote - Switch [2342-442]'
                  , '0016' : 'Mini Remote - 8 Scene [2342-422]'
                  , '0017' : 'Mini Remote - 4 Scene [2342-532]'
                  , '0018' : 'Mini Remote - 8 Scene [2342-522]'
                  , '0019' : 'Mini Remote - Switch [2342-542]'
                  , '001a' : 'Mini Remote - 4 Scene [2342-222]'
                  , '001b' : 'Mini Remote - 8 Scene [2342-232]'
                  , '001c' : 'Mini Remote - Switch [2342-242]'
                  , '001d' : 'Range Extender [2992-222]'
                  }[productCode] || ('Insteon device ' + productCode);
    firmware = message.substr(14, 2) || null;
/* would prefer to use

       'uuid:2f402f80-da50-11e1-9b23-' + macaddr.split(':').join('')

   as serialNo, but the mac address seems to alternate?!?
 */

    manufacturer = 'Insteon';
    modelName = deviceType;
    modelNo = '';
    x = modelName.indexOf('/');
    if (x > 0) {
      manufacturer = modelName.substr(0, x - 1);
      modelName = modelName.substr(x + 1);
    }
    x = modelName.indexOf('[');
    if (x > 0) {
      modelNo = modelName.substring(x + 1, modelName.length - 1);
      modelName = modelName.substr(0, x - 1).trimRight();
    }

    info = { source: 'portscan', portscan: { ipaddr: ipaddr, portno: portno } };
    info.device = { url          : 'tcp://' + ipaddr + ':' + portno
                  , name         : modelName + ' ' + address
                  , manufacturer : manufacturer
                  , model        : { name        : 'Insteon.' + productCode
                                   , description : deviceType
                                   , number      : modelNo
                                   }
                  , unit         : { serial      : id
                                   , udn         : 'insteon:' + address
                                   , address     : address
                                   , firmware    : firmware
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = '/device/gateway/insteon/';
    info.deviceType += { '032e' : 'hub'
                       , '032f' : 'hub'
                       , '0330' : 'hub'
                       , '0331' : 'hub'
                       , '0332' : 'hub'
                       , '0333' : 'hub'
                       , '0334' : 'hub'
                       , '0335' : 'hub'
                       , '0336' : 'hub'
                       , '0337' : 'hub'
                       }[productCode] || 'smartlinc';
    info.id = info.device.unit.udn;
    if (!!devices.devices[info.id]) return;

    logger2.info(tag, { id: address, description: deviceType, firmware: firmware });
    devices.discover(info);
  }).on('error', function(error) {
    if (!silentP) logger2.warning(tag, { event: 'error', error: error });
  }).on('timeout', function() {
    if (!silentP) logger2.info(tag, { event: 'timeout' });
  }).on('end', function() {
    if (!silentP) logger2.info(tag, { event: 'closing' });
  }).on('close', function(errorP) {
    if (!silentP) logger2.info(tag, { event: errorP ? 'reset' : 'close' });
  }).write(new Buffer('0260', 'hex'));
  socket.setTimeout(3 * 1000);
};


exports.start = function() {
  steward.actors.device.gateway.insteon = steward.actors.device.gateway.insteon ||
      { $info     : { type: '/device/gateway/insteon' } };

  steward.actors.device.gateway.insteon.hub =
      { $info     : { type       : '/device/gateway/insteon/hub'
                    , observe    : [ ]
                    , perform    : [ 'wake' ]
                    , properties : { name   : true
                                   , status : [ 'waiting', 'ready', 'reset' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/insteon/hub'] = Gateway;

  steward.actors.device.gateway.insteon.smartlinc = utility.clone(steward.actors.device.gateway.insteon.hub);
  steward.actors.device.gateway.insteon.smartlinc.$info.type = '/device/gateway/insteon/smartlinc';
  devices.makers['/device/gateway/insteon/smartlinc'] = Gateway;

  steward.actors.device.gateway.insteon.powerlinc = utility.clone(steward.actors.device.gateway.insteon.hub);
  steward.actors.device.gateway.insteon.powerlinc.$info.type = '/device/gateway/insteon/powerlinc';
  devices.makers['/device/gateway/insteon/powerlinc'] = Gateway;

  utility.acquire2(__dirname + '/../*/*-insteon-*.js', function(err) {
    if (!!err) logger('insteon-9761', { event: 'glob', diagnostic: err.message });

    require('./../../discovery/discovery-portscan').pairing([ 9761 ], pair);
  });
};
