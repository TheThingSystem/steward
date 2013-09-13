var stringify   = require('json-stringify-safe')
  , util        = require('util')
  , server      = require('./../core/server')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  , broker      = utility.broker
  ;


var logger = utility.logger('server');
var places = null;


var consoleX = function(ws, tag) {
  var meta;

  if (!places) places = require('./../actors/actor-place');

  if ((!places.place1.info.insecure) && (!steward.readP(ws.clientInfo))) {
    meta = utility.clone(ws.clientInfo);

    meta.event = 'access';
    meta.diagnostic = 'unauthorized';
    meta.resource = 'console';
    logger.warning(tag, meta);
    
    try {
      ws.send(stringify({ error: { permanent: true, diagnostic: 'access control' }}), function(err) {
        if (err) try {ws.terminate(); } catch(ex) {}
      });
   } catch(ex) {}
    return;
  }

  ws.on('message', function(data, flags) {/* jshint unused: false */});

  broker.subscribe('beacon-egress', function(category, datum) {
    var data = {};

    if (!util.isArray(datum)) datum = [ datum ];
    data[category] = datum;

// stringify -- not JSON.stringify() -- in case there's something circular
    try { ws.send(stringify(data), function(err) { if (err) try { ws.terminate(); } catch(ex) {} }); } catch(ex) {}
  });

  try { ws.send(stringify(utility.signals)); } catch(ex) {}
  broker.publish('actors', 'attention');
  broker.publish('actors', 'ping');
};


exports.start = function() { server.routes['/console'] = { route : consoleX }; };
