var stringify   = require('json-stringify-safe')
  , server      = require('./../core/server')
  , utility     = require('./../core/utility')
  , broker      = utility.broker
  ;


var console = function(ws, tag) {/* jshint unused: false */
  ws.on('message', function(data, flags) {/* jshint unused: false */});

  broker.subscribe('beacon-egress', function(category, datum) {
    var data = {};
    data[category] = [ datum ];

    ws.send(stringify(data), function(err) { if (err) try { ws.terminate(); } catch (ex) {} });
  });

  try { ws.send(stringify(utility.signals)); } catch (ex) {}
  broker.publish('actors', 'ping');
};


exports.start = function() { server.routes['/console'] = { route : console }; };
