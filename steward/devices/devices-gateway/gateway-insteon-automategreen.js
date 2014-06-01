// exports.start = function() {}; return;

// Insteon hub:       http://www.insteon.com/2242-222-insteon-hub.html
// Insteon SmartLinc: http://www.insteon.com/2412N-smartlinc-central-controller.html
// Insteon PowerLinc: http://www.insteon.com/2413U-PowerLinc-USB.html

var Insteon     = require('home-controller').Insteon
  , serialport  = require('serialport')
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
  if (!!info.serialport) self.comName = info.serialport.comName; else self.portscan = info.portscan;
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
  var restart = function() {
    self.status = 'reset';
    self.changed();

    self.insteon = null;
    setTimeout(function() { self.setup(self); }, 5 * 1000);
  };

  if (!!self.refreshID) {
    clearTimeout(self.refreshID);
    self.refreshID = null;
  }

  self.insteon = new Insteon();
  self.status = 'waiting';
  self.changed();

  self.insteon.on('connect', function() {
    self.status = 'ready';
    self.changed();

    self.scan(self);
  }).on('command', function(command) {
    logger.warning('device/' + self.deviceID, { event: 'command', command: command });
  }).on('close', function(errP) {
    logger.warning('device/' + self.deviceID, { event: 'close', errP: errP });
    restart();
  }).on('error', function(err) {
    logger.error('device/' + self.deviceID, { event: 'background', diagnostic: err.message });
    restart();
  });

  if (!!self.comName) self.insteon.serial(self.comName); else self.insteon.connect(self.portscan.ipaddr, self.portscan.portno);
};

Gateway.prototype.scan = function(self) {
  self.refreshID = null;
  if (!self.insteon) return;

  try {
    self.insteon.links(function(err, links) {
      var i, id;

      if (!!err) return logger.error('device/' + self.deviceID, { event: 'links', diagnostic: err.message });

      if (typeof links === 'undefined') return;

      var f = function(id) {
        return function(err, info) {
          if (!!err) return logger.error('device/' + self.deviceID, { event: 'info', id: id, diagnostic: err.message });

            self.announce(self, info);
        };
      };

      for (i = 0; i < links.length; i++) {
        if (typeof links[i] === 'undefined') continue;
        id = links[i].id;

        if (!!self.seen[id]) continue;
        self.seen[id] = true;

        self.insteon.info(id, f(id));
      }
    });
  } catch(ex) { return self.emit('error', ex); }

  self.refreshID = setTimeout(function() { self.scan(self); }, 60 * 1000);
};

Gateway.prototype.announce = function(self, data) {
  var address, info, productCode;

  if ((!data) || (!data.deviceCategory) || (!data.deviceSubcategory)) {
    return logger.warning('device/' + self.deviceID, { event: 'unable to determine device category', data: data });
  }
  productCode = (new Buffer([data.deviceCategory.id, data.deviceSubcategory.id])).toString('hex');
  if (!deviceTypes[productCode]) {
    return logger.warning('device/' + self.deviceID,
                          { event: 'unable to determine product category for ' + productCode, data: data });
  }
  address = sixtoid(data.id);

  info = { source: self.deviceID, gateway: self };
  info.device = { url          : null
                , name         : 'Insteon ' + address
                , manufacturer : ''
                , model        : { name        : data.deviceCategory.name
                                 , description : data.productKey || ''
                                 , number      : data.deviceCategory.id + data.deviceSubcategory.id
                                 }
                , unit         : { serial      : data.id
                                 , udn         : 'insteon:' + address
                                 , address     : address
                                 }
                };
  info.url = info.device.url;
  info.deviceType = deviceTypes[productCode];
  info.id = info.device.unit.udn;
  if (!!devices.devices[info.id]) return;

  logger.info('device/' + self.deviceID, { id: sixtoid(data.id), category: data.deviceCategory.name });
  devices.discover(info);
};


var sixtoid = function(six) { return six.substr(0, 2) + ':' + six.substr(2, 2) + ':' + six.substr(4, 2); };

var pair = function(socket, ipaddr, portno, macaddr, tag) {
  var buffer = null, silentP = false;

  socket.setNoDelay();
  socket.on('data', function(data) {
    var address, deviceType, firmware, i, id, info, manufacturer, modelName, modelNo, message, productCode, x;

    buffer = (!!buffer) ? Buffer.concat([ buffer, data ]) : data;

    for (i = 0; i < buffer.length; i++) if (buffer[i] == 0x02) break;
    if (i !== 0) buffer = ((i + 1) < buffer.length) ? buffer.slice(i + 1) : null;
    if ((!buffer) || (buffer.length < 9)) return;

    socket.destroy();
    silentP = true;

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


var deviceTypes = {};

exports.pair = function(pairings) {
  var deviceType, entries, i;

  for (deviceType in pairings) {
    if (!pairings.hasOwnProperty(deviceType)) continue;
    entries = pairings[deviceType].entries;

    devices.makers[deviceType] = pairings[deviceType].maker;
    for (i = 0; i < entries.length; i++) deviceTypes[entries[i]] = deviceType;
  }
};


var scanning      = {};

var scan = function() {
  serialport.list(function(err, info) {
    var configuration, fingerprint, i, j;

    if (!!err) return logger2.error('insteon-automategreen', { diagnostic: err.message });

    configuration = utility.configuration.serialPorts && utility.configuration.serialPorts['insteon-automategreen'];
    if (!configuration) return;
    
    for (i = 0; i < info.length; i++) {
      fingerprint = configuration[info[i].comName];
      if (!fingerprint) continue;

      info[i].vendor = fingerprint.vendor;
      info[i].modelName = fingerprint.modelName;
      info[i].description = fingerprint.description;
      if (!info[i].vendorId)     info[i].vendorId     = fingerprint.vendorId;
      if (!info[i].productId)    info[i].productId    = fingerprint.productId;
      if (!info[i].manufacturer) info[i].manufacturer = fingerprint.manufacturer;
      if (!info[i].serialNumber) info[i].serialNumber = fingerprint.serialNumber;
      if (!info[i].serialNumber) {
        j = info[i].comName.lastIndexOf('-');
        if (j !== -1) info[i].serialNumber = info[i].comName.substr(j + 1);
      }
      scan1(info[i]);
    }
  });

  setTimeout(scan, 30 * 1000);
};

var scan1 = function(driver) {
  var buffer, comName, silentP, stream;

  comName = driver.comName;
  if (!!scanning[comName]) return;
  scanning[comName] = true;

  logger2.info(driver.comName, { manufacturer : driver.manufacturer
                               , vendorID     : driver.vendorId
                               , productID    : driver.productId
                               , serialNo     : driver.serialNumber
                               });
  buffer = null;
  silentP = false;

  stream = new serialport.SerialPort(comName, { baudrate: 19200, databits: 8, parity: 'none', stopbits: 1 });
  stream.on('open', function() {
    stream.write(new Buffer('0260', 'hex'));
  }).on('data', function(data) {
    var address, deviceType, firmware, i, id, info, manufacturer, modelName, modelNo, message, productCode, x;

    buffer = (!!buffer) ? Buffer.concat([ buffer, data ]) : data;

    for (i = 0; i < buffer.length; i++) if (buffer[i] == 0x02) break;
    if (i !== 0) buffer = ((i + 1) < buffer.length) ? buffer.slice(i + 1) : null;
    if ((!buffer) || (buffer.length < 9)) return;

    stream.close();
    silentP = true;

    if ((buffer[1] != 0x60) || (buffer[8] != 0x06)) {
      return logger.error(driver.comName, { event: 'response', content: buffer.toString('hex').toLowerCase() });
    }

    message = buffer.toString('hex').toLowerCase();
    id = message.substr(4, 6);
    address = sixtoid(id);
    productCode = message.substr(10, 4);
    deviceType = deviceTypes[productCode] || ('Insteon device ' + productCode);
    firmware = message.substr(14, 2) || null;

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

    info = { source: 'serialport', serialport: driver };
    info.device = { url          : null
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
    switch (productCode) {
      case '0315': info.deviceType += 'usb';       break;
      default:     info.deviceType += 'powerlinc'; break;
    }
    info.id = info.device.unit.udn;
    if (!!devices.devices[info.id]) return stream.close();

    logger2.info(driver.comName, { id: address, description: deviceType, firmware: firmware });
    devices.discover(info);
  }).on('error', function(error) {
    if (!silentP) logger2.warning(driver.comName, { event: 'error', error: error });
  }).on('end', function() {
    if (!silentP) logger2.info(driver.comName, { event: 'closing' });
  }).on('close', function(errorP) {
    if (!silentP) logger2.info(driver.comName, { event: errorP ? 'reset' : 'close' });
  });
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

  steward.actors.device.gateway.insteon.usb = utility.clone(steward.actors.device.gateway.insteon.hub);
  steward.actors.device.gateway.insteon.usb.$info.perform = [];
  steward.actors.device.gateway.insteon.usb.$info.type = '/device/gateway/insteon/usb';
  devices.makers['/device/gateway/insteon/usb'] = Gateway;

  steward.actors.device.gateway.insteon.powerlinc = utility.clone(steward.actors.device.gateway.insteon.hub);
  steward.actors.device.gateway.insteon.powerlinc.$info.type = '/device/gateway/insteon/powerlinc';
  devices.makers['/device/gateway/insteon/powerlinc'] = Gateway;

  utility.acquire2(__dirname + '/../*/*-insteon-*.js', function(err) {
    if (!!err) logger('insteon-automategreen', { event: 'glob', diagnostic: err.message });

    require('./../../discovery/discovery-portscan').pairing([ 9761 ], pair);
    scan();
  });
};
