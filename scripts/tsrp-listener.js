var dgram  = require('dgram')
  , os     = require('os')
  , ipaddr = '224.0.9.1'
  , portno = 22601
  ;


var ifApply = function(cb) {
  var ifa, ifaddrs, ifname, ifaces;

  ifaces = os.networkInterfaces();
  for (ifname in ifaces) {
    if ((!ifaces.hasOwnProperty(ifname)) || (ifname.substr(0, 5) === 'vmnet') || (ifname.indexOf('tun') !== -1)) continue;

    ifaddrs = ifaces[ifname];
    for (ifa = 0; ifa < ifaddrs.length; ifa++) {
      if ((!ifaddrs[ifa].internal) && (ifaddrs[ifa].family === 'IPv4')) cb(ifname, ifaddrs[ifa].address);
    }
  }
};

ifApply(function(ifname, ipaddr) {
  dgram.createSocket('udp4').on('message', function(message, rinfo) {
    console.log(JSON.stringify(rinfo));
    console.log(message.toString());
    console.log('');
  }).on('listening', function() {
    console.log('listening on ' + ifname + ' for multicast udp://' + ipaddr + ':' + portno);

    this.addMembership(ipaddr);
  }).on('error', function(err) {
    console.log('socket: ' + err.message);
  }).bind(portno, ipaddr);
});
