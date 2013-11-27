// RFXrec433 - USB 433.92MHz receiver: http://www.rfxcom.com/store/Receivers/12113

var rfxcom      = require('rfxcom')
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
  }).on('th1',  function(evt) { self.thX(self, evt);
  }).on('th2',  function(evt) { self.thX(self, evt);
  }).on('th3',  function(evt) { self.thX(self, evt);
  }).on('th4',  function(evt) { self.thX(self, evt);
  }).on('th5',  function(evt) { self.thX(self, evt);
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
  }).initialise(function() {
    logger.info('device/' + self.deviceID,  { event: 'initialize' });
  });
};
util.inherits(Gateway, require('./../device-gateway').Device);


Gateway.prototype.thX = function(self, evt) {
  var info, name, params, sensor, udn;

  params = { lastSample  : new Date().getTime()
           , temperature : (!!evt.temperature) ? evt.temperature : null
           , humidity    : (!!evt.humidity)    ? evt.humidity    : null
           };

  udn = 'rfxcom:th:' + evt.id;
  if (!!devices.devices[udn]) {
    sensor = devices.devices[udn].device;
    return sensor.update(sensor, params);
  }

  name = (!!evt.humidity) ? 'Thermo-Hygro Sensor' : 'Temperature Sensor';

  info =  { source: self.deviceID, gateway: self, params: params };
  info.device = { url                          : null
                , name                         : name + ' #' + evt.id
                , manufacturer                 : 'Oregon Scientific'
                , model        : { name        : name
                                 , description : ''
                                 , number      : evt.subtype
                                 }
                , unit         : { serial      : evt.id
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/climate/oregon-scientific/sensor';
  info.id = info.device.unit.udn;

  logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial,  params: params });
  devices.discover(info);
  self.changed();
};
Gateway.prototype.tempX = Gateway.prototype.thX;


var scanning      = {};

var fingerprints  =
  [
    { vendor         : 'RFXCOM'
    , modelName      : 'RFXtrx433'
    , description    : 'USB 433.92MHz transceiver'
    , manufacturer   : 'RFXCOM'
    , vendorId       : 0x0403
    , productId      : 0x6001
    , deviceType     : '/device/gateway/rfxtrx433/usb'
    }
  , { vendor         : 'RFXCOM'
    , modelName      : 'RFXrec433'
    , description    : 'USB 433.92MHz receiver'
    , manufacturer   : 'RFXCOM'
    , vendorId       : 0x0403
    , productId      : 0x6001
    , pnpId          : 'usb-RFXCOM_RFXrec433_'
    , deviceType     : '/device/gateway/rfxrec433/usb'
    }
  ];

var scan = function() {
  serialport.list(function(err, info) {
    var i, j;

    if (!!err) return logger2.error('RFXrec433-usb', { diagnostic: err.message });

    for (i = 0; i < info.length; i++) {
      for (j = fingerprints.length - 1; j !== -1; j--) {
        if ((info[i].pnpId.indexOf(fingerprints[j].pnpId) === 0)
              || ((     fingerprints[j].manufacturer === info[i].manufacturer)
                    && (fingerprints[j].vendorId     === parseInt(info[i].vendorId, 16))
                    && (fingerprints[j].productId    === parseInt(info[i].productId, 16)))) {
          info[i].vendor = fingerprints[j].vendor;
          info[i].modelName = fingerprints[j].modelName;
          info[i].description = fingerprints[j].description;
          info[i].deviceType = fingerprints[j].deviceType;
          scan1(info[i]);
        }
      }
    }
  });

  setTimeout(scan, 30 * 1000);
};

var scan1 = function(driver) {
  var comName, info, rfx, udn;

  comName = driver.comName;
  if (!!scanning[comName]) return;
  scanning[comName] = true;

  udn = 'rfxcom:' + driver.serialNumber;
  if (!!devices.devices[udn]) return;

  rfx = new rfxcom.RfxCom(comName, { debug: true, logger: logger2 });

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
};


exports.start = function() {
  steward.actors.device.gateway.rfxrec433 = steward.actors.device.gateway.rfxrec433 ||
      { $info     : { type: '/device/gateway/rfxrec433' } };

  steward.actors.device.gateway.rfxrec433.usb =
      { $info     : { type       : '/device/gateway/rfxrec433/usb'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'ready' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/rfxrec433/usb'] = Gateway;

  steward.actors.device.gateway.rfxtrx433 = utility.clone(steward.actors.device.gateway.rfxrec433);
  steward.actors.device.gateway.rfxtrx433.$info.type = '/device/gateway/rfxtrx433';
  steward.actors.device.gateway.rfxtrx433.usb.$info.type = '/device/gateway/rfxtrx433/usb';
  devices.makers['/device/gateway/rfxtrx433/usb'] = Gateway;

  scan();
};
