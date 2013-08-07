// +++ under development
// Axis network cameras - http://www.axis.com/products/video/camera/


exports.start = function() {};
if (true) return;

var 
/*
    axis        = require('axiscam')
  , 
 */
    mdns        = require('mdns')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , media       = require('./../device-media')
  ;


var logger = media.logger;

var Axis_Camera = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/media/axis/camera';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;

/*
  o = url.parse(info.url);
  self.axis = new sonos.Sonos(o.hostname, o.port);
*/
  self.status = 'idle';
  self.changed();

  utility.broker.subscribe('actors', function(request, taskID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') return self.observe(self, taskID, observe, parameter);
    if (request === 'perform') return self.perform(self, taskID, observe, parameter);
  });

};
util.inherits(Axis_Camera, media.Device);


exports.start = function() {
  var discovery = utility.logger('discovery');

  steward.actors.device.media.axis = steward.actors.device.media.axis ||
      { $info     : { type: '/device/media/axis' } };

  steward.actors.device.media.axis.camera =
      { $info     : { type       : '/device/media/axis/camera'
                    , observe    : [ 'motion' ]
                    , perform    : [ 'capture' ]
                    , properties : { name    : true
                                   , status  : [ 'idle', 'busy' ]
                                   }
                    }
      };
  devices.makers['urn:axis-com:service:BasicService:1'] = Axis_Camera;

// AXIS supports both mDNS and UPnP
  new mdns.Browser('_axis-video._tcp').on('serviceUp', function(service) {
    var info, modelName, modelNumber, serialNo, x;

    modelName = service.name;
    x = modelName.indexOf('-');
    if (x > 0) modelName = modelName.substr(0, x).trim();
    x = modelName.indexOf(' ');
    if (x > 0) modelNumber = modelName.substr(x + 1);

    serialNo = service.txtRecord.macaddress;

    info = { source     : 'mdns'
           , device     : { url          : 'http://' + service.host + ':' + service.port + '/'
                          , name         : service.name
                          , manufacturer : 'AXIS'
                          , model        : { name        : modelName
                                           , description : modelName + ' Network Camera'
                                           , number      : modelNumber
                                           }
                          , unit         : { serial      : serialNo
                                           , udn         : 'uuid:Upnp-BasicDevice-1_0-' + serialNo
                                           }
                          }
           };

    info.url = info.device.url;
    info.deviceType = info.device.model.name;
    info.deviceType2 = 'urn:schemas-upnp-org:device:Basic:1';
    info.deviceType3 = 'urn:axis-com:service:BasicService:1';
    info.id = info.device.unit.udn;
    if (devices.devices[info.id]) return;

    logger.info('mDNS ' + info.device.name, { url: info.url });
    devices.discover(info);
  }).on('serviceDown', function(service) {
    discovery.debug('_axis-video._tcp', { event: 'down', name: service.name, host: service.host });
  }).on('serviceChanged', function(service) {
    discovery.debug('_axis-video._tcp', { event: 'changed', name: service.name, host: service.host });
  }).on('error', function(err) {
    discovery.error('_axis-video._tcp', { event: 'mdns', diagnostic: err.message });
  }).start();
};
