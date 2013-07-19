var dgram       = require('dgram')
  , util        = require('util')
  , devices     = require('./../core/device')
  , things      = require('./../api/api-manage-thing')
  , utility     = require('./../core/utility')
  ;


var logger = utility.logger('discovery');


var handle = function(message, tag) {
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
                          , error: { diagnostic: 'invalid instances #' + i + ' in ' + thingPath } });
        okP = false;
      }
    }
    if (!okP) continue;

    request.things[thingPath] = { observe    : []
                                , perform    : []
                                , name       : props.prototype.name
                                , status     : props.prototype.status
                                , properties : props.prototype.properties
                                , validate   :
                                  { observe  : false
                                  , perform  : false
                                  }
                                };
    didP = true;
  }
  if (!didP) return;

  things.protodef(logger, { clientInfo: {}, send: function(data) { register(message, data, tag); } },
                  { prefix: '/api/v1/thing/prototype' }, request, tag);
};

var register = function(message, data, tag) {
  var device, didP, i, instance, prop, props, request, requestID, results, thing, thingPath, updated;

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
    if (!props.prototype.device) props.prototype.device = {};

    thing = { devicetype : thingPath
            , device     :
              { name     : props.prototype.device.name
              , maker    : props.prototype.device.maker
              , model    : props.prototype.device.model
              }
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

        device.name = instance.name;
        device.status = instance.status;
        device.updated = updated;
        device.ping(device);
        if (!!instance.uptime) device.bootime = updated - instance.uptime;
        for (prop in instance.info) if (instance.info.hasOwnProperty(prop)) device.info[prop] = instance.info[prop];
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

  things.register(logger, { clientInfo: {}, send: function(data) { update(message, data, tag); } },
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
  var ipaddr = '224.192.32.19'
    , portno = 22601;

  dgram.createSocket('udp4').on('message', function(message, rinfo) {
    var report;

    try { report = JSON.parse(message); } catch(ex) {
      return;
    }
    handle(report, 'udp ' + rinfo.address + ' ' + rinfo.port + ' ' + report.path);
  }).on('listening', function() {
    var address = this.address();

    logger.info('STRP listening on udp://*:' + address.port);
    this.addMembership(ipaddr);
  }).on('error', function(err) {
    logger.error('reporting', { event: 'socket', diagnostic: err.message });
  }).bind(portno);
};
