// Thing Sensor Reporting Protocol

var dgram       = require('dgram')
  , util        = require('util')
  , devices     = require('./../core/device')
  , things      = require('./../api/api-manage-thing')
  , utility     = require('./../core/utility')
  ;


var logger = utility.logger('discovery');


var handle = exports.handle = function(message, remoteAddress, tag) {
  var didP, i, instance, okP, props, request, requestID, thingPath;

  if (!message.requestID) return logger.error(tag, { event: 'report', error: { diagnostic: 'no requestID' } });
  if (!message.requestID.length) return logger.error(tag, { event: 'report', error: { diagnostic: 'empty requestID' } });
  requestID = message.requestID;

  request = { path      : '/api/v1/thing/prototype'
            , requestID : requestID
            , things    : {}
            };
  didP = false;
  for (thingPath in message.things) {
    if (!message.things.hasOwnProperty(thingPath)) continue;

    props = message.things[thingPath];
    if (!props.prototype) {
      logger.error(tag, { event: 'report', requestID: requestID, error: { diagnostic: 'missing prototype in ' + thingPath } });
      continue;
    }
    if (!util.isArray(props.instances)) {
      logger.error(tag, { event: 'report', requestID: requestID, error: { diagnostic: 'invalid instances in ' + thingPath } });
      continue;
    }
    okP = true;
    for (i = 0; i < props.instances.length; i++) {
      instance = props.instances[i];
      if ((!instance.name) || (!instance.status) || (!instance.unit) || (!instance.unit.serial) || (!instance.unit.udn)) {
        logger.error(tag, { event     : 'report'
                          , requestID : requestID
                          , instance  : JSON.stringify(instance)
                          , error     : { diagnostic: 'invalid instance #' + i + ' in ' + thingPath } });
        okP = false;
      }
    }
    if (!okP) continue;

    didP = true;
    if ((!props.prototype.name) && (!props.prototype.status)) continue;

    if (!props.prototype.properties) props.prototype.properties = {};
    props.prototype.properties.lastSample = 'timestamp';
    request.things[thingPath] = { observe    : []
                                , perform    : []
                                , device     : props.prototype.device
                                , name       : props.prototype.name
                                , status     : props.prototype.status
                                , properties : props.prototype.properties
                                , validate   :
                                  { observe  : false
                                  , perform  : false
                                  }
                                };
  }
  if (!didP) return;

  things.protodef(logger, { clientInfo : { loopback: false, subnet: true, local: true, remoteAddress: remoteAddress }
                          , send       : function(data) { register(message, data, remoteAddress, tag); } },
                  { prefix: '/api/v1/thing/prototype' }, request, tag);
};

var register = function(message, data, remoteAddress, tag) {
  var changedP, device, didP, i, info, instance, props, request, requestID, results, thing, thingPath, updated;

  try { results = JSON.parse(data); } catch(ex) {
    return logger.error(tag, { event: 'protodef', requestID: message.requestID, error: { diagnostic: ex.message } });
  }

  requestID = message.requestID;
  if (!examine('protodef', requestID, results, tag)) return;

  request = { path      : '/api/v1/thing/register'
            , requestID : requestID
            , things    : {}
            };
  didP = false;
  updated = new Date().getTime();
  for (thingPath in message.things) {
    if (!message.things.hasOwnProperty(thingPath)) continue;

    props = message.things[thingPath];
    if (!util.isArray(props.instances)) continue;
    if (!props.prototype.device) {
      info = things.things[thingPath];
      if (!info) continue;
      props.prototype.device = info.thingDefinition.device;
    }

    thing = { devicetype : thingPath
            , device     : props.prototype.device
            , updated    : updated
            };

    for (i = 0; i < props.instances.length; i++) {
      instance = props.instances[i];
      if ((!instance.name) || (!instance.status) || (!instance.unit) || (!instance.unit.serial) || (!instance.unit.udn)) {
        continue;
      }

      if (!!devices.devices[instance.unit.udn]) {
        device = devices.devices[instance.unit.udn].device;
        if (!device.thingID) {
          logger.error(tag, { event: 'register', requestID: message.requestID, error: { diagnostic: 'invalid thing' } });
          continue;
        }

        if ((!!instance.name) && (instance.name !== device.name)) {
          changedP = true;
          device.name = instance.name;
        }
        if ((!!instance.status) && (instance.status !== device.status)) {
          changedP = true;
          device.status = instance.status;
        }
        if ((!!instance.updated) && (instance.updated !== device.updated)) {
          changedP = true;
          device.updated = instance.updated;
        }
        device.ping(device);
        if (!!instance.uptime) device.bootime = updated - instance.uptime;
        if (!device.info.lastSample) device.info.lastSample = updated;
        device.addinfo(instance.info, changedP);
        continue;
      }

      thing.name = instance.name;
      thing.status = instance.status;
      thing.device.unit = instance.unit;
      thing.info = instance.info;
      request.things[i.toString()] = thing;

      didP = true;
    }
  }
  if (!didP) return;

  things.register(logger, { clientInfo : { loopback: false, subnet: true, local: true, remoteAddress: remoteAddress }
                          , send       : function(data) { update(message, data, tag); } },
                  { prefix: '/api/v1/thing/register' }, request, tag);
};

var update = function(message, data, tag) {
  var results;

  try { results = JSON.parse(data); } catch(ex) {
    return logger.error(tag, { event: 'register', requestID: message.requestID, error: { diagnostic: ex.message } });
  }

  examine('register', message.requestID, results, tag);
};

var examine = function(event, requestID, results, tag) {
  var okP, props, thingPath;

  if ((!!results) && (!!results.error)) {
    logger.error(tag, { event: event, requestID: requestID, error: results.error });
    return false;
  }

  okP = true;
  for (thingPath in results.things) {
    if (!results.things.hasOwnProperty(thingPath)) continue;

    props = results.things[thingPath];
    if (!!props.error) {
      logger.error(tag, { event: event, requestID: requestID, error: props.error });
      okP = false;
    }
  }

  return okP;
};


exports.start = function() {
  var ipaddr = '224.0.9.1'
    , portno = 22601;

  dgram.createSocket('udp4').on('message', function(message, rinfo) {
    var report;

    try { report = JSON.parse(message); } catch(ex) {
      return logger.error('discovery', { event: 'TSRP parse', diagnostic: ex.message });
    }
    handle(report, rinfo.address, 'udp ' + rinfo.address + ' ' + rinfo.port + ' ' + report.path);
  }).on('listening', function() {
    var address = this.address();

    logger.info('TSRP listening on multicast udp://' + ipaddr + ':' + address.port);
    try { this.addMembership(ipaddr); } catch(ex) {
      logger.error('discovery-tsrp', { event: 'addMembership', diagnostic: ex.message });
    }
    try { this.setMulticastLoopback(true); } catch(ex) {
      logger.error('discovery-tsrp', { event: 'setMulticastLoopback', diagnostic: ex.message });
    }
  }).on('error', function(err) {
    logger.error('reporting', { event: 'socket', diagnostic: err.message });
  }).bind(portno, ipaddr);
};
