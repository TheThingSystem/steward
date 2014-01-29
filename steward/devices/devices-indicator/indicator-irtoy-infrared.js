// +++ under development
// USB Infrared Toy - http://dangerousprototypes.com/docs/USB_Infrared_Toy

exports.start = function() {};
if (true) return;


/*
 *  this driver has lots of comments as it is intended as a template for future drivers involving a serial port
 */

var util        = require('util')
  , devices     = require('./../../core/device')
  , serialport  = require('serialport')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  ;


var logger  = indicator.logger;
var logger2 = utility.logger('discovery');


/*
 *  when the devices.discover is called in scan1() to create the device, this prototype is instantiated via new()
 *
 *   the serial port is already open and passed to this function as info.serial
 */
var IRToy = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

/*
 *  the first section innitializes the things common to all devices
 */
  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'ready';
  self.changed();

/*
 *  the second section innitializes the things specific to this device
 */
  self.serial = info.serial;
  self.info = { signal: null };
  self.events = {};

/*
 *  when data is received, we see if there is an event listening for the particular signal (or all signals)
 *
 *  if an error/close event is received, we log it. a programmer more clever tha nmyself would know what to do besides that...
 */
  self.serial.on('data', function(data) {
    self.observe(self, data);
  }).on('error', function(err) {
    logger.error('device/' + self.deviceID, { diagnostic: err.message });
  }).on('close', function() {
    logger.warning('device/' + self.deviceID, { diagnostic: 'premature close' });
  });

/*
 *  the steward uses an internal pubsub mechanism to register events to observe, or invoke tasks to perform
 */
  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    var params = {};

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { }
      if (observe === 'recv') self.events[eventID] = { observe: observe, params: params };
      return;
    }
    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });
};
util.inherits(IRToy, indicator.Device);


/*
 *  this handles incoming data: we convert the data buffer to a hex string, transform it, and then look for registered events
 *
 *  an event with an non-existent/empty params.signals is listening for anything, so we put a copy in 'signal' so it can
 *  see what was observed
 */
IRToy.prototype.observe = function(self, data) {
  var event, eventID, signal;

  signal = data.toString('hex');


// TBD: transform signal as appropriate!


  self.info.signal = signal;
  self.changed();

  for (eventID in self.events) if (self.events.hasOwnProperty(eventID)) {
    event = self.events[eventID];

    if ((!event.params.signal) || (event.params.signal === signal)) steward.observed(eventID);
  }
};


/*
 * before an event is associated with a device prototype, this function is invoked to see "if it makes sense"
 */

var validate_observe = function(observe, parameter) {
  var params
    , result = { invalid: [], requires: [] }
    , signal
    ;

  if (observe.charAt(0) === '.') return result;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (observe !== 'recv') result.invalid.push('observe');

  if ((!params.signal) || (params.signal.length === 0)) return result;

  try { signal = new Buffer(params.signal, 'hex'); } catch(ex) {
    result.invalid.push('signal');
    return result;
  }

// TBD: continue to validate signal here...

  return result;
};


/*
 * perform a task, there are two possibilities: set and xmit
 *
 * set is used to set the steward's display name for the device, the only meaningful parameter is 'name'
 *
 * xmit is used to transmit a signal, the only meaningful parameter is 'signal'
 */

IRToy.prototype.perform = function(self, taskID, perform, parameter) {
  var params, signal;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) return self.setName(params.name);
    return false;
  }

  if ((perform !== 'xmit') || (!params.signal) || (params.signal.length === 0)) return false;

  try { signal = new Buffer(params.signal, 'hex'); } catch(ex) { return false;}


// TBD: transform signal as appropriate!


  this.serial.write(signal, function(err) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'write', diagnostic: err.message });

// TBD: change this to debug prior to acceptance
    this.serial.drain(function(err) {
      if (!!err) return logger.error('device/' + self.deviceID, { event: 'drain', diagnostic: err.message });
    });
  });

  return steward.performed(taskID);
};


/*
 * before an task is associated with a device prototype, this function is invoked to see "if it makes sense"
 */

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    , signal
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
    return result;
  }

  if (perform !== 'xmit') {
    result.invalid.push('xmit');
    return result;
  }

  if ((!params.signal) || (params.signal.length === 0)) {
    result.requires.push('signal');
    return result;
  }
  try { signal = new Buffer(params.signal, 'hex'); } catch(ex) {
    result.invalid.push('signal');
    return result;
  }

// TBD: continue to validate signal here...

  return result;
};


/*
 * the scan function calls a routine to scan for USB devices that match the fingerprint. for each device, the callback is
 * invoked with the opened serial port an information about the device. the callback will be invoked at most once for each
 * matching device.
 */

var fingerprints  =
  [ { vendor         : 'Dangerous Prototypes'
    , modelName      : 'TES42756P'
    , description    : 'USB Infrared Toy'
    , manufacturer   : 'Microchip Technology, Inc.'
    , vendorId       : 0x04d8
    , productId      : 0xfd08
    , pnpId          : 'usb-Dangerous_Prototypes_CDC_'
    , deviceType     : '/device/indicator/irtoy/infrared'
    }
  ];

var scan = function() {
/*
 * to determine what to put in options
 * cf., https://github.com/voodootikigod/node-serialport#serialport-path-options-openimmediately-callback
 */

  var options = {};

  devices.scan_usb(logger2, 'irtoy-infrared', fingerprints, options, function(driver, callback) {
    var comName, info, serial, udn;

    comName = driver.comName;
    udn = 'irtoy:' + driver.serialNumber;
    if (!!devices.devices[udn]) return callback();

    serial = serialport.SerialPort(comName, options, false);
    serial.open(function(err) {
      if (!!err) return callback(err);

      info = { source: driver, serial: serial };
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
  });

  setTimeout(scan, 30 * 1000);
};


/*
 * finally. this function is invoked as soon as the module is loaded. it registers the prototype with the steward and starts
 * scanning the serial ports
 */

exports.start = function() {
  steward.actors.device.indicator.irtoy = steward.actors.device.indicator.irtoy ||
      { $info     : { type: '/device/indicator/irtoy' } };

  steward.actors.device.indicator.irtoy.ifrared =
      { $info     : { type       : '/device/indicator/irtoy/infrared'
                    , observe    : [ 'recv' ]
                    , perform    : [ 'xmit' ]
                    , properties : { name     : true
                                   , status   : [ 'ready', 'listening' ]
                                   }
                    , signal     : 'string'
                    }
      , $validate : { observe    : validate_observe
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/irtoy/ifrared'] = IRToy;

  scan();
};
