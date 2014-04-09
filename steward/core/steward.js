exports.actors = {};
exports.status  = {};

var ifTable     = require('arp-a').ifTable
  , net         = require('net')
  , os          = require('os')
  , pcap        = require('pcap')
  , util        = require('util')
  , devices     = require('./device')
  , server      = require('./server')
  , utility     = require('./utility')
  , discovered1 = require('./../discovery/discovery-mac').arp
  , discovered2 = require('./../discovery/discovery-ssdp').arp
  , activities  = require('./../api/api-manage-activity')
  , events      = require('./../api/api-manage-event')
  , groups      = require('./../api/api-manage-group')
  , tasks       = require('./../api/api-manage-task')
  , broker      = utility.broker
  ;


var logger = exports.logger = utility.logger('steward');


exports.observed = function(eventID) {
  var event = events.id2event(eventID);

  if (!!event) {
    event.observeP = true;
    event.lastTime = new Date();
  }
};


exports.report = function(eventID, meta) {
  var event = events.id2event(eventID);

  if (!event) return;

  event.observeP = false;
  if (!!meta.error) {
    logger.warning('event/' + eventID, meta);
    event.watchP = false;
    return;
  }

  event.watchP = true;
};


exports.performed = function(taskID) {
  var task = tasks.id2task(taskID);

  if (!!task) task.lastTime = new Date();

  return true;
};


var scan = function() {
  var activity, device, event, i, now, performance, performances, task, uuid;

  now = new Date();
  for (uuid in events.events) {
    if (!events.events.hasOwnProperty(uuid)) continue;

    event = events.events[uuid];
    if (event.conditionP) check(event, now);
    else if (!event.watchP) broker.publish('actors', 'observe', event.eventID, event.actor, event.observe, event.parameter);
  }

  for (uuid in activities.activities) {
    if (!activities.activities.hasOwnProperty(uuid)) continue;

    activity = activities.activities[uuid];
    if (!activity.armed) continue;
    if (activity.lastTime === null) activity.lastTime = 0;

    if ((observedP(activity.event)) && (observedT(activity.event) > activity.lastTime)) {
      activity.lastTime = now;
      prepare(activity.task);
    }
  }

  for (uuid in events.events) {
    if (!events.events.hasOwnProperty(uuid)) continue;

    event = events.events[uuid];
    if (!event.conditionP) event.observeP = false;
  }

  performances = [];
  for (uuid in tasks.tasks) {
    if (!tasks.tasks.hasOwnProperty(uuid)) continue;

    task = tasks.tasks[uuid];
    if (!task.performP) continue;

    task.performP = false;

    performances.push({ taskID:    task.taskID
                      , devices:   participants(task.actor)
                      , perform:   task.perform
                      , parameter: task.parameter });
  }

  for (i = 0; i < performances.length; i++) {
    performance = performances[i];
// TBD: i rather dislike double notices...
    if (performance.perform !== 'growl') {
// .info
      logger.notice('perform',
                  { taskID: performance.taskID, perform: performance.perform, parameter: performance.parameter });
    }

    for (device in performance.devices) {
      if (!performance.devices.hasOwnProperty(device)) continue;

      broker.publish('actors', 'perform', performance.taskID, device, performance.perform, performance.parameter);
    }
  }
};


var check = function(event, now) {
  var actor, entity, info, params, previous, proplist;

  actor = exports.actors[event.actorType];
  if (!actor) return;
  entity = actor.$lookup(event.actorID);
  if (!entity) return;
  proplist = entity.proplist();
  info = utility.clone(proplist.info);
  info.status = proplist.status;

  try { params = JSON.parse(event.parameter); } catch(ex) { params = null; }
  previous = event.observeP;
  event.observeP = (!!params) && evaluate(params, entity, info);
  if (event.observeP !== previous) event.lastTime = now;
};

var evaluate = function(params, entity, info) {
  var p, result;

  switch (params.operator) {
    case 'equals':
      if ((params.operand1) && (params.operand2))
        return (evaluate(params.operand1, entity, info) === evaluate(params.operand2, entity, info));
      break;

    case 'not-equals':
      if ((params.operand1) && (params.operand2))
        return (evaluate(params.operand1, entity, info) !== evaluate(params.operand2, entity, info));
      break;

    case 'less-than':
      if ((params.operand1) && (params.operand2))
        return (evaluate(params.operand1, entity, info) < evaluate(params.operand2, entity, info));
      break;

    case 'less-than-or-equals':
      if ((params.operand1) && (params.operand2))
        return (evaluate(params.operand1, entity, info) <= evaluate(params.operand2, entity, info));
      break;

    case 'greater-than':
      if ((params.operand1) && (params.operand2))
        return (evaluate(params.operand1, entity, info) > evaluate(params.operand2, entity, info));
      break;

    case 'greater-than-or-equals':
      if ((params.operand1) && (params.operand2))
        return (evaluate(params.operand1, entity, info) >= evaluate(params.operand2, entity, info));
      break;

    case 'any-of':
      if ((!params.operand1) || (!params.operand2)) break;
      result = evaluate(params.operand1, entity, info);
      if (!util.isArray(params.operand2)) return (result === evaluate(params.operand2, entity, info));
      for (p = 0; p < params.operand2.length; p++) if (result === evaluate(params.operand2[p], entity, info)) return true;
      break;

    case 'none-of':
      if ((!params.operand1) || (!params.operand2)) break;
      result = evaluate(params.operand1, entity, info);
      if (!util.isArray(params.operand2)) return (result !== evaluate(params.operand2, entity, info));
      for (p = 0; p < params.operand2.length; p++) if (result === evaluate(params.operand2[p], entity, info)) return false;
      return true;

    case 'present':
      if (params.operand1) return (!!evaluate(params.operand1, entity, info));
      break;

    case 'not':
      if (params.operand1) return (!evaluate(params.operand1, entity, info));
      break;

    case 'and':
      if (!params.operands) return true;
      if (!util.isArray(params.operands)) return evaluate(params.operands, entity, info);
      for (p = 0; p < params.operands.length; p++) if (!evaluate(params.operands[p], entity, info)) return false;
      return true;

    case 'or':
      if (!params.operands) return false;
      if (!util.isArray(params.operands)) return evaluate(params.operands, entity, info);
      for (p = 0; p < params.operands.length; p++) if (evaluate(params.operands[p], entity, info)) return true;
      return false;

    default:
      if (typeof params === 'number') return params;
      if (typeof params === 'string') return devices.expand(params, entity);
      break;
  }

  return false;
};

var observedP = function(whoami) {
  var event, group, i, parts, result;

  parts = whoami.split('/');
  switch (parts[0]) {
    case 'event':
      event = events.id2event(parts[1]);
      return ((!!event) ? event.observeP : false);

    case 'group':
      group = groups.id2group(parts[1]);
      if ((!group) || (group.members.length < 1)) return false;

      for (i = 0; i < group.members.length; i++) {
        result = observedP(group.members[i].actor);
        switch (group.groupOperator) {
          case groups.operators.and:
            if (!result) return false;
            break;

          case groups.operators.or:
            if (result) return true;
            break;

          case groups.operators.not:
            return (!result);

          default:
            return false;
        }
      }
      return (group.groupOperator === groups.operators.and);

    default:
      return false;
  }
};

var observedT = function(whoami) {
  var event, group, i, lastTime, parts, result;

  parts = whoami.split('/');
  switch (parts[0]) {
    case 'event':
      event = events.id2event(parts[1]);
      return ((event && event.lastTime) || 0);

    case 'group':
      group = groups.id2group(parts[1]);
      if ((!group) || (group.members.length < 1)) return false;

      lastTime = observedT(group.members[0].actor);
      for (i = 1; i < group.members.length; i++) {
        result = observedT(group.members[i].actor);
        if (result > lastTime) lastTime = result;
      }
      return lastTime;

    default:
      return 0;
  }
};


var prepare = exports.prepare = function(whoami) {
  var task, group, i, parts;

  parts = whoami.split('/');
  switch (parts[0]) {
    case 'task':
      task = tasks.id2task(parts[1]);
      if (!task) break;
      task.performP = (task.guardType === '') || (observedP(task.guardType + '/' + task.guardID));
      break;

// TBD: temporal ordering
    case 'group':
      group = groups.id2group(parts[1]);
      if (!!group) for (i = 0; i < group.members.length; i++) prepare(group.members[i].actor);
      break;

    default:
      break;
  }
};

// TBD: temporal ordering

var participants = exports.participants = function(whoami) {
  var device, group, i, parts, result, results, task;

  results = {};

  parts = whoami.split('/');
  switch (parts[0]) {
    case 'task':
      task = tasks.id2task(parts[1]);
      return ((!!task) ? participants(task.actor) : {});

    case 'group':
      group = groups.id2group(parts[1]);
      if (!group) break;

      for (i = 0; i < group.members.length; i++) {
        result = participants(group.members[i].actor);
        for (device in result) if (result.hasOwnProperty(device)) results[device] = true;
      }
      break;

    default:
      results[whoami] = true;
      break;
  }

  return results;
};


var report = function(module, entry, now) {
  var last;

  if (!!entry.busyP) return;
  last = entry.last || 0;
  if (last >= require('./device').lastupdated) return;

  entry.busyP = true;
  entry.reporter(logger, { send: function(data) {/* jshint unused: false */
    entry.busyP = false;
    entry.last = now;
  }});
};


var ifaces = exports.ifaces = utility.clone(os.networkInterfaces());

var listen = function(ifname, ifaddr) {
  return function(raw) {
    var arp, packet;

    packet = pcap.decode.packet(raw);
    if ((!packet.link) || (!packet.link.arp)) return;
    arp = packet.link.arp;
    if ((!arp.sender_ha) || (!arp.sender_pa)) return;

    ifaces[ifname].arp[arp.sender_pa] = arp.sender_ha;
    if (arp.sender_pa === ifaddr) {
      if (!exports.uuid) exports.uuid = '2f402f80-da50-11e1-9b23-' + arp.sender_ha.split(':').join('');
    } else if (arp.target_pa === ifaddr) {
      if (!exports.uuid) exports.uuid = '2f402f80-da50-11e1-9b23-' + arp.target_ha.split(':').join('');
    }
    discovered1(ifname, ifaddr, arp);
    discovered2(ifname, ifaddr, arp);
    devices.arp(ifname, ifaddr, arp);
  };
};

var prime = function(ifaddr) {
  var i, ipaddr, prefix;

  prefix = ifaddr.split('.').slice(0, 3).join('.');
  for (i = 0; i < 5; i++) {
    ipaddr = prefix + '.' + (Math.floor(Math.random() * 254) + 1);
    if (ipaddr !== ifaddr) pinger(ipaddr);
  }
};

var pinger = function(ipaddr) {
  var socket = new net.Socket({ type: 'tcp4' });

  socket.setTimeout(500);
  socket.on('connect', function() {
    socket.destroy();
  }).on('timeout', function() {
    socket.destroy();
  }).on('error', function(error) {/* jshint unused: false */
  }).on('close', function(errorP) {/* jshint unused: false */
  }).connect(8888, ipaddr);
};


exports.forEachAddress = function(callback) {
  var ifa, ifaddrs, ifname;

  for (ifname in ifaces) {
    if (!ifaces.hasOwnProperty(ifname)) continue;

    ifaddrs = ifaces[ifname].addresses;
    for (ifa = 0; ifa < ifaddrs.length; ifa++) {
      if ((!ifaddrs[ifa].internal) && (ifaddrs[ifa].family === 'IPv4')) callback(ifaddrs[ifa].address);
    }
  }
};


var clientN = 0;

exports.clientInfo = function(connection, secureP) {
  var props;
/*
  var ifname;
 */

  props = { loopback       : false
          , subnet         : false
          , local          : false
          , remoteAddress  : connection.remoteAddress
          , remotePort     : connection.remotePort
          , secure         : secureP
          , clientSerialNo : clientN++
          };

// NB: note that https://127.0.0.1 is remote access
  if (connection.remoteAddress === '127.0.0.1') props.loopback = !secureP;
  else {
// TBD: in node 0.11, this should be reworked....
//      would prefer to distinguish between on the same subnet or not
    props.subnet = true;
/*
    for (ifname in ifaces) {
      if (!ifaces.hasOwnProperty(ifname)) continue;

      if (!!ifaces[ifname].arp[connection.remoteAddress]) {
        props.subnet = true;
        break;
      }
    }
 */
  }

  props.local = props.loopback || props.subnet;

  return props;
};

// NB: this is the access policy for read-only access
var places = null;

exports.readP = function(clientInfo) {
  if ((!clientInfo.local) && (!clientInfo.userID)) return false;

  if (!places) places = require('./../actors/actor-place');
  if ((!!places) && (!!places.place1) && (places.place1.info.strict === 'off')) return true;

  return (clientInfo.loopback || (clientInfo.subnet && clientInfo.secure) || (!!clientInfo.userID));
};


var ifmac = {};

exports.start = function() {
  ifTable(function(err, entry) {
    var mac;

    if ((!!err) || (!entry)) {
      if (!!err) logger.error('arp-a.ifTable', { diagnostic: err.message });
      return pass1();
    }

    mac = entry.mac.split(':').join('');
    if (mac.length === 0) return;
    while (mac.substring(0, 1) === '0') mac = mac.substring(1);
    if (mac.length === 0) return;
    
    if (!ifmac[entry.name]) ifmac[entry.name] = [];
    ifmac[entry.name].push(entry.mac);
  });
};

var pass1 = function() {
  var captureP, errorP, ifa, ifaddrs, ifname, ifname2, noneP;

  errorP = false;
  noneP = true;
  for (ifname in ifaces) {
    if ((!ifaces.hasOwnProperty(ifname))
          || (ifname.indexOf('vmnet') === 0)
          || (ifname.indexOf('vboxnet') === 0)
          || (ifname.indexOf('vnic') === 0)
          || (ifname.indexOf('tun') !== -1)) continue;

    ifaddrs = ifaces[ifname];
    if (ifaddrs.length === 0) continue;

    captureP = false;
    for (ifa = 0; ifa < ifaddrs.length; ifa++) {
      if ((ifaddrs[ifa].internal) || (ifaddrs[ifa].family !== 'IPv4')) continue;

      logger.info('scanning ' + ifname);
      ifaces[ifname] = { addresses: ifaddrs, arp: {} };
      if (!!ifmac[ifname]) ifaces[ifname].macaddrs = ifmac[ifname];
      try {
        pcap.createSession(ifname, 'arp').on('packet', listen(ifname, ifaddrs[ifa].address));
        captureP = true;
      } catch(ex) {
        logger.error('unable to scan ' + ifname, { diagnostic: ex.message });
        errorP = true;
      }

      break;
    }
    if (!captureP) continue;
    noneP = false;

    for (ifa = 0; ifa < ifaddrs.length; ifa++) {
      if ((!ifaddrs[ifa].internal) && (ifaddrs[ifa].family === 'IPv4')) prime(ifaddrs[ifa].address);
    }
  }
  if (noneP) {
    logger.error('no network interfaces');
    if (errorP) {
      if ((!!process.getgid) && ((!process.getuid) || (process.getuid() !== 0))) {
        if (os.platform() === 'darwin') {
          console.log('hint: $ sudo sh -c "chmod g+r /dev/bpf*; chgrp ' + process.getgid() + ' /dev/bpf*"');
        } else {
          console.log('hint: $ sudo sh -c ./run.sh');
        }
      }
      process.exit(1);
    }
  }

  for (ifname2 in ifaces) if ((ifaces.hasOwnProperty(ifname2)) && (util.isArray(ifaces[ifname2]))) delete(ifaces[ifname2]);

  exports.status.logs = { reporter: function(logger, ws) { ws.send(JSON.stringify(utility.signals)); } };

  utility.acquire(logger, __dirname + '/../actors', /^actor-.*\.js$/, 6, -3, ' actor');

  return pass2();
};


var failedN = 0;

var pass2 = function() {
  var ifname;

  if (utility.acquiring > 0) return setTimeout(pass2, 10);

  if (!!exports.uuid) {
    logger.notice('start', { uuid: exports.uuid });
    server.start();
    setInterval(scan, 3 * 1000);
    setInterval(function() {
      var module, now;

      now = new Date();
      for (module in exports.status) if (exports.status.hasOwnProperty(module)) report(module, exports.status[module], now);
    }, 15 * 1000);
    return;
  }

  failedN++;
  if (failedN < 100) return setTimeout(pass2, 10);

  logger.info('start', { diagnostic: 'determine UUID address using method #2' });
  for (ifname in ifaces) {
    if ((!ifaces[ifname].macaddrs) || (ifaces[ifname].macaddrs.length === 0)) continue;

    logger.info('start', { diagnostic: 'determining UUID using method #2' });
    exports.uuid = '2f402f80-da50-11e1-9b23-' + ifaces[ifname].macaddrs[0].split(':').join('');
    return pass2();
  }

  logger.fatal('start', { diagnostic: 'unable to determine MAC address of any interface' });
};
