var net        = require('net')
  , os         = require('os')
  , pcap       = require('../steward/node_modules/pcap')
  ;


var listen = function(ifname, ifaddr) {
  console.log('listening on ' + ifname + ': ' + ifaddr);

  return function(raw) {
    var arp, packet;

    packet = pcap.decode.packet(raw);
    if ((!packet.link) || (!packet.link.arp)) return;
    arp = packet.link.arp;
    if ((!arp.sender_ha) || (!arp.sender_pa)) return;

    console.log(ifname + ': arp ' + arp.operation + ' sender=' + arp.sender_ha + '[' + arp.sender_pa + '] + target='
                + arp.target_ha + '[' + arp.target_pa + ']');
    if (arp.sender_pa === ifaddr) console.log(ifname + ': my MAC address is ' + arp.sender_ha);
    if (arp.target_pa === ifaddr) console.log(ifname + ': my MAC address is ' + arp.target_ha);
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

  console.log('TCP probe of ' + ipaddr);
  socket.setTimeout(500);
  socket.on('connect', function() {
    socket.destroy();
  }).on('timeout', function() {
    socket.destroy();
  }).on('error', function(error) {/* jshint unused: false */
  }).on('close', function(errorP) {/* jshint unused: false */
  }).connect(8888, ipaddr);
};


var captureP, errorP, noneP;
var ifa, ifname, ifaddrs, ifaces;

errorP = false;
noneP = true;
ifaces = os.networkInterfaces();
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

    console.log('scanning ' + ifname);
    ifaces[ifname].arp = {};
    try {
      pcap.createSession(ifname, 'arp').on('packet', listen(ifname, ifaddrs[ifa].address));
      captureP = true;
    } catch(ex) {
      console.log('unable to scan ' + ifname, { diagnostic: ex.message });
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
if ((noneP) && (!errorP)) console.log('no network interfaces');
