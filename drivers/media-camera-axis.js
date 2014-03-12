// +++ under development
// Axis network cameras - http://www.axis.com/products/video/camera/

exports.start = function() {};
if (true) return;

var mdns
  , utility     = require('./../../core/utility')
  ;

try {
  mdns          = require('mdns');
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing camera-axis media (continuing)', { diagnostic: ex.message });
}

var
/*
    axis        = require('axiscam')
  ,
 */
    util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , media       = require('./../device-media')
  ;


var logger = media.logger;


var Axis_Camera = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
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
                    , perform    : [ 'capture', 'wake' ]
                    , properties : { name    : true
                                   , status  : [ 'idle', 'busy' ]
                                   }
                    }
      };

  try {
    mdns.createBrowser(mdns.tcp('axis-video')).on('serviceUp', function(service) {
      var info, modelName, modelNumber, serialNo, x;

      modelName = service.name;
      x = modelName.indexOf('-');
      if (x > 0) modelName = modelName.substr(0, x).trim();
      x = modelName.indexOf(' ');
      if (x > 0) modelNumber = modelName.substr(x + 1);

      serialNo = service.txtRecord.macaddress;

      info = { source     : 'mdns'
             , device     : { url          : 'http://' + service.addresses[0] + ':' + service.port + '/'
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
      info.deviceType = '/device/media/axis/camera';
      info.id = info.device.unit.udn;
      if (!!devices.devices[info.id]) return;

      logger.info('mDNS ' + info.device.name, { url: info.url });
      devices.discover(info);
    }).on('serviceDown', function(service) {
      discovery.debug('_axis-video._tcp', { event: 'down', name: service.name, host: service.host });
    }).on('serviceChanged', function(service) {
      discovery.debug('_axis-video._tcp', { event: 'changed', name: service.name, host: service.host });
    }).on('error', function(err) {
      discovery.error('_axis-video._tcp', { event: 'mdns', diagnostic: err.message });
    }).start();
  } catch(ex) {
      discovery.error('_axis-video._tcp', { event: 'browse', diagnostic: ex.message });
  }

  devices.makers['urn:axis-com:service:BasicService:1'] = '/device/ignore';
};
