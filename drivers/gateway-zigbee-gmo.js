// +++ under development
// Exegin Q52 - Zigbee GMO: http://exegin.com/hardware/q53app.php

var soap        = require('soap')
  , stringify   = require('json-stringify-safe')
  , url         = require('url')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  ;


var logger   = exports.logger = utility.logger('gateway');

/*
var listener = null;
*/


var Gateway = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'ready';
  self.changed();
  self.client = info.client;
  self.neighbors = {};

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (request === 'attention') {
      if ((self.status === 'reset') && (broker.has('beacon-egress'))) broker.publish('beacon-egress', '.attention', {});
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });

  self.refresh(self);
};
util.inherits(Gateway, require('./../device-gateway').Device);
Gateway.prototype.perform = devices.perform;


Gateway.prototype.refresh = function(self) {
  self.client.ZGDService.gmo.Get({ attrId : '0x87' // Table 3.44: nwkNeighborTable
                                 }, function(err, response) {
    var id, entry, value;

    setTimeout(function() { self.refresh(self); }, 30 * 1000);

    if (err) return logger.error('device/' + self.deviceID, { event: 'Get', diagnostic: err.message });

console.log('+++ ' + stringify(response));
    if (response.Status !== '0') {
      return logger.error('device/' + self.deviceID, { event: 'Get', status: response.Status });
    }

    for (value = response.value; value.length > 0; value = value.substr(34)) {
      entry = { networkAddress : value.substr(16, 4)
              , deviceType     : { '00' : 'coordinator'
                                 , '01' : 'router'
                                 , '02' : 'end-device'
                                 }[value.substr(20, 2)] || 'unknown'
              , relation       : { '00' : 'parent'
                                 , '01' : 'child'
                                 , '02' : 'sibling'
                                 , '03' : 'none'
                                 , '04' : 'previous-child' }[value.substr(24, 2)] || 'unknown'
              };
      entry.decimalAddress = parseInt(entry.networkAddress, 16);
      entry.endpointPrefix = entry.networkAddress.match(/../g).reverse().join('').toLowerCase();

      id = value.substr(0, 16);
      if (self.neighbors[id]) {
        console.log('+++ old neighbor');
        continue;
      }

      self.neighbors[id] = entry;
      self.SendZDPCommand(self, entry.decimalAddress, 0x0005, /* Section 2.4.3.1.6: Active_EP_req */
                          entry.endpointPrefix, self.Active_EP_Callback(self, id));
    }
  });
};

Gateway.prototype.SendZDPCommand = function(self, address, clusterID, command, callback) {
  self.client.setSecurity({ rewrite: self.RewriteZDPCommand });
  self.client.ZGDService.zdp.SendZDPCommand(
      { Timeout             : (2 * 1000)
      , Command             : { Destination         : {
                                                        NetworkAddress          : address
                                                      }
                              , TxOptions           : { SecurityEnabled         : 'true'
                                                      , UseNetworkKey           : 'true'
                                                      , Acknowledged            : 'false'
                                                      , PermitFragmentation     : 'false'
                                                      }
                              , ClusterID           : clusterID
                              , Command             : command
                              , DestinationAddrMode : 0x02
                              }
      }, callback);
  self.client.setSecurity(null);
console.log('+++ ZDP request');console.log(self.client.lastRequest);
};

Gateway.prototype.RewriteZDPCommand = function(message) {
// major sigh.
  return message.replace('<Timeout>',                       '<Timeout xmlns="">')
                .replace('<Command><Destination>',          '<Command xmlns=""><Destination>')
                .replace('<Destination>',                   '<ns:Destination>')
                .replace('</Destination>',                  '</ns:Destination>')
                .replace('<NetworkAddress>',                '<ns:NetworkAddress>')
                .replace('</NetworkAddress>',               '</ns:NetworkAddress>')
                .replace('<TxOptions>',                     '<ns:TxOptions>')
                .replace('</TxOptions>',                    '</ns:TxOptions>')
                .replace('<ClusterID>',                     '<ns:ClusterID>')
                .replace('</ClusterID><Command>',           '</ns:ClusterID><ns:Command>')
                .replace('</Command><DestinationAddrMode>', '</ns:Command><ns:DestinationAddrMode>')
                .replace('</DestinationAddrMode>',          '</ns:DestinationAddrMode>');
};

Gateway.prototype.Active_EP_Callback = function(self, id) {
  return function(err, response, body) {
    var endpoint, entry, i, len, value;

    if (err) {
      delete(self.neighbors[id]);
      return logger.error('device/' + self.deviceID, { event: 'Active_EP_Callback', diagnostic: err.message });
    }
console.log('+++ ZDP response' + stringify(response));
console.log(body);console.log('+++');

    if (response.Status !== '0') {
      return logger.error('device/' + self.deviceID, { event: 'Active_EP_callback', status: response.Status });
    }

    entry = self.neighbors[id];

    value = response.Message.Command;
    if (value.substr(0, 2) !== '00') {
      return logger.error('device/' + self.deviceID, { event: 'Active_EP_Callback', command: value });
    }

    len = parseInt(value.substr(6, 2), 16);
    for (i = 0; i < len; i++) {
      endpoint = value.substr(8 + (i * 2), 2);
      self.SendZDPCommand(self, entry.decimalAddress, 0x004, /* Section 2.4.3.1.5: SimpleDesc_req */
                          entry.endpointPrefix + endpoint, self.Simple_Desc_Callback(self, id));
    }
  };
};

Gateway.prototype.Simple_Desc_Callback = function(self, id) {
  return function(err, response, body) {
//    var endpoint, entry, i, len, value;

    if (err) {
      delete(self.neighbors[id]);
      return logger.error('device/' + self.deviceID, { event: 'Simple_Desc_Callback', diagnostic: err.message });
    }
console.log('+++ ZDP request');console.log(self.client.lastRequest);
console.log('+++ ZDP response' + stringify(response));
console.log(body);console.log('+++');

    if (response.Status !== '0') {
      return logger.error('device/' + self.deviceID, { event: 'Active_Desc_callback', status: response.Status });
    }

// TBD...
  };
};



Gateway.prototype.ping = function(self) {
/* TBD
  var device, devices, id, meta, neighbor;

  devices = {};
  for (id in self.neighbors) {
    if (!self.neighbors.hasOwnProperty(id)) continue;

    neighbor = self.neighbors[id];
    if (!devices[neighbor.device]) devices[neighbor.device] = 0;
    devices[neighbor.device]++;
  }

  meta = { status: self.status, id: self.info.id, devices: {} };
  for (device in devices) {
    if (!devices.hasOwnProperty(device)) continue;

    meta.devices[deviceTypes[device] || device] = devices[device];
  }
*/  var meta = { status: self.status };

  logger.info('device/' + self.deviceID, meta);
};


// called by portscanner

var pair = function(socket, ipaddr, portno, macaddr, tag) {
  var options;

  socket.destroy();

// ipaddr = '184.71.143.132';
  options = url.parse('http://' + ipaddr + ':' + portno);
  options.host = 'exgn' + macaddr.split(':').join('').substr(-6) + ':' + portno;
  soap.createClient(__dirname + '/zbGateway.wsdl', { endpoint: options }, function(err, client) {
    var info, serialNo, version;

    if (err) return logger.error('PORT ' + ipaddr + ':' + portno, { event: 'client', diagnostic: err.message });
    client.ZGDService.gmo.GetVersion({ }, function(err, response) {
      if (err) return logger.error('PORT ' + ipaddr + ':' + portno, { event: 'GetVersion', diagnostic: err.message });

      if (response.Status !== '0') {
        return logger.error('PORT ' + ipaddr + ':' + portno, { event: 'GetVersion', status: response.Status });
      }

      version = response.Version.ManufacturerVersion;
      serialNo = macaddr.split(':').join('');

      info = { source: 'portscan', portscan: { ipaddr: ipaddr, portno: portno }, client: client };
      info.device = { url          : 'http://' + ipaddr + ':' + portno
                    , name         : 'Zigbee gateway'
                    , manufacturer :  version
                    , model        : { name        : version
                                     , description : ''
                                     , number      : ''
                                     }
                    , unit         : { serialNo    : serialNo
                                     , udn         : 'uuid:2f402f80-da50-11e1-9b23-' + serialNo
                                     }
                    };
      info.url = info.device.url;
      info.deviceType = '/device/gateway/zigbee/gmo';
      info.id = info.device.unit.udn;

      if (!!devices.devices[info.id]) return;

      utility.logger('discovery').info(tag, { url: info.url });
      devices.discover(info);
    });
  });
};


// TBD: discover

exports.start = function() {
if (true) return;

  steward.actors.device.gateway.zigbee = steward.actors.device.gateway.zigbee ||
      { $info     : { type: '/device/gateway/zigbee' } };

  steward.actors.device.gateway.zigbee.gmo =
      { $info     : { type       : '/device/gateway/zigbee/gmo'
                    , observe    : [ ]
                    , perform    : [ 'wake' ]
                    , properties : { name   : true
                                   , status : [ 'ready' ]
                                   }
                    }
      , $validate : { perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/gateway/zigbee/gmo'] = Gateway;

// http://www.exegin.com/hardware/q53app.php
// http://www.exegin.com/software/zigbee_ipha.php
  require('./../../discovery/discovery-portscan').pairing([ { prefix: '00:1c:da', portno: 8080 } ], pair);

/*
  steward.forEachAddress(function(addr) {
    portfinder.getPort({ port: 8889 }, function(err, portno) {
      if (err) {
        logger.error('start', { event: 'portfinder.getPort 8887', diagnostic: err.message });
        return;
      }

      http.createServer(function(request, response) {
        var content = '';

        request.setEncoding('utf8');
        request.on('data', function(chunk) {
          content += chunk.toString();
        }).on('end', function() {
          response.writeHead(200, {});
          response.end();

console.log('+++ zigbee');
console.log(request.headers);
console.log(content);
console.log('+++');
//        broker.publish('discovery', 'notify', request.headers, content);
        });
      }).on('listening', function() {
        listener = 'http://' + addr + ':' + portno + '/services/zdpEvent';
        logger.notice('Zigbee callback listening on ' + listener);
      }).listen(portno, addr);
    });
  });
 */
};

return;
/*
{ ZGDService:
   { gmo:
      { GetVersion: [Object],
        CreateCallback: [Object],
        Get: [Object],
        Set: [Object],
        DeleteCallback: [Object],
        ListCallbacks: [Object],
        UpdateTimeout: [Object],
        PollCallback: [Object],
        StartNodeDiscovery: [Object],
        ReadNodeCache: [Object],
        StartServiceDiscovery: [Object],
        ReadServiceCache: [Object],
        StartGatewayDevice: [Object],
        ConfigureStartupAttributeSet: [Object],
        ReadStartupAttributeSet: [Object],
        PollResults: [Object],
        CreateAliasAddress: [Object],
        DeleteAliasAddress: [Object],
        ListAddresses: [Object] },
     zdp: { SendZDPCommand: [Object] },
     zcl: { SendZCLCommand: [Object] },
     aps:
      { ConfigureNodeDescriptor: [Object],
        ConfigureUserDescriptor: [Object],
        ConfigureEndpoint: [Object],
        ClearEndpoint: [Object],
        SendAPSMessage: [Object],
        AddGroup: [Object],
        RemoveGroup: [Object],
        RemoveAllGroups: [Object],
        GetGroupList: [Object],
        GetBindingList: [Object],
        GetNodeDescriptor: [Object],
        GetNodePowerDescriptor: [Object],
        GetUserDescriptor: [Object] },
     nwk:
      { FormNetwork: [Object],
        StartRouter: [Object],
        Join: [Object],
        Leave: [Object],
        DiscoverNetworks: [Object],
        Reset: [Object],
        PerformEnergyScan: [Object],
        GetNetworkStatus: [Object],
        PerformRouteDiscovery: [Object],
        SendNWKCommand: [Object] },
     interPAN: { SendInterPANMessage: [Object] } },
  IPHAService:
   { zdpEvent: { NotifyZDPEvent: [Object] },
     zclEvent: { NotifyZCLEvent: [Object] },
     apsEvent:
      { NotifyAPSMessageEvent: [Object],
        NotifySendAPSMessageEvent: [Object] },
     nwkEvent:
      { FormNetworkEvent: [Object],
        JoinEvent: [Object],
        DiscoverNetworksEvent: [Object],
        PerformEnergyScanEvent: [Object],
        NetworkStatusEvent: [Object],
        PerformRouteDiscoveryEvent: [Object],
        StartRouterEvent: [Object],
        LeaveEvent: [Object],
        ResetEvent: [Object],
        NotifyNWKMessageEvent: [Object] },
     gmoEvent:
      { StartGatewayDeviceEvent: [Object],
        NodeDiscoveryEvent: [Object],
        NodeLeaveEvent: [Object],
        ServiceDiscoveryEvent: [Object] },
     interPANEvent: { NotifyInterPANMessageEvent: [Object] } } }
*/
