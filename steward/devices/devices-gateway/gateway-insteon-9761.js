// +++ needs work to deal with unexpected messages and new device types
// Insteon hub: http://www.insteon.com/2242-222-insteon-hub.html
// Insteon SmartLinc: http://www.insteon.com/2412N-smartlinc-central-controller.html

var net         = require('net')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  ;


var logger = exports.logger = utility.logger('gateway');


var Gateway = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = { id         : info.device.unit.address
              , deviceType : info.device.model.description
              , firmware   : info.device.unit.firmware
              };

  self.status = 'ready';
  self.socket = info.socket;
  self.ipaddr = info.portscan.ipaddr;
  self.portno = info.portscan.portno;
  self.buffer = null;
  self.queue = [];
  self.serial = 0;
  self.stations = {};
  self.upstream = {};

  self.setup(self);

  self.refresh(self);

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (request === 'ping') return self.ping(self);

         if (actor !== ('device/' + self.deviceID)) return;
    else if (request === 'perform') devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Gateway, require('./../device-gateway').Device);


Gateway.prototype.setup = function(self) {
  var callback, i;

  if (!self.socket) {
    self.status = 'waiting';
    self.changed();
    self.buffer = null;
    for (i = 0; i < self.queue.length; i++) {
      callback = self.queue[i].callback;

      if (!!callback) (callback)(self, null, null);
    }
    self.queue = [];
    self.callbacks = {};

    self.socket = new net.Socket({ type: 'tcp4' });
    self.socket.on('connect', function() {
      self.socket.setTimeout(0);

      self.status = 'ready';
      self.changed();

      self.refresh(self);
    }).connect(self.portno, self.ipaddr);
  }

  self.socket.removeAllListeners();
  self.socket.on('data', function(data) {
    self.buffer = !!self.buffer ? Buffer.concat([ self.buffer, data ]) : data;
    self.process(self);
  }).on('error', function(error) {
    logger.warning('device/' + self.deviceID, { event: 'error', error: error });
  }).on('timeout', function() {
    logger.info('device/' + self.deviceID, { event: 'timeout' });
  }).on('end', function() {
    logger.info('device/' + self.deviceID, { event: 'closing' });
  }).on('close', function(errorP) {
    logger.info('device/' + self.deviceID, { event: errorP ? 'reset' : 'close' });
    self.socket = null;
    setTimeout(function() { self.setup(self); }, 2 * 1000);
  });
};

Gateway.prototype.refresh = function(self) {
  self.roundtrip(self, '0269');
};

Gateway.prototype.roundtrip = function(self, request, prefixes, callback) {
  if ((!util.isArray(prefixes)) || (prefixes.length === 0)) prefixes = [ request ];
  self.queue.push({ packet: new Buffer(request, 'hex'), prefixes: prefixes, callback: callback || null });
  if (self.queue.length === 1) self.request(self);
};

Gateway.prototype.request = function(self) {
  if (self.queue.length === 0) return;
  logger.debug('device/' + self.deviceID, { event: 'send message', message: self.queue[0].packet.toString('hex') });
  self.socket.write(self.queue[0].packet);
};

Gateway.prototype.retry = function(self) { return function() { self.request(self); }; };

Gateway.prototype.announce = function(self, id) {
  var info, deviceType, manufacturer, modelName, modelNo, station, x;

  station = self.stations[id];
  deviceType = deviceTypes[station.device] || ('Insteon device ' + station.device);

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

  info = { source: self.deviceID, gateway: self };
  info.device = { url          : null
                , name         : station.name || modelName + ' ' + sixtoid(id)
                , manufacturer : manufacturer
                , model        : { name        : 'Insteon.' + station.device
                                 , description : deviceType
                                 , number      : modelNo
                                 }
                , unit         : { serial      : id
                                 , udn         : 'insteon:' + sixtoid(id)
                                 }
                };
  info.url = info.device.url;
  info.deviceType = deviceType;
  info.deviceType2 = info.device.model.name;
  info.id = info.device.unit.udn;
  if (devices.devices[info.id]) return;

  logger.info(info.device.name, { id: sixtoid(id),  description: deviceType });
  devices.discover(info);
};


var messageTypes = {
            0x50: { type   : 'INSTEON standard message received'
                  , length : 11
                  , f      : function(self, messageType, message) {
                               var u;

                               logger.debug('device/' + self.deviceID,
                                            { type     : messageType.type
                                            , from     : sixtoid(message.substr(4, 6))
                                            , to       : sixtoid(message.substr(10, 6))
                                            , flags    : message.substr(16, 2)
                                            , command1 : message.substr(18, 2)
                                            , command2 : message.substr(20, 2)
                                            , message  : message
                                            });
                               u = self.upstream[message.substr(4, 6)];
                               if (!!u) u.callback(u, messageType, message);
                             }
                  }

          , 0x51: { type   : 'INSTEON extended message received'
                  , length : 25
                  , f      : function(self, messageType, message) {
                               var i, id, name, u, userdata;

                               id = message.substr(4, 6);
                               userdata = message.substr(22, 28);
                               switch (message.substr(18, 4)) {
                                 case '0300':
                                  if (!!deviceTypes[userdata.substr(8, 4)]) {
                                     self.stations[id].device  = userdata.substr(8, 4);
                                     self.changed();
                                     self.announce(self, id);
                                   }
                                   break;

                                 case '0302':
                                   name = '';
                                   for (i = 0; i < userdata.length; i += 2) {
                                     if (userdata.substr(i, 2) === '00') break;
                                     name += String.fromCharCode(parseInt(userdata.substr(i, 2), 16));
                                   }
                                   self.stations[id].name  = name;
                                   break;

                                 default:
                                   logger.debug('device/' + self.deviceID,
                                                { type     : messageType.type
                                                , from     : sixtoid(id)
                                                , to       : sixtoid(message.substr(10, 6))
                                                , flags    : message.substr(16, 2)
                                                , command1 : message.substr(18, 2)
                                                , command2 : message.substr(20, 2)
                                                , userdata : userdata
                                                , message  : message
                                                });
                                   u = self.upstream[message.substr(4, 6)];
                                   if (!!u) u.callback(u, messageType, message);
                                   break;
                               }
                             }
                  }

          , 0x52: { type   : 'X10 message received'
                  , length :  4
                  , f      : function(self, messageType, message) {
                               var u;

                               logger.debug('device/' + self.deviceID,
                                            { type     : messageType.type
                                            , x10      : sixtoid(message.substr(4, 2))
                                            , flag     : sixtoid(message.substr(6, 2))
                                            , message  : message
                                            });
                               u = self.upstream[message.substr(4, 6)];
                               if (!!u) u.callback(u, messageType, message);
                             }
                  }

// FIXME
// commands sent from an IM to the host, part deux...
          , 0x53: { type   : 'all-linking completed'
                  , length : 10
                  , f      : function(self, messageType, message) {
                               logger.debug('device/' + self.deviceID,
                                           { type     : messageType.type
                                           , code     : message.substr(4, 2)
                                           , group    : message.substr(6, 2)
                                           , id       : sixtoid(message.substr(8, 6))
                                           , device   : deviceTypes[message.substr(14, 4)] || message.substr(14, 4)
                                           , firmware : message.substr(18, 2)
                                           , message  : message
                                           });
                             }
                  }

          , 0x54: { type   : 'button event report'
                  , length :  3
                  , f      : function(self, messageType, message) {
                               var u;

                               logger.debug('device/' + self.deviceID,
                                           { type     : messageType.type
                                           , button   : { '02' : 'SET button tapped'
                                                        , '03' : 'SET button held'
                                                        , '04' : 'SET button released after hold'
                                                        , '12' : 'button 2 tapped'
                                                        , '13' : 'button 2 held'
                                                        , '14' : 'button 2 released after hold'
                                                        , '22' : 'button 3 tapped'
                                                        , '23' : 'button 3 held'
                                                        , '24' : 'button 3 released after hold'
                                                        }[message.substr(4, 2)] || message.substr(4, 2)
                                           , message  : message
                                           });
                               u = self.upstream[message.substr(4, 6)];
                               if (!!u) u.callback(u, messageType, message);
                             }
                  }

// unsolicited
          , 0x55: { type   : 'user reset detected'
                  , length :  2
                  , f      : function(self, messageType, message) {
                               logger.warning('device/' + self.deviceID, { type: messageType.type, request: message });
                               self.status = 'reset';
                               self.changed();

                               self.socket.destroy();
                             }
                  }

// NOT YET
          , 0x56: { type   : 'all-link cleanup failure report'
                  , length :  7
                  , f      : function(self, messageType, message) {
                               logger.warning('device/' + self.deviceID,
                                              { type     : messageType.type
                                                        // message.substr(4, 2) === '01'
                                              , group    : message.substr(6, 2)
                                              , id       : sixtoid(message.substr(8, 6))
                                              , message  : message
                                              });
                            }
                  }

          , 0x57: { type   : 'all-link record response'
                  , length : 10
                  , f      : function(self, messageType, message) {
                               var flags  = message.substr(4, 2)
                                 , group  = message.substr(6, 2)
                                 , id     = message.substr(8, 6)
                                 , link   = message.substr(14, 6)
                                 ;

                               self.stations[id] = { device : message.substr(14, 4)
                                                   , name   : ''
                                                   , flags  : flags
                                                   , group  : group
                                                   , link   : link
                                                   , serial : self.serial
                                                   };
                               self.changed();
                               self.announce(self, id);
                             }
                  }

// NOT YET
          , 0x58: {  type  : 'all-link cleanup status report'
                  , length :  3
                  , f      : function(self, messageType, message) {/* jshint unused: false */}
                  }

// for synchronization
          , 0x02: { type   : 'stx'
                  , length :  1
                  , f      : function(self, messageType, message) {
                               logger.info('device/' + self.deviceID, { type    : messageType.type , message : message });
                             }
                  }


// responses from an IM to the host

// return to caller
//  S: 0x02 0x60
          , 0x60: {  type  : 'get IM info'
                  , length :  9
                  }

// return to caller and return zero or more 0x50 messages followed by a 0x56 or 0x58 message: NOT YET
//  S: 0x02 0x61 <group> <command> <0xff|0x00>
          , 0x61: { type   : 'send all-link command'
                  , length :  8
                  }

// return to caller
//  S: 0x02 0x62 <INSTEON standard message(6 octets) | INSTEON extended message(20 octets)>
          , 0x62: { type   : 'send INSTEON standard or extended message'
                  , length :  0 // calculated dynamically
                  }

// return to caller
//  S: 0x02 0x63 <raw x10> <x10 flag>
          , 0x63: { type   : 'send X10 message'
                  , length :  5
                  }

// return to caller
//  S: 0x02 0x64 <0x00(IM is responder) | 0x01(IM is controller) | 0x03(IM is either) | 0xff(link deleted)> <group>
          , 0x64: { type   : 'start all-linking'
                  , length :  5
                  }

// return to caller
//  S: 0x02 0x65
          , 0x65: { type   : 'cancel all-linking'
                  , length :  3
                  }

// return to caller
//  S: 0x02 0x66 <category> <subcategory> <0xff|revision>
          , 0x66: { type   : 'set host devie category'
                  , length :  6
                  }

// return to caller
//  S: 0x02 0x67
          , 0x67: { type   : 'reset the IM'
                  , length :  3
                  }

// return to caller
//  S: 0x02 0x68 <command2>
          , 0x68: { type   : 'set INSTEON ack message byte'
                  , length :  4
                  }

// initiated by self.refresh()
//  S: 0x02 0x69
          , 0x69: { type   : 'get first all-link record'
                  , length :  3
                  , f      : function(self, messageType, message) {
                               self.serial++;
                               if (message.substr(-2) === '06') {
                                 self.roundtrip(self, '026a');
                               } else {
                                 self.stations = {};
                               }
                             }
                  }

//  S: 0x02 0x6a
          , 0x6a: { type   : 'get next all-link record'
                  , length :  3
                  , f      : function(self, messageType, message) {
                               var id;

                               if (message.substr(-2) === '06') self.roundtrip(self, '026a');
                               else {
                                 for (id in self.stations) {
                                   if (!self.stations.hasOwnProperty(id)) continue;

                                   if (!self.stations[id].device) self.roundtrip(self, '0262' + id + '00' + '0300');
                                 }
                               }
                             }
                  }

// return to caller
//  S: 0x02 0x6b <flags>
          , 0x6b: { type   : 'set IM configuration'
                  , length :  4
                  }

// return to caller
//  S: 0x02 0x6c
          , 0x6c: { type   : 'get all-link record for sender'
                  , length :  3
                  }

// return to caller
//  S: 0x02 0x6d
          , 0x6d: { type   : 'LED on'
                  , length :  3
                  }

// return to caller
//  S: 0x02 0x6e
          , 0x6e: { type   : 'LED off'
                  , length :  3
                  }

// return to caller
//  S: 0x02 0x6f <control flags> <record flags> <group> 3*<id> 3*<link>
          , 0x6f: { type   : 'manage all-link record'
                  , length : 12
                  }

// return to caller
//  S: 0x02 0x70 <command2>
          , 0x70: { type   : 'set INSTEON nak message byte'
                  , length :  4
                  }

// return to caller
//  S: 0x02 0x71 <command1> <command 2>
          , 0x71: { type   : 'set INSTEON ack message two bytes'
                  , length :  5
                  }

// return to caller
//  S: 0x02 0x72
          , 0x72: { type   : 'RF sleep'
                  , length :  3
                  }

// return to caller
//  S: 0x02 0x73
          , 0x73: { type   : 'get IM configuration'
                  , length :  6
                  }
          };


var deviceTypes = {
// 00: generalized controllers
                    '0000' : 'Unknown'
                  , '0004' : 'ControlLinc [2430]'
                  , '0005' : 'RemoteLinc [2440]'
                  , '0006' : 'Icon/Tabletop Controller [2830]'
                  , '0008' : 'EZBridge/EZServer'
                  , '0009' : 'SignalLinc RF Signal Enhancer [2442]'
                  , '000a' : 'Balboa Instruments/Poolux LCD Controller'
                  , '000b' : 'Access Point [2443]'
                  , '000c' : 'IES/Color Touchscreen'
                  , '000d' : 'SmartLabs/KeyFOB'

// 01: dimmable lighting control
                  , '0100' : 'LampLinc V2 [2456D3]'
                  , '0101' : 'SwitchLinc V2 Dimmer 600W [2476D]'
                  , '0102' : 'In-LineLinc Dimmer [2475D]'
                  , '0103' : 'Icon/Switch Dimmer [2876D]'
                  , '0104' : 'SwitchLinc V2 Dimmer 1000W [2476DH]'
                  , '0105' : 'KeypadLinc Dimmer Countdown Timer [2486DWH8]'
                  , '0106' : 'LampLinc 2-Pin [2456D2]'
                  , '0107' : 'Icon/LampLinc V2 2-Pin [2456D2]'
                  , '0108' : 'SwitchLinc Dimmer Count-down Timer [2484DWH8]'
                  , '0109' : 'KeypadLinc Dimmer [2486D]'
                  , '010a' : 'Icon/In-Wall Controller [2886D]'
                  , '010b' : 'Access Point LampLinc [2458D3]'
                  , '010c' : 'KeypadLinc Dimmer - 8-Button defaulted mode [2486DWH8]'
                  , '010d' : 'SocketLinc [2454D]'
                  , '010e' : 'LampLinc Dimmer, Dual-Band [2457D3]'
                  , '010f' : 'Dimmer Module (DE) [2632-432]'
                  , '0111' : 'Dimmer Module (UK) [2632-442]'
                  , '0112' : 'Dimmer Module (AU) [2632-522]'
                  , '0113' : 'Icon/SwitchLinc Dimmer for Lixar/Bell Canada [2676D-B]'
                  , '0117' : 'ToggleLinc Dimmer [2466D]'
                  , '0118' : 'Icon/SL DImmer Inline Companion [2474D]'
                  , '0119' : 'SwitchLinc 800W'
                  , '011a' : 'In-Line Linc Dimmer with Sense [2475D2]'
                  , '011b' : 'KeypadLinc 6-button Dimmer [2486DWH6]'
                  , '011c' : 'KeypadLinc 8-button Dimmer [2486DWH8]'
                  , '011d' : 'SwitchLinc Dimmer 1200W [2476D]'
                  , '0134' : 'DIN Rail Dimmer [2452-222]'
                  , '0135' : 'Micro Dimmer Module [2442-222]'
                  , '0136' : 'DIN Rail Dimmer (EU) [2452-422]'
                  , '0137' : 'DIN Rail Dimmer (AU) [2452-522]'
                  , '0138' : 'Micro Dimmer Module (EU) [2442-422]'
                  , '0139' : 'Micro Dimmer Module (AU) [2442-522]'
                  , '013a' : 'LED Bulb, 8 watt (60W) [2672-222]'
                  , '01ef' : 'Dimmer Module (FR) [2632-422]'

// 02: switched lighting control
                  , '0205' : 'KeypadLinc Relay - 8-button defaulted mode [2486SWH8[]'
                  , '0206' : 'Outdoor ApplianceLinc [2456S3E]'
                  , '0207' : 'TimerLinc [2456ST3]'
                  , '0208' : 'OutletLinc [2473S]'
                  , '0209' : 'ApplianceLinc [2456S3]'
                  , '020a' : 'SwitchLinc Relay [2476S]'
                  , '020b' : 'Icon/OnOff Switch [2876S]'
                  , '020c' : 'Icon/Appliance Adapter [2856S3]'
                  , '020d' : 'ToggleLinc Relay [2466S]'
                  , '020e' : 'SwitchLinc Relay Countdown Timer [2476ST]'
                  , '020f' : 'KeypadLink OnOff Switch [2486SWH6]'
                  , '0210' : 'In-LineLinc Relay [2475D]'
                  , '0211' : 'EZSwitch30 (240B, 30A load controller)'
                  , '0212' : 'Icon/SL Relay Inline Companion'
                  , '0213' : 'Icon/SwitchLinc Relay for Lixar/Bell Canada [2676R-B]'
                  , '0214' : 'In-LineLinc Relay with Sense [2475S2]'
                  , '0216' : 'SwitchLinc Relay with Sense [2476S2]'
                  , '022d' : 'OnOff Module (FR) [2633-422]'
                  , '022e' : 'DIN Rail OnOff [2453-222]'
                  , '022f' : 'Micro OnOff Module [2443-222]'
                  , '0230' : 'OnOff Module (DE) [2632-432]'
                  , '0231' : 'Micro OnOff Module (EU) [2443-422]'
                  , '0232' : 'Micro OnOff Module (AU) [2443-522]'
                  , '0233' : 'DIN Rail OnOff (EU) [2453-422]'
                  , '0234' : 'DIN Rail OnOff (AU) [2453-522]'
                  , '0235' : 'OnOff Module (UK) [2633-442]'
                  , '0236' : 'OnOff Module (AU) [2633-522]'
                  , '0238' : 'Outdoor OnOff Module [2634-222]'

// 03: network bridges
                  , '0301' : 'PowerLinc Serial [2414S]'
                  , '0302' : 'PowerLinc USB [2414U]'
                  , '0303' : 'Icon/PowerLinc Serial [2814S]'
                  , '0304' : 'Icon/PowerLinc USB [2814U]'
                  , '0305' : 'Smarthome/Power Line Modem Serial [2412S]'
                  , '0306' : 'SmartLabs/IR to Insteon Interface [2411R]'
                  , '0307' : 'SmartLabs/IRLinc - IR Transmitter Interface [2411T]'
//                , '0308' : 'SmartLabs/Bi-Directional IR -Insteon Interface'
                  , '0308' : 'Leak Sensor [2852-222]'    // NB: at least that's what mine advertises...
                  , '0309' : 'SmartLabs/RF Developers Board [2600RF]'
                  , '030a' : 'SmartLabs/PowerLinc Modem Ethernet [2412E]'
                  , '030b' : 'SmartLabs/PowerLink Modem USB [2412U]'
                  , '030c' : 'SmartLabs/PLM Alert Serial'
                  , '030d' : 'SimpleHomeNet/EZX10RF'
                  , '030e' : 'X10 TW-523/PSC05 Translator'
                  , '030f' : 'EZX10IR (X10 IR receiver, Insteon controller and IR distribution hub)'
                  , '0310' : 'PowerLinc - Serial (Dual Band) [2413S]'
                  , '0311' : 'SmartLinc Central Controller [2412N]'
                  , '0312' : 'RF Modem Card'
                  , '0313' : 'PowerLinc USB - HouseLinc 2 enabled [2412UH]'
                  , '0314' : 'PowerLinc Serial - HuseLinc 2 enabled [2412SH]'
                  , '0315' : 'PowerLinc - USB (Dual Band) [2413U]'
                  , '0337' : 'Hub [2242-2222]'

// 04: irrigation control
                  , '0400' : 'Compacta/EZRain Sprinkler Controller'

// 05: climate control
                  , '0500' : 'Broan/SMSC080 Exhaust Fan [2456S3]'
                  , '0501' : 'Compacta/EZTherm'
                  , '0502' : 'Broan/SMSC110 Exhaust Fan'
                  , '0503' : 'Venstar/RF Thermostat Module'
                  , '0504' : 'Compacta/EZThermx Thermostat'
                  , '0505' : 'Broan, Venmar, BEST/Rangehoods'
                  , '0506' : 'Broad/SmartSense Make-up Damper'
                  , '050a' : 'Wireless Thermostat [2441ZTH]'

// 06: pool and spa control
                  , '0600' : 'Compacta/EZPool'
                  , '0601' : 'Low-end pool controller (temporary engineering project name)'
                  , '0602' : 'Mid-range pool controller (temporary engineering project name)'
                  , '0603' : 'Next generation pool controller (temporary engineering project name)'

// 07: sensors and actuators
                  , '0700' : 'IO Linc [2450]'
                  , '0701' : 'Compacta/EZSns1W Sensor Interface module'
                  , '0702' : 'Compacta/EZIO8T I/O Module'
                  , '0703' : 'Compact/EZIO2X4 INSTEON/X10 I/O module [5010D]'
                  , '0704' : 'Compact/EZIO8SA I/O module'
                  , '0705' : 'Compacta/EZSnsRF RF Receiver interface for Dakota Alert Products [5010E]'
                  , '0706' : 'Compacta/EZISnsRF Sensor interface module'
                  , '0707' : 'EZIO6i (6 inputs)'
                  , '0708' : 'EZIO4O (4 relay outputs)'

// 08: home entertainment

// 09: energy management
                  , '0900' : 'Compacta/EZEnergy'
                  , '0901' : 'OnSitePro/Leak Detector'
                  , '0902' : 'OnSitePro/Control Valve'
                  , '0903' : 'Energy Inc./TED 5000 Single Phase MTU'
                  , '0904' : 'Energy Inc./TED 5000 Gateway - USB'
                  , '0905' : 'Energy Inc./TED 5000 Gateway - Ethernet'
                  , '0906' : 'Energy Inc./TED 5000 Three Phase MTU'
                  , '0907' : 'IO Meter Solo [2423A1]'

// 0a: built-in appliance control
// 0b: plumbing
// 0c: communication
// 0d: computer control

// 0e: window coverings
                  , '0e00' : 'Somfy Drape Controller RF Bridge'
                  , '0e01' : 'Micro Open Close Module [2443-222]'
                  , '0e02' : 'Micro Open Close Module [2443-422]'
                  , '0e32' : 'Micro Open Close Module [2443-522]'

// 0f: access control
                  , '0f00' : 'Welland Doors Central Drive and Controller'
                  , '0f01' : 'Welland Doors Secondary Central Drive'
                  , '0f02' : 'Welland Doors Assist Drive'
                  , '0f03' : 'Welland Doors Elevation Drive'
                  , '0f04' : 'GarageHawk Garage Unit'
                  , '0f05' : 'GarageHawk Remote Unit'

// 10: security, health, safety
                  , '1000' : 'First Alert ONELink RF to Insteon Bridge'
                  , '1001' : 'Motion Sensor [2420M]'
                  , '1002' : 'TriggerLink - INSTEON Open/Close Sensor [2421]'
                  , '1008' : 'Leak Sensor [2852-222]'
                  , '100a' : 'Smoke Bridge [2982-222]'

// 11: surveillance

// 12: automotive

// 13: pet care

// 14: toys

// 15: timekeeping

// 16: holiday
};

Gateway.prototype.process = function(self) {
  var entry, i, j, message, messageType, status;

// tail-end recursion
  if (!self.buffer) return;

// skip past any end-of-records
// http://code.google.com/p/shion/source/browse/trunk/Shion+Framework/ASPowerLinc2412Controller.m
  for (i = 0; i < self.buffer.length; i++) if (self.buffer[i] !== 0x15) break;
  if (i > 0) {
    self.buffer = (i < self.buffer.length) ? self.buffer.slice(i) : null;
    self.request(self);
    return self.process(self);
  }

  messageType = (self.buffer.length > 1) ? (messageTypes[self.buffer[1]] || null) : null;
  if ((self.buffer[0] !== 0x02) || ((self.buffer.length > 1) && (!messageType))) {
    logger.warning('device/' + self.deviceID,
                   { event: 'invalid response', response: self.buffer.toString('hex').toLowerCase() });
// re-synchronize
// http://code.google.com/p/shion/source/browse/trunk/Shion+Framework/ASPowerLinc2412Controller.m
     for (i = 1; i < self.buffer.length - 1; i++) {
       if (((self.buffer[i] === 0x02) && (self.buffer[i + 1] >= 0x40)) || (self.buffer[i + 1] === 0x15)) {
          self.buffer = (i < self.buffer.length) ? self.buffer.slice(i) : null;
          return self.process(self);
       }
    }

// nothing left
    self.buffer = null;
    return;
  }
  if (self.buffer.length < 2) return;

  logger.debug('device/' + self.deviceID, { event: 'buffer', buffer: self.buffer.toString('hex').toLowerCase() });
  i = messageType.length;
  if (i === 0) i = ((self.buffer[5] & 0x01) === 0x01) ? 23 : 9;
  if (self.buffer.length < i) return;

  message = self.buffer.slice(0, i).toString('hex').toLowerCase();
  status = message.substr(-2);
  logger.debug('device/' + self.deviceID,
               { event   : 'recv message'
               , type    : messageType.type
               , status  : {'06': 'success', '15': 'fail'}[status] || status
               , message : message
               });
  self.buffer = (i < self.buffer.length) ? self.buffer.slice(i) : null;

  if (messageType.f) (messageType.f)(self, messageType, message);

  entry = (self.queue.length > 0) ? self.queue[0] : { prefixes: [] };
  for (i = 0; i < entry.prefixes.length; i++) {
    j = entry.prefixes[i].length;
    if ((j > message.length) || (entry.prefixes[i] !== message.substr(0, j))) continue;

    if (!!entry.callback) (entry.callback)(self, messageType, message);

    self.queue.splice(0, 1);
    if (self.queue.length > 0) setTimeout( self.retry(self), 1000);
    break;
  }

  return self.process(self);
};


Gateway.prototype.ping = function(self) {
  var device, devices, id, meta, station;

  devices = {};
  for (id in self.stations) {
    if (!self.stations.hasOwnProperty(id)) continue;

    station = self.stations[id];
    if (!devices[station.device]) devices[station.device] = 0;
    devices[station.device]++;
  }

  meta = { status: self.status, id: self.info.id, devices: {} };
  for (device in devices) {
    if (!devices.hasOwnProperty(device)) continue;

    meta.devices[deviceTypes[device] || device] = devices[device];
  }

  logger.info(self.name, meta);
};


// called by portscanner

var pair = function(socket, ipaddr, portno, macaddr, tag) {
  var buffer = null, silentP = false;

  socket.setNoDelay();
  socket.on('data', function(data) {
    var address, description, deviceType, firmware, i, id, info, manufacturer, modelName, modelNo, message, productCode, x;

    buffer = !!buffer ? Buffer.concat([ buffer, data ]) : data;

    for (i = 0; i < buffer.length; i++) if (buffer[i] == 0x02) break;
    if (i !== 0) buffer = ((i + 1) < buffer.length) ? buffer.slice(i + 1) : null;
    if ((!buffer) || (buffer.length < 9)) return;

    socket.setTimeout(0);
    silentP = true;

    if ((buffer[1] != 0x60) || (buffer[8] != 0x06)) {
      logger.error('PORT ' + ipaddr + ':' + portno, { event: 'response', content: buffer.toString('hex').toLowerCase() });
      socket.destroy();
      return;
    }

    message = buffer.toString('hex').toLowerCase();
    id = message.substr(4, 6);
    address = sixtoid(id);
    productCode = message.substr(10, 4);
    deviceType = deviceTypes[productCode] || ('Insteon device ' + productCode);
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

    info = { source: 'portscan', portscan: { ipaddr: ipaddr, portno: portno }, socket: socket };
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
    info.url = null;
    info.ipaddress = ipaddr;
    info.deviceType = '/device/gateway/insteon/';
    switch (productCode) {
      case '0337': info.deviceType += 'hub';       break;
      default:     info.deviceType += 'smartlinc'; break;
    }
    info.id = info.device.unit.udn;
    if (devices.devices[info.id]) return socket.destroy();

    utility.logger('discovery').info(tag, { id: address, description: description, firmware: firmware });
    devices.discover(info);
  }).on('error', function(error) {
    if (!silentP) utility.logger('discovery').warning(tag, { event: 'error', error: error });
  }).on('timeout', function() {
    if (!silentP) utility.logger('discovery').info(tag, { event: 'timeout' });
  }).on('end', function() {
    if (!silentP) utility.logger('discovery').info(tag, { event: 'closing' });
  }).on('close', function(errorP) {
    if (!silentP) utility.logger('discovery').info(tag, { event: errorP ? 'reset' : 'close' });
  }).write(new Buffer('0260', 'hex'));
  socket.setTimeout(3 * 1000);
};


var sixtoid = function(six) { return six.substr(0, 2) + ':' + six.substr(2, 2) + ':' + six.substr(4, 2); };


// TBD: discover

exports.start = function() {
return;
  steward.actors.device.gateway.insteon = steward.actors.device.gateway.insteon ||
      { $info     : { type: '/device/gateway/insteon' } };

  steward.actors.device.gateway.insteon.hub =
      { $info     : { type       : '/device/gateway/insteon/hub'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'waiting', 'ready', 'reset' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/insteon/hub'] = Gateway;

  steward.actors.device.gateway.insteon.smartlinc =
      { $info     : { type       : '/device/gateway/insteon/smartlinc'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'waiting', 'ready', 'reset' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/insteon/smartlinc'] = Gateway;

  require('./../../discovery/discovery-portscan').pairing([ 9761 ], pair);
};
