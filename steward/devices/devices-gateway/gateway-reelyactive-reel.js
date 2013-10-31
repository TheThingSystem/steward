// reelyActive radio-sensor reels -- http://reelyactive.com/corporate/technology.htm

var dgram       = require('dgram')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , gateway     = require('./../device-gateway')
  ;


var logger = utility.logger('discovery');


var Hublet = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'ready';
  self.changed();
  self.info = {};

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Hublet, gateway.Device);


Hublet.prototype.update = function(self, data, timestamp) {
  var dropP, i, info, j, tagID, udn, v, value;

  if ((data.indexOf('04') !== 0) || (data.length < 12)) return;

  v = [];
  for (i = 12, j = data.length - 4; i <= j; i += 4) {
    value = parseInt(data.substr(i + 2, 2), 16);
    v.push({ reelID: parseInt(data.substr(i, 2), 16), reading: (value < 128) ? (value + 128) : (value - 128) });
  }
  v.sort(function(a, b) { return (b.reading - a.reading); });
  dropP = false;
  for (i = 0; i < v.length; i++) {
    v[i] = v[i].reelID;

    udn = self.deviceUID + ':reelceiver:' + v[i];
    if (!!devices.devices[udn]) {
      if (!!devices.devices[udn].device) v[i] = 'device/' + devices.devices[udn].device.deviceID; else dropP = true;
      continue;
    }

    info = { source: self.deviceID, params: { tagID: tagID } };
    info.device = { url          : null
                  , name         : 'deviceID/' + self.deviceID + ' reelceiver ' + v[i]
                  , manufacturer : 'reelyActive'
                  , model        : { name        : 'reelyActive reelceiver'
                                   , description : 'active RFID reelceiver'
                                   , number      : ''
                                   }
                  , unit         : { serial      : ''
                                   , udn         : udn
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = '/device/gateway/reelyactive/reelceiver';
    info.id = info.device.unit.udn;
    if (devices.devices[info.id]) return;

    utility.logger('discovery').info(info.device.name);
    devices.discover(info);

    dropP = true;
  }
  if (dropP) return;

  tagID = data.substr(4, 7);
  udn = 'reelyActive:tag:' + tagID;
  if (!!devices.devices[udn]) return update(udn, v, timestamp);

  info = { source: self.deviceID, params: { tagID: tagID } };
  info.device = { url          : null
                , name         : 'reel tag (' + tagID + ')'
                , manufacturer : 'reelyActive'
                , model        : { name        : 'reelyActive tag'
                                 , description : 'active RFID tag'
                                 , number      : ''
                                 }
                , unit         : { serial      : ''
                                 , udn         : udn
                                 }
                };
  info.url = info.device.url;
  info.deviceType = '/device/presence/reelyactive/tag';
  info.id = info.device.unit.udn;
  if (devices.devices[info.id]) return;

  utility.logger('discovery').info(info.device.name);
  devices.discover(info);
  update(udn, v, timestamp);
};


var Reelceiver = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'present';
  self.changed();

  self.rankings = [];
  self.rolling = 30;
  self.rolling2 = self.rolling * 2;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Reelceiver, gateway.Device);


var scan = function(portno) {
  dgram.createSocket('udp4').on('message', function(message, rinfo) {/* jshint unused: false */
    var data, hublet, info, timestamp, udn;

    data = message.toString('hex');
    timestamp = new Date().getTime();

    udn = 'reelyActive:reel:' + rinfo.family.toLowerCase() + ':' + rinfo.address + ':' + rinfo.port;
    if (!!devices.devices[udn]) return update(udn, data, timestamp);

    info = { };
    info.device = { url          : null
                  , name         : 'reel-to-Ethernet hublet (' + rinfo.address + ')'
                  , manufacturer : 'reelyActive'
                  , model        : { name        : 'reelyActive hublet'
                                   , description : 'reel-to-Ethernet hublet'
                                   , number      : ''
                                   }
                  , unit         : { serial      : ''
                                   , udn         : udn
                                   }
                  };
    info.url = info.device.url;
    info.deviceType = '/device/gateway/reelyactive/hublet';
    info.id = info.device.unit.udn;
    if (devices.devices[info.id]) return;

    utility.logger('discovery').info(info.device.name, rinfo);
    devices.discover(info);
    update(udn, data, timestamp);
  }).on('listening', function() {
    var address = this.address();

    logger.info('reelyActive driver listening on  udp://*:' + address.port);
  }).on('error', function(err) {
    logger.error('gateway-reelyactive-hublet', { event: 'socket', diagnostic: err.message });
  }).bind(portno);
};

// the UDP stream is faster than the database

var update = function(udn, data, timestamp) {
  var device;

  if ((!devices.devices[udn]) || (!devices.devices[udn].device)) return;

  device = devices.devices[udn].device;
  return device.update(device, data, timestamp);
};

exports.start = function() {
  steward.actors.device.gateway.reelyactive = steward.actors.device.gateway.reelyactive ||
      { $info     : { type: '/device/gateway/reelyactive' } };

  steward.actors.device.gateway.reelyactive.hublet =
      { $info     : { type       : '/device/gateway/reelyactive/hublet'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'ready' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/reelyactive/hublet'] = Hublet;

  steward.actors.device.gateway.reelyactive.reelceiver =
      { $info     : { type       : '/device/gateway/reelyactive/reelceiver'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name     : true
                                   , status   : [ 'present', 'absent', 'recent' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/reelyactive/reelceiver'] = Reelceiver;

  scan(7017);
};
