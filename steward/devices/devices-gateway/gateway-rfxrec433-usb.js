// RFXrec433 - USB 433.92MHz receiver: http://www.rfxcom.com/store/Receivers/12113

var rfxcom      = require('rfxcom')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  ;


var logger   = exports.logger = utility.logger('gateway');


var Gateway = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'ready';
  self.rfx = info.rfx;
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (request === 'ping') {
      logger.info('device/' + self.deviceID, { status: self.status });
      return;
    }

         if (actor !== ('device/' + self.deviceID)) return;
    else if (request === 'perform') devices.perform(self, taskID, perform, parameter);
  });

  self.rfx.logger = logger;
  self.rfx.on('response',  function(type, seqno) {
    logger.debug('device/' + self.deviceID, { event: 'response',  type:   type, seqno: seqno });
  }).on('status',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'status',    params: evt });
  }).on('elec2',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'elec2',     params: evt });
  }).on('security1',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'security1', params: evt });
  }).on('temp1',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'temp1',     params: evt });
  }).on('temp2',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'temp2',     params: evt });
  }).on('temp3',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'temp3',     params: evt });
  }).on('temp4',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'temp4',     params: evt });
  }).on('temp5',  function(evt) {
    logger.info('device/' + self.deviceID,  { event: 'temp5',     params: evt });
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
  }).initialise(function() {
    logger.info('device/' + self.deviceID,  { event: 'initialize' });
  });
};
util.inherits(Gateway, require('./../device-gateway').Device);


Gateway.prototype.thX = function(self, evt) {
  var info, params, sensor, udn;

  params = { lastSample  : new Date().getTime()
           , temperature : (!!evt.temperature) ? evt.temperature : null
           , humidity    : (!!evt.humidity)    ? evt.humidity    : null
           };

  udn = 'rfxcom:th:' + evt.id;
  if (devices.devices[udn]) {
    sensor = devices.devices[udn].device;
    return sensor.update(sensor, params);
  }

  info =  { source: self.deviceID, gateway: self, params: params };
  info.device = { url                          : null
                , name                         : 'Thermo-Hygro Sensor #' + evt.id
                , manufacturer                 : 'Oregon Scientific'
                , model        : { name        : 'Thermo-Hygro Sensor'
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

  logger.info(info.device.name, { id: info.device.unit.serial,  params: params });
  devices.discover(info);
};


var scan = function() {
  rfxcom.devices(function(err, results) {
    var device, i, info, rfx, udn;

    if (err) return utility.logger('discovery').error('RFXrec433-usb', { diagnostic: err.message });

    for (i = 0; i < results.length; i++) {
      device = results[i];
      udn = 'rfxcom:' + device.serialNumber;
      if (devices.devices[udn]) continue;

      rfx = new rfxcom.RfxCom(device.comName, { debug: true, logger: utility.logger('discovery') });

      info = { source: device, rfx: rfx };
      info.device = { url          : null
                    , name         : 'RFXrec433 #' + device.serialNumber
                    , manufacturer : device.manufacturer
                    , model        : { name        : 'RFXrec 433'
                                     , description : 'USB 433.92MHz receiver'
                                     , number      : device.productId
                                     }
                    , unit         : { serial      : device.serialNumber
                                     , udn         : udn
                                     }
                    };
      info.url = info.device.url;
      info.deviceType = '/device/gateway/rfxrec433/usb';
      info.id = info.device.unit.udn;
      if (devices.devices[info.id]) return;

      devices.discover(info);
    }
  });

  setTimeout(scan, 30 * 1000);
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

  scan();
};
