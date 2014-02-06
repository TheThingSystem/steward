/*
var stringify   = require('json-stringify-safe')
  , utility     = require('./../utility')
  ;


var logger = utility.logger('discovery');
*/


var pairings = {};


exports.arp = function(ifname, ifaddr, arp) {/* jshint unused: false */
  test(ifname, arp.sender_ha, arp.sender_pa);
  test(ifname, arp.target_ha, arp.target_pa);
};

var test = function(ifname, macaddr, ipaddr) {
  var oui;

  macaddr = macaddr.split('-').join('').split(':').join('').toLowerCase();
  oui = macaddr.substr(0, 6);
  if ((!pairings[oui]) || (!pairings[oui].callback)) return;
       if (!pairings[oui].macaddrs) pairings[oui].macaddrs = {};
/* always trigger callback (e.g., for nest protect activity)
  else if (!!pairings[oui].macaddrs[macaddr]) return;
 */

  pairings[oui].macaddrs[macaddr] = { ifname: ifname, ipaddr: ipaddr };
  (pairings[oui].callback)(ipaddr, macaddr, 'MAC ' + macaddr + ': ' + ipaddr);
};


exports.pairing = function(ouis, cb) {
  var i, oui;

  for (i = 0; i < ouis.length; i++) {
    oui = ouis[i].split('-').join('').split(':').join('').substr(0, 6).toLowerCase();

    if (!pairings[oui]) pairings[oui] = { macaddrs: {} };
    pairings[oui].callback = cb;
  }
};

exports.start = function() {
};
