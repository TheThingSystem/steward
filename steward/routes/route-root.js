var manage      = require('./route-manage')
  , routes      = require('./../core/server').routes
  , utility     = require('./../core/utility')
  ;


var route = function(ws, tag) {
  var api, apis, i, results, route;

// NB: no access control

  ws.on('message', function(data, flags) {
    var message;

    if (!!flags.binary) {
      manage.loser(ws, tag, { event: 'data', diagnostic: 'binary data' });
      return;
    }

    message = null;
    try { message = JSON.parse(data); } catch(ex) {
      manage.loser(ws, tag, { event: 'data', diagnostic: ex.message });
    }
    if (!message) { return; }
    if (!message.path) {
      manage.loser(ws, tag, { event: 'data', diagnostic: 'no path' });
      return;
    }
    if (typeof message.requestID === 'number') message.requestID = message.requestID.toString();
    if (!message.requestID) {
      manage.loser(ws, tag, { event: 'data', diagnostic: 'no requestID' });
      return;
    }
    if (!message.requestID.length) {
      manage.loser(ws, tag, { event: 'data', diagnostic: 'empty requestID' });
      return;
    }

    manage.logger.info(tag, { message: message });
  });

  results = {};
  for (route in routes) {
    if (!routes.hasOwnProperty(route)) continue;

    results[route] = {};
    apis = routes[route].apis;
    if (!apis) continue;

    for (i = 0; i < apis.length; i++) {
      api = apis[i];
      results[route][api.prefix] = { access   : utility.value2key(routes[route].levels, api.access)
                                   , required : api.required
                                   , optional : api.optional
                                   , response : api.response
                                   , comments : api.comments
                                   };
    }
  }

  try { ws.send(JSON.stringify({ requestID: 0, result: results })); } catch(ex) { console.log(ex); }
};


exports.start = function() { routes['/'] = { route : route }; };
