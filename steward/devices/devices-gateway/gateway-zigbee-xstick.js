// Digi's Xstick: http://www.digi.com/products/wireless-modems-peripherals/wireless-range-extenders-peripherals/xstick

var util        = require('util')
  , coordinator = require('./../../node_modules/zbee/lib/coordinator.js')    // FIX ME, PLEASE
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  ;


var logger  = exports.logger = utility.logger('gateway');


var Gateway = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'ready';
  self.changed();
  self.xstick = new coordinator.Coordinator({port: info.comName, baud: 9600, debug: true, logger: logger });
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.xstick.on('init', function() {
    console.log('>>> init event');

    this.getStoredNodes(function(err, nodes) {
      var i;

      if (!!err) return logger.error('device/' + self.deviceID, { event: 'getStoredNodes', diagnostic: err.message });

      console.log('>>> getStoredNodes: ' + i + ' nodes');
      for (i = 0; i < nodes.length; i++) this.emit('node', nodes[i]);
    });
    this.getStoredDevices(function(err, devices) {
      var i;

      if (!!err) return logger.error('device/' + self.deviceID, { event: 'getStoredDevices', diagnostic: err.message });

      console.log('>>> getStoredDevices: ' + i + ' devices');
      for (i = 0; i < devices.length; i++) this.emit('device', devices[i]);
    });

    setInterval(function() {
console.log('>>> join');self.xstick.allowJoin();self.xstick.discover();
    }, 60 * 1000);
  }).on('node', function(node) {
    console.log('>>> node event');
    console.log(util.inspect(node, { depth: null }));
  }).on('device', function(device) {
    console.log('>>> device event');
    console.log(util.inspect(device, { depth: null }));
  }).on('attributeReport event', function(message) {
    console.log('>>> attributeReport');
    console.log(util.inspect(message, { depth: null }));
  });

  self.xstick.zbee.on('initialized', function(params) {
    console.log('>>> zbee.initialized event');
    console.log(util.inspect(params, { depth: null }));
  }).on('error', function(err) {
    logger.error('device/' + self.deviceID, { event: 'background error', diagnostic: err.message });
  }).on('lifecycle', function(address64, state) {
    console.log('>>> zbee.lifecycle event: address64=' + address64);
    console.log(util.inspect(state, { depth: null }));
  });
};
util.inherits(Gateway, require('./../device-gateway').Device);


Gateway.operations =
{ init      : function(self, taskID, params, validateP) {
                if (!!validateP) return true;
                if (!self.xstick) return false;

                self.xstick.reset();
                self.xstick.configure();
                self.xstick.save();
                return steward.performed(taskID);
              }
, allow     : function(self, taskID, params, validateP) {
                if (!!validateP) return true;
                if (!self.xstick) return false;

                self.xstick.allowJoin();
                return steward.performed(taskID);
              }

, discover  : function(self, taskID, params, validateP) {
                if (!!validateP) return true;
                if (!self.xstick) return false;

                self.xstick.discovery();
                return steward.performed(taskID);
              }

, test      : function(self, taskID, params, validateP) {
                if (!!validateP) return true;
                if (!self.xstick) return false;

                self.xstick.checkAssociation();
                self.xstick.queryAddresses();
                self.xstick.test();
                return steward.performed(taskID);
              }
};

Gateway.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(e) { params = {}; }

  if (!Gateway.operations[perform]) return devices.perform (self, taskID, perform, parameter);
  return Gateway.operations[perform](self, taskID, params, false);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) {
    result.invalid.push('parameter');
    return result;
  }

  if (!Gateway.operations[perform]) return devices.validate_perform (perform, parameter);
  return Gateway.operations[perform](null, null, params, true);
};


var fingerprints  =
  [
    { vendor         : 'Digi'
    , modelName      : 'XStick2 ZB'
    , description    : 'USB to XBee wireless adapter ZB (ZigBee mesh)'
    , manufacturer   : 'Digi'
    , vendorId       : 0x0403
    , productId      : 0x6001
    , pnpId          : 'usb-Digi_XStick-'
    , deviceType     : '/device/gateway/zigbee/xstick2-zb'
    }
  ];

var scan = function() {
  var logger2 = utility.logger('discovery');

  devices.scan_usb(logger2, 'zigbee-xstick', fingerprints, function(driver, callback) {
    var comName, info, udn;

    comName = driver.comName;
    udn = 'zigbee:' + driver.serialNumber;
    if (!!devices.devices[udn]) return callback();

    callback();

    info = { source: driver, comName: comName };
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
  steward.actors.device.gateway.zigbee = steward.actors.device.gateway.zigbee ||
      { $info     : { type: '/device/gateway/zigbee' } };

  steward.actors.device.gateway.zigbee['xstick2-zb'] =
      { $info     : { type       : '/device/gateway/zigbee/xstick2-zb'
                    , observe    : [ ]
                    , perform    : utility.keys(Gateway.operations)
                    , properties : { name   : true
                                   , status : [ 'ready' ]
                                   }
                    }
      , $validate : { perform    : validate_perform
                    }
      };
  devices.makers['/device/gateway/zigbee/xstick2-zb'] = Gateway;

  utility.acquire2(__dirname + '/../*/*-zigbee-*.js', function(err) {
    if (!!err) logger('zigbee-xstick2-zb', { event: 'glob', diagnostic: err.message });

    scan();
  });
};
