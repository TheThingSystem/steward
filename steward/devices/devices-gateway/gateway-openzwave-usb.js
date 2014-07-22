// Open Z-Wave - using a USB stick

var openzwave
  , utility     = require('./../../core/utility')
  ;

try {
  openzwave = require('openzwave');
} catch(ex) {
  exports.start    = function() {};

  return utility.logger('devices').info('failing openzwave-usb gateway (continuing)', { diagnostic: ex.message });
}

var serialport  = require('serialport')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
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
  self.driver = info.driver;
  self.peripheral = info.peripheral;
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    var params;

    if (actor !== ('device/' + self.deviceID)) return;

    if (request !== 'perform') return;
    if (perform !== 'set') return;

    try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

    if (!!params.name) self.driver.setName(self.peripheral.nodeid, params.name);
    if (!!params.physical) self.driver.setLocation(self.peripheral.nodeid, params.physical);

    return (devices.perform(self, taskID, perform, parameter) || (!!params.physical));
  });
};
util.inherits(Gateway, require('./../device-gateway').Device);


Gateway.prototype.update = function(self, event, comclass, value) {
  logger.debug('device/' + self.deviceID, { event: event, comclass: comclass, value: value });
};


var manufacturers = {};
var pairings      = {};
var scanning      = {};

var scan = function() {
  serialport.list(function(err, info) {
    var configuration, fingerprint, i, j;

    if (!!err) return logger2.error('openzwave-usb', { diagnostic: err.message });

    configuration = utility.configuration.serialPorts && utility.configuration.serialPorts['openzwave-usb'];
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
  var comName, nodes, zwave;

  comName = driver.comName;
  if (!!scanning[comName]) return;
  scanning[comName] = true;

  nodes = [];

  logger2.info(driver.comName, { manufacturer : driver.manufacturer
                               , vendorID     : driver.vendorId
                               , productID    : driver.productId
                               , serialNo     : driver.serialNumber
                               });

  zwave = new openzwave(comName, {
    saveconfig: true,
    suppressrefresh: true,
    driverattempts: 3,
    pollinterval: 500
  });

  scanning[comName] = zwave;
  zwave.on('driver ready', function(homeid) {
    zwave.on('node added', function(nodeid) {
      nodes[nodeid] = { classes: {} };
    }).on('value added', function(nodeid, comclass, value) {
      if (!!nodes[nodeid].device) {
        return nodes[nodeid].device.device.update(nodes[nodeid].device.device, 'value added', comclass, value);
      }

      if (!nodes[nodeid].classes[comclass]) nodes[nodeid].classes[comclass] = {};
      nodes[nodeid].classes[comclass][value.index] = value;
    }).on('value changed', function(nodeid, comclass, value) {
      if (!!nodes[nodeid].device) {
        return nodes[nodeid].device.device.update(nodes[nodeid].device.device, 'value changed', comclass, value);
      }

      nodes[nodeid].classes[comclass][value.index] = value;
    }).on('value removed', function(nodeid, comclass, index) {
      if (!!nodes[nodeid].device) {
        return nodes[nodeid].device.device.update(nodes[nodeid].device.device, 'value removed', comclass, index);
      }

      try { delete(nodes[nodeid].classes[comclass][index]); } catch(ex) {}
    }).on('node ready', function(nodeid, nodeinfo) {
      var comclass, info, oops, props, udn;

      udn = 'openzwave:' + homeid.toString(16) + ':' + nodeid;
      if (!!devices.devices[udn]) return;

      props = utility.clone(nodeinfo);
      props.homeid = homeid.toString(16);
      props.nodeid = nodeid;
      oops = utility.clone(props);
      props.classes = nodes[nodeid].classes;
      nodes[nodeid] = props;

      info = { source: comName, driver: zwave, peripheral: nodes[nodeid] };
      info.device = { url          : null
                    , name         : props.name || props.product
                    , manufacturer : props.manufacturer
                    , model        : { name        : props.product
                                     , description : props.type
                                     , number      : props.producttype + '/' + props.productid
                                     }
                    , unit         : { serial      : ''
                                     , udn         : udn
                                     }
                    };
      info.url = info.device.url;
      info.deviceType = manufacturers[props.manufacturerid] && manufacturers[props.manufacturerid][props.productid];
      if (info.deviceType) {
        info.device.model.name = info.deviceType.name;
        info.deviceType = info.deviceType.deviceType;
      } else {
        for (comclass in props.classes) {
          if ((!props.classes.hasOwnProperty(comclass)) || (!pairings[comclass])) continue;
          info.deviceType = pairings[comclass];
          break;
        }
      }
      info.id = info.device.unit.udn;
      if (!info.deviceType) {
        oops.event = 'discovery';
        oops.diagnostic = 'no deviceType';
        return logger2.warning(info.id, oops);
      }
      if (!!devices.devices[info.id]) return;

      logger2.info(info.id, { manufacturer : props.manufacturer
                            , product      : props.product
                            , type         : props.type
                            });
      devices.discover(info, function(err, deviceID) {
        if (!!err) return logger2.debug(info.id, { event: 'discover', udn: udn, diagnostic: err.message });
        if (!!deviceID) nodes[nodeid].device = devices.devices[info.id];
      });
    }).on('notification', function(nodeid, value) {
      var values = { 0 : 'message complete'
                   , 1 : 'timeout'
                   , 2 : 'nop'
                   , 3 : 'awake'
                   , 4 : 'sleeping'
                   , 5 : 'dead'
                   , 6 : 'alive'
                   };

      if (!!nodes[nodeid].device) {
        return nodes[nodeid].device.device.update(nodes[nodeid].device.device, 'notification', '', value);
      }

      logger2.debug(comName, { event: 'notification', network: homeid, node: nodeid, status: values[value] || value });
    });
  }).on('driver failed', function() {
    driver.diagnostic = 'driver failed';
    logger2.error(comName, driver);
    zwave.disconnect();
    delete(scanning[comName]);
  }).on('scan complete', function() {
  }).connect();
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

  if ((!params.name) && (!params.physical)) result.requires.push('name');

  return result;
};


var classes =
{ 0x00 : 'no operation'
, 0x20 : 'basic'
, 0x21 : 'controller replication'
, 0x22 : 'application status'
, 0x25 : 'switch binary'
, 0x26 : 'switch multilevel'
, 0x27 : 'switch all'
, 0x28 : 'switch toggle binary'
, 0x29 : 'switch toggle multilevel'
, 0x2b : 'sceneactivation'
, 0x30 : 'sensor binary'
, 0x31 : 'sensor multilevel'
, 0x32 : 'meter'
, 0x35 : 'meter pulse'
, 0x40 : 'thermostat mode'
, 0x42 : 'thermostat operating state'
, 0x43 : 'thermostat setpoint'
, 0x44 : 'thermostat fan mode'
, 0x45 : 'thermostat fan state'
, 0x46 : 'climate control schedule'
, 0x50 : 'basic window covering'
, 0x56 : 'crc 16 encap'
, 0x60 : 'multi instance'
, 0x63 : 'user code'
, 0x70 : 'configuration'
, 0x71 : 'alarm'
, 0x72 : 'manufacturer specific'
, 0x73 : 'powerlevel'
, 0x75 : 'protection'
, 0x76 : 'lock'
, 0x77 : 'node naming'
, 0x80 : 'battery'
, 0x81 : 'clock'
, 0x82 : 'hail'
, 0x84 : 'wake up'
, 0x85 : 'association'
, 0x86 : 'version'
, 0x87 : 'indicator'
, 0x88 : 'proprietary'
, 0x89 : 'language'
, 0x8e : 'multi instance association'
, 0x8f : 'multi command'
, 0x90 : 'energy production'
, 0x9b : 'association command configuration'
, 0x9c : 'sensor alarm'
};

exports.pair = function(commandClass, deviceType) {
  if (!classes[commandClass]) {
    logger2.warning('gateway-openzwave',
                    { diagnostic: 'unknown Z-Wave command class', commandClass: commandClass, deviceType: deviceType });
  }

  pairings[commandClass] = deviceType;
};


var fingerprints  =
  [ { mID        : '0086'
    , pID        : '0001'
    , modelName  : 'Z-Stick S2'
    , deviceType : '/device/gateway/aeotec/usb'
    }
  , { mID        : '0086'
    , pID        : '0025'
    , modelName  : 'Range Extender'
    , deviceType : '/device/gateway/aeotec/wireless'
    }
  ];

exports.start = function() {
  var i, parts, prefix, product, suffix;

  steward.actors.device.gateway.openzwave = steward.actors.device.gateway.openzwave ||
      { $info     : { type: '/device/gateway/openzwave' } };

  steward.actors.device.gateway.openzwave.usb =
      { $info     : { type       : '/device/gateway/openzwave/usb'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name     : true
                                   , status   : [ 'ready' ]
                                   , physical : true
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/openzwave/usb'] = Gateway;

  for (i = 0; i < fingerprints.length; i++) {
    product = fingerprints[i];

    parts = product.deviceType.split('/');
    prefix = parts[3];
    suffix = parts[4];

    steward.actors.device.gateway[prefix] =
      steward.actors.device.gateway[prefix] || utility.clone(steward.actors.device.gateway.openzwave);
    delete(steward.actors.device.gateway[prefix].usb);
    steward.actors.device.gateway[prefix].$info.type = parts.slice(0, -1).join('/');

    steward.actors.device.gateway[prefix][suffix] = utility.clone(steward.actors.device.gateway.openzwave.usb);
    steward.actors.device.gateway[prefix][suffix].$info.type = product.deviceType;
    devices.makers[product.deviceType] = Gateway;

    if (!manufacturers[product.mID]) manufacturers[product.mID] = {};
    manufacturers[product.mID][product.pID] = { name: product.modelName, deviceType: product.deviceType };
  }

  process.on('exit', function() {
    var comName;

    for (comName in scanning) if (scanning.hasOwnProperty(comName)) { try { scanning[comName].disconnect(); } catch(ex) {} }
  });

  utility.acquire2(__dirname + '/../*/*-zwave-*.js', function(err) {
    if (!!err) logger('openzwave-usb', { event: 'glob', diagnostic: err.message });

    scan();
  });
};
