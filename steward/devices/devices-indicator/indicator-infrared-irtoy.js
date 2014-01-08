// USB Infrared Toy - http://dangerousprototypes.com/docs/USB_Infrared_Toy

exports.start = function() {};
return;


/*
 *  this driver has lots of comments as it is intended as a template for future drivers involving a serial port
 */

var serialport  = require('serialport')
  , util        = require('util')
  , devices     = require('./../../core/device')
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

/*
 *  the second section innitializes the things specific to this device
 */
  self.status = 'ready';
  self.changed();
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
 *  the steward uses an internal pubsub mechanism is register events to observe, or invoke tasks to perform
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


// transform signal as appropriate!


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

  if (!!params.signal) {
    try { signal = new Buffer(params.signal, 'hex'); } catch(ex) {
      result.invalid.push('signal');
      return result;
    }
  }

// continue to validate signal here...

  return result;
};


/*
 * perform a task, there are two possibilities: set and perform
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

  if (perform !== 'xmit') return false;

  try { signal = new Buffer(params.signal, 'hex'); } catch(ex) {}
  if ((!signal) || (signal.length === 0)) return false;


// transform signal as appropriate!


  this.serial.write(signal, function(err) {
    if (!!err) return logger.error('device/' + self.deviceID, { event: 'write', diagnostic: err.message });

// change this to debug prior to acceptance
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

  if (!params.signal) {
    result.requires.push('signal');
    return result;
  }
  try { signal = new Buffer(params.signal, 'hex'); } catch(ex) {
    result.invalid.push('signal');
    return result;
  }

// continue to validate signal here...

  return result;
};


/*
 * the code that follows (upto, but not including, start) is the USB discovery code. the fingerprints[] array contains an
 * object that is used to identify the USB Infrared Toy on both Linux and Mac OS
 *
 * when a matching fingerprint is found, the array 'scanning' is checked to see if the serialport was successfully opened
 * (or is being opened). if not, serialport.SerialPort() is called to do the open. the function f() returns a function that is
 * invoked when the open completes (or fails). on success, scan1() is called to create the corresponding device in the steward
 */

var scanning      = {};

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
  serialport.list(function(err, info) {
    var i, j, options;

    var f = function(serial, driver) {
      return function(err) {
        if (!err) return scan1(serial, driver);

        scanning[driver.comName] = false;
        return logger2.error('infrared-irtoy', { driver: driver.comName, diagnostic: err.message });
      };
    };

    if (!!err) return logger2.error('infrared-irtoy', { diagnostic: err.message });

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
          if (!info[i].vendorId)     info[i].vendorId     = fingerprints[j].vendorId;
          if (!info[i].productId)    info[i].productId    = fingerprints[j].productId;
          if (!info[i].manufacturer) info[i].manufacturer = fingerprints[j].manufacturer;
          if (!info[i].serialNumber) info[i].serialNumber = info[i].pnpId.substr(fingerprints[j].pnpId.length).split('-')[0];

          if (!!scanning[info[i].comName]) continue;
          scanning[info[i].comName] = true;

// cf., https://github.com/voodootikigod/node-serialport#serialport-path-options-openimmediately-callback
          options = {};
          new serialport.SerialPort(info[i].comName, options, true, f(this, info[i]));
        }
      }
    }
  });

  setTimeout(scan, 30 * 1000);
};

var scan1 = function(serial, driver) {
  var comName, info, udn;

  udn = 'irtoy:' + driver.serialNumber;
  if (!!devices.devices[udn]) return;

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
