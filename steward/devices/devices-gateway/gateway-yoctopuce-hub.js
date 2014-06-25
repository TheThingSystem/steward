// YoctoHub-Ethernet: http://www.yoctopuce.com/EN/products/extensions-and-networking/yoctohub-ethernet
// YoctoHub-Wireless: http://www.yoctopuce.com/EN/products/extensions-and-networking/yoctohub-wireless
// VirtualHub:        http://www.yoctopuce.com/EN/virtualhub.php

var url         = require('url')
  , util        = require('util')
  , yapi        = require('yoctolib')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , discovery   = require('./../../discovery/discovery-ssdp')
  , sensors     = require('./../devices-sensor/sensor-yoctopuce-4-20mA-Rx')
  ;


var logger   = exports.logger = utility.logger('gateway');

var modules  = {};
var products = {};


var Hub = exports.Device = function(deviceID, deviceUID, info) {
  var diagnostic, result;

  var self = this;

  self.whatami = { 'VirtualHub'        : '/device/gateway/yoctopuce/virtual'
                 , 'YoctoHub-Ethernet' : '/device/gateway/yoctopuce/ethernet'
                 , 'YoctoHub-Wireless' : '/device/gateway/yoctopuce/wireless'
                 }[info.deviceType] || info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'ready';
  self.changed();
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });

  result = yapi.yRegisterHub(self.url);
  if (result != yapi.YAPI_SUCCESS) return logger.error('device/' + self.deviceID, { event: 'yRegisterHub', result: result });

/*
  yapi.yUpdateDeviceList();
  setTimeout(function() {
    var module;

    for (module = yapi.yFirstModule(); !!module; module = module.nextModule()) self.addstation(module);
  }, 0);
 */
  diagnostic = null;
  result = yapi.yPreregisterHub(self.url, diagnostic, diagnostic, false);
  if (result != yapi.YAPI_SUCCESS) {
    return logger.error('device/' + self.deviceID, { event: 'yPreregisterHub', result: result, diagnostic: diagnostic });
  }

  yapi.yUpdateDeviceList_async(function (context, result, diagnostic) {
    var module;

    if (result != yapi.YAPI_SUCCESS) {
      return logger.error('device/' + self.deviceID,
                          { event: 'yUpdateDeviceList_async', result: result, diagnostic: diagnostic });
    }
    for (module = yapi.yFirstModule(); !!module; module = module.nextModule()) self.addstation(module);
  }, null);
};
util.inherits(Hub, require('./../device-gateway').Device);
Hub.prototype.perform = devices.perform;


Hub.prototype.addstation = function(module) {
  var info, modelNumber, productName, serialNumber, suffix, x;

  var self = this;

  serialNumber = module.get_serialNumber();
  if (!!modules[serialNumber]) return;

  productName = module.get_productName();
  suffix =  (productName.indexOf('Yocto-') !== 0) ? productName : productName.substring(6);

  x = serialNumber.indexOf('-');
  if (x !== -1) modelNumber = serialNumber.substring(0, x);

  switch (productName) {
    case 'VirtualHub':
    case 'YoctoHub-Ethernet':
    case 'YoctoHub-Wireless':
      return;

    case 'Yocto-4-20mA-Rx':
      modules[serialNumber] = productName;
      return self.addsensor(self, module, modelNumber, productName, serialNumber);

    default:
      modules[serialNumber] = productName;
      if (!!products[productName]) break;
      return logger.warning('device/' + self.deviceID, { event: 'unknown module', result: productName });
  }

  info =  { source: self.deviceID, gateway: self, module: module };
  info.device = { url                          : null
                , name                         : module.get_logicalName() || productName
                , manufacturer                 : 'Yoctopuce'
                , model        : { name        : productName
                                 , description : ''
                                 , number      : modelNumber
                                 }
                , unit         : { serial      : serialNumber
                                 , udn         : 'yoctopuce:' + serialNumber
                                 }
                };
  info.url = info.device.url;
  info.deviceType = products[productName];
  info.id = info.device.unit.udn;

  logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial, type: productName });
  devices.discover(info);
  self.changed();
};

Hub.prototype.addsensor = function(self, module, modelNumber, productName, serialNumber) {
  var i, info, name, parts, sensor, sensorID, sensorQ, value;

  for (i = 1; i < 3; i++) {
    sensorID = '.genericSensor' + i;
    sensor = yapi.yFindGenericSensor(serialNumber + sensorID);

    name = sensor.get_logicalName();
    if (name === yapi.Y_LOGICALNAME_INVALID) {
      logger.error('device/' + self.deviceID, { event      : 'get_logicalName'
                                              , sensorID   : sensorID
                                              , diagnostic : 'logicalName invalid' });
      continue;
    }

    value  = sensor.get_currentValue();
    if (value < 0) {
      logger.warning('device/' + self.deviceID, { event        : 'addsensor'
                                                , sensorID     : sensorID
                                                , logicalName  : name
                                                , currentValue : value
                                                , diagnostic   : 'currentValue unusable' });
      continue;
    }

    sensorQ = sensor.get_unit();
    if (sensorQ === yapi.Y_UNIT_INVALID) {
      logger.warning('device/' + self.deviceID, { event       : 'get_unit'
                                                , sensorID    : sensorID
                                                , diagnostic  : 'unit unusable' });
      continue;
    }
    parts = sensorQ.split('-');
    sensorQ = parts[parts.length - 1].toLowerCase();

    sensors.prime(sensorQ);

    info =  { source: self.deviceID, gateway: self, module: module, sensorQ: sensorQ, params: {}  };
    info.device = { url                          : null
                  , name                         : name || productName
                  , manufacturer                 : 'Yoctopuce'
                  , model        : { name        : productName
                                   , description : ''
                                   , number      : modelNumber
                                   }
                  , unit         : { serial      : serialNumber + sensorID
                                   , udn         : 'yoctopuce:' + serialNumber + sensorID
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = '/device/sensor/yoctopuce/' + sensorQ;
    info.id = info.device.unit.udn;
    info.params[sensorQ] = value;

    logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial, type: sensorQ });
    devices.discover(info);
    self.changed();
  }
};


exports.validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'wake') return result;

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }

  if ((!!params.name) && (!yapi.yCheckLogicalName(params.name))) result.invalid.push('name');

  return result;
};


exports.register = function(productName, deviceType) {
  products[productName] = deviceType;
};


exports.start = function() {
  yapi.yDisableExceptions();

  steward.actors.device.gateway.yoctopuce = steward.actors.device.gateway.yoctopuce ||
      { $info     : { type: '/device/gateway/yoctopuce' } };

  steward.actors.device.gateway.yoctopuce.ethernet =
      { $info     : { type       : '/device/gateway/yoctopuce/ethernet'
                    , observe    : [ ]
                    , perform    : [ 'wake' ]
                    , properties : { name   : true
                                   , status : [ 'ready' ]
                                   }
                    }
      , $validate : { perform    : exports.validate_perform
                    }
      };
  devices.makers['YoctoHub-Ethernet'] = Hub;

  steward.actors.device.gateway.yoctopuce.wireless = utility.clone(steward.actors.device.gateway.yoctopuce.ethernet);
  steward.actors.device.gateway.yoctopuce.wireless.$info.type = '/device/gateway/yoctopuce/wireless';
  devices.makers['YoctoHub-Wireless'] = Hub;

  steward.actors.device.gateway.yoctopuce.virtual = utility.clone(steward.actors.device.gateway.yoctopuce.ethernet);
  steward.actors.device.gateway.yoctopuce.virtual.$info.type = '/device/gateway/yoctopuce/virtual';
  devices.makers.VirtualHub = Hub;

  utility.acquire2(__dirname + '/../*/*-yoctopuce-*.js', function(err) {
    if (!!err) logger('yoctopuce-hub', { event: 'glob', diagnostic: err.message });

    scan();
  });
};

// if VirtualHub is running locally, we won't see it via SSDP, so:
var scan = function() {
  discovery.ssdp_discover({ http   : { major: '1', minor: '1', code: '200' }
                          , source : 'ssdp'
                          , ssdp   : { LOCATION : 'http://127.0.0.1:4444/ssdp.xml', ST: 'upnp:rootdevice' }
                          , device : { }
                          }, url.parse('http://127.0.0.1:4444/ssdp.xml'), function(err) {
    if (!!err) return setTimeout(scan, 30 * 1000);
  });
};
