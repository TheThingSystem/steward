var net         = require('net')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = utility.logger('discovery');

var pairings = {};

var timer = null;

var zero;

var search = function() {
  var i, ipaddr, prefix;

  timer = null;

  logger.info('PORT starting scan');
  zero = 0;

  steward.forEachAddress(function(addr) {
    prefix = addr.split('.').slice(0, 3).join('.');
    for (i = 1; i< 255; i++) {
      ipaddr = prefix + '.' + i;
      if (ipaddr !== addr) scan(ipaddr);
    }
  });
};

var scan = function(ipaddr) {
  var device, portno, uid;

  zero++;

  for (uid in devices.devices) {
    if (!devices.devices.hasOwnProperty(uid)) continue;

    device = devices.devices[uid];
    if ((!device.device) || (!device.device.discovery)) continue;
    if (device.device.discovery.ipaddress === ipaddr) {
      if (--zero === 0) finish();
      return;
    }
  }

  for (portno in pairings) if ((pairings.hasOwnProperty(portno)) && (!pairings[portno].hosts[ipaddr])) test(ipaddr, portno);

  if (--zero === 0) finish();
};

var test = function(ipaddr, portno) {
  var connectedP, socket;

  zero++;

  socket = new net.Socket({ type: 'tcp4' });
  socket.setTimeout(2000);
  connectedP = false;

  socket.on('connect', function() {
    var cb, ifname, macaddr, prefix;

    socket.setTimeout(0);
    socket.removeAllListeners();
    connectedP = true;

    macaddr = '';
    for (ifname in steward.ifaces) {
      if ((!steward.ifaces.hasOwnProperty(ifname)) || (!steward.ifaces[ifname].arp[ipaddr])) continue;
        macaddr = steward.ifaces[ifname].arp[ipaddr];
        break;
    }
    if (macaddr === '') {
      logger.warning('PORT retry', { address: ipaddr, port: portno });
      if (--zero === 0) finish();
      return socket.destroy();
    }

    pairings[portno].hosts[ipaddr] = true;
    prefix = macaddr.substr(0, 8);
    if (!!pairings[portno].callbacks[prefix]) cb = pairings[portno].callbacks[prefix];
    else if (!!pairings[portno].callbacks['']) cb = pairings[portno].callbacks[prefix = ''];
    else {
      if (--zero === 0) finish();
      return socket.destroy();
    }

    logger.info('PORT response', { address: ipaddr, port: portno, macaddr: macaddr, prefix: prefix });
    (cb)(socket, ipaddr, portno, macaddr, 'PORT ' + ipaddr + ':' + portno);
    if (--zero === 0) finish();
  }).on('timeout', function() {
    if (!connectedP) socket.destroy();
  }).on('error', function(error) {/* jshint unused: false */
  }).on('close', function(errorP) {/* jshint unused: false */
    if (--zero === 0) finish();
  }).connect(portno, ipaddr);
};

var finish = function() {
  if (timer !== null) return;

  logger.info('PORT finished scan');
  timer = setTimeout(search, 300 * 1000);
};


exports.pairing = function(entries, cb) {
  var i, entry;

  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    if (typeof entry === 'number') entry = { portno: entry, prefix: '' };
    else if (!entry.prefix) entry.prefix = '';

    if (!pairings[entry.portno]) pairings[entry.portno] = { callbacks: {}, hosts: {} };
    pairings[entry.portno].callbacks[entry.prefix] = cb;
  }
};


exports.start = function() {
  timer = setTimeout(search, 5 * 1000);
};
