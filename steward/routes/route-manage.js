var server      = require('./../core/server')
  , users       = require('./../api/api-manage-user')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('manage');
var places = null;

var apis = exports.apis = [];
var access = exports.access = { level : { read    :    1
                                        , perform :    2
                                        , write   :    4
                                        , create  :    8
                                        , attach  :   16
                                        , peer    :   32
                                        , none    : 1024
                                        }
                              };


var route = function(ws, tag) {
  ws.on('message', function(data, flags) {
    var best, i, message, option, path, prefix;

    if (!!flags.binary) {
      loser(ws, tag, { event: 'data', diagnostic: 'binary data' });
      return;
    }

    message = null;
    try { message = JSON.parse(data); } catch(ex) {
      loser(ws, tag, { event: 'data', diagnostic: ex.message });
    }
    if (!message) { return; }
    if (!message.path) {
      loser(ws, tag, { event: 'data', diagnostic: 'no path' });
      return;
    }
    if (typeof message.requestID === 'number') message.requestID = message.requestID.toString();
    if (!message.requestID) {
      loser(ws, tag, { event: 'data', diagnostic: 'no requestID' });
      return;
    }
    if (!message.requestID.length) {
      loser(ws, tag, { event: 'data', diagnostic: 'empty requestID' });
      return;
    }

    best = null;
    path = message.path;
    for (i = 0; i < apis.length; i++) {
       prefix = apis[i].prefix;
       if (path.indexOf(prefix) !== 0) continue;
       if ((path.length > prefix) && (path.charAt(prefix.length -1) !== '/')) continue;
       if ((!best) || (best.prefix.length < prefix.length)) best = apis[i];
    }
    if (!best) {
      error(ws, tag, 'route', message.requestID, false, 'unknown api: ' + path);
      return;
    }

    if (!!best.options) {
      if (!message.options) message.options = {};
      for (option in best.options) {
        if ((best.options.hasOwnProperty(option)) && (!message.options[option])) message.options[option] = best.options[option];
      }
    }

    if (!accessP(best, ws.clientInfo, tag)) {
      error(ws, tag, 'route', message.requestID, false, 'unknown api: ' + path);
      return;
    }

    logger.info(tag, { message: message });
    if (!(best.route)(logger, ws, best, message, tag)) try { ws.close(); } catch(ex) {}
  });
};


var accessP = function(api, clientInfo, tag) {
  var levels, role, user;

  if (clientInfo.loopback) return true;

  user = users.id2user(clientInfo.userID);
  role = (!!user) ? user.userRole : 'none';
  levels = { master   : access.level.read   | access.level.perform | access.level.write | access.level.manage
           , resident : access.level.read   | access.level.perform | access.level.write
           , guest    : access.level.read   | access.level.perform
           , device   : access.level.attach
           , cloud    : access.level.peer
           , none     : clientInfo.local ? access.level.read : access.level.none
           }[role];
  if (!levels) {
      logger.warning(tag, { event: 'access', diagnostic: 'unknown authorization role', role: role });
      return false;
  }
console.log('>>> clientInfo='+JSON.stringify(clientInfo)
+' user='+JSON.stringify(user || {})
+' levels='+JSON.stringify(levels)
+' api.access='+JSON.stringify(api.access)
+' role='+JSON.stringify(role));

  if (!places) places = require('./../actors/actor-place');
  if ((places.place1.info.strict !== 'off') && (!(levels & api.access))) {
    logger.warning(tag, { event      : 'access'
                        , diagnostic : 'unauthorized'
                        , role       : role
                        , resource   : 'manage'
                        , level      : utility.value2key(access.levels, api.access)
                        });
    return false;
  }

  return true;
};

var error = exports.error = function(ws, tag, event, requestID, permanent, diagnostic) {
  var meta = { error: { permanent: permanent, diagnostic: diagnostic }};

  if (requestID) meta.requestID = requestID;
  ws.send(JSON.stringify(meta), function(err) {
    if (err) try { ws.terminate(); } catch(ex) {}

    meta.event = event;
    logger.warning(tag, meta);
  });

  return !permanent;
};


var loser = exports.loser = function(ws, tag, meta) {
  meta.permanent = true;
  logger.error(tag, meta);

  try { ws.close(); } catch(ex) {}
};


exports.start = function() {
  server.routes['/manage'] = { route: route, apis: apis, levels: access.level };

  utility.acquire(logger, __dirname + '/../api', /^api-manage-.*\.js/, 11, -3, ' api');
};
