// RFXtrx433 - USB 433.92MHz transceiver: http://www.rfxcom.com/store/Transceivers/12103
// RFXrec433 - USB 433.92MHz receiver: http://www.rfxcom.com/store/Receivers/12113

var rfxcom      = require('rfxcom')
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
  self.rfx = info.rfx;
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });

  self.rfx.logger = utility.logfnx(logger, 'device/' + self.deviceID);
  self.rfx.on('response',  function(type, seqno) {
    logger.debug('device/' + self.deviceID, { event: 'response',  type:   type, seqno: seqno });
  }).on('status',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'status',    params: evt });
  }).on('elec2',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'elec2',     params: evt });
  }).on('security1',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'security1', params: evt });
  }).on('temp1',  function(evt) { self.tempX(self, evt);
  }).on('temp2',  function(evt) { self.tempX(self, evt);
  }).on('temp3',  function(evt) { self.tempX(self, evt);
  }).on('temp4',  function(evt) { self.tempX(self, evt);
  }).on('temp5',  function(evt) { self.tempX(self, evt);
  }).on('temp6',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'th6',       params: evt });  // Clas Ohlson
  }).on('temp7',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'th7',       params: evt });  // Clas Ohlson
  }).on('temp8',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'th8',       params: evt });  // Clas Ohlson
  }).on('temp9',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'th9',       params: evt });  // Clas Ohlson
  }).on('th1',  function(evt) { self.thX(self, evt);
  }).on('th2',  function(evt) { self.thX(self, evt);
  }).on('th3',  function(evt) { self.thX(self, evt);
  }).on('th4',  function(evt) { self.thX(self, evt);
  }).on('th5',  function(evt) { self.thX(self, evt);
  }).on('th6',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'th9',       params: evt });
  }).on('th7',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'th7',       params: evt });
  }).on('th8',  function(evt) { self.thX(self, evt);
  }).on('th9',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'th9',       params: evt });
  }).on('lighting1',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'lighting1', params: evt });
  }).on('lighting2',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'lighting2', params: evt });
  }).on('lighting5',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'lighting5', params: evt });
  }).on('data',  function(data) {
    logger.debug('device/' + self.deviceID, { event: 'data',      params: data.toString('hex') });
  }).on('receive',  function(data) {
    logger.debug('device/' + self.deviceID, { event: 'receive',   params: data.toString('hex') });
  }).initialise(function(err, results) {
    if (!!err) return logger.error('rfxcom-usb', { event: 'initialize', diagnostic: err.message });
    logger.info('device/' + self.deviceID,  { event: 'initialize', results: results });
  });
};
util.inherits(Gateway, require('./../device-gateway').Device);
Gateway.prototype.perform = devices.perform;


Gateway.prototype.thX = function(self, evt) {
  var info, name, params, sensor, udn;

  params = { lastSample   : new Date().getTime()
           , temperature  : (!!evt.temperature)  ? evt.temperature                               : null
           , humidity     : (!!evt.humidity)     ? evt.humidity                                  : null
           , batteryLevel : (!!evt.batteryLevel) ? devices.percentageValue(evt.batteryLevel, 15) : null
           , rssi         : (!!evt.rssi)         ? devices.percentageValue(evt.rssi, 15)         : null
           };

  udn = 'rfxcom:th:' + evt.id;
  if (!!devices.devices[udn]) {
    sensor = devices.devices[udn].device;
    if (!sensor) return;

    return sensor.update(sensor, params);
  }

  name = (!!evt.humidity) ? 'Thermo-Hygro Sensor' : 'Temperature Sensor';

  info =  { source: self.deviceID, gateway: self, params: params };
  info.device = { url                          : null
                , name                         : name + ' #' + evt.id
                , manufacturer                 : { 8: 'Clas Ohlson' }[evt.subtype.toString()] || 'Oregon Scientific'
                , model        : { name        : name
                                 , description : ''
                                 , number      : evt.subtype
                                 }
                , unit         : { serial      : evt.id
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/climate/oregon-scientific/meteo';
  info.id = info.device.unit.udn;

  logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: params });
  devices.discover(info);
  self.changed();
};
Gateway.prototype.tempX = Gateway.prototype.thX;

/*
Gateway.prototype.lighting2 = function(self, evt) {
  var gateway, info, lights, name, params, udn;

  params = { lastSample   : new Date().getTime()
           , status       : (!!evt.command) ? ((evt.command == 1) || (evt.command == 4) ? 'on' : 'off') : null
           , brightness   : (!!evt.level)   ? devices.percentageValue(evt.level, 15)                    : null
           , rssi         : (!!evt.rssi)    ? devices.percentageValue(evt.rssi, 15)                     : null
           };

  udn = 'rfxcom:lighting2:' + evt.id;
  if (!!devices.devices[udn]) {
    lights = devices.devices[udn].device;
    return lights.update(lights, params);
  }

  name = evt.subtype || 'Siemens';

  gateway = new rfxcom.Lighting2(self.rfx, { AC           : rfxcom.lighting2.AC
                                           , 'HomeEasy EU': rfxcom.lighting2.HOMEEASY_EU
                                           , ANSLUT       : rfxcom.lighting2.ANSLUT }[evt.subtype] || 0);

  info =  { source: self.deviceID, gateway: gateway, params: params };
  info.device = { url                          : null
                , name                         : name + ' #' + evt.id
                , manufacturer                 : 'Siemens'
                , model        : { name        : name
                                 , description : ''
                                 , number      : ''
                                 }
                , unit         : { serial      : evt.id
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/lighting/siemens/bulb';
  info.id = info.device.unit.udn;

  logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: params });
  devices.discover(info);
  self.changed();
};
 */

var fingerprints  =
  [
    { vendor         : 'RFXCOM'
    , modelName      : 'RFXtrx433'
    , description    : 'USB 433.92MHz transceiver'
    , manufacturer   : 'RFXCOM'
    , vendorId       : 0x0403
    , productId      : 0x6001
    , pnpId          : 'usb-RFXCOM_RFXtrx433_'
    , deviceType     : '/device/gateway/rfxcom/usb'
    }
  , { vendor         : 'RFXCOM'
    , modelName      : 'RFXrec433'
    , description    : 'USB 433.92MHz receiver'
    , manufacturer   : 'RFXCOM'
    , vendorId       : 0x0403
    , productId      : 0x6001
    , pnpId          : 'usb-RFXCOM_RFXrec433_'
    , deviceType     : '/device/gateway/rfxcom/usb'
    }
  ];

var scan = function() {
  devices.scan_usb(logger2, 'rfxcom-usb', fingerprints, function(driver, callback) {
    var comName, info, rfx, udn;

    comName = driver.comName;
    udn = 'rfxcom:' + driver.serialNumber;
    if (!!devices.devices[udn]) return callback();

    rfx = new rfxcom.RfxCom(comName, { debug: true, logger: logger2 });
    callback();

    info = { source: driver, rfx: rfx };
    info.device = { url          : null
                  , name         : driver.modelName + ' #' + driver.serialNumber
                  , manufacturer : driver.manufacturer
                  , model        : { name        : driver.modelName
                                   , description : driver.description
                                   , number      : driver.productId
                                   }
                  , unit         : { serial      : driver.serialNumber
                                   , udn         : udn
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = driver.deviceType;
    info.id = info.device.unit.udn;
    if (!!devices.devices[info.id]) return;

    logger2.info(comName, { manufacturer : driver.manufacturer
                          , vendorID     : driver.vendorId
                          , productID    : driver.productId
                          , serialNo     : driver.serialNumber
                          });
    devices.discover(info);
  });

  setTimeout(scan, 30 * 1000);
};


exports.start = function() {
  steward.actors.device.gateway.rfxcom = steward.actors.device.gateway.rfxcom ||
      { $info     : { type: '/device/gateway/rfxcom' } };

  steward.actors.device.gateway.rfxcom.usb =
      { $info     : { type       : '/device/gateway/rfxcom/usb'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'ready' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/rfxcom/usb'] = Gateway;

  scan();
};
