var manage      = require('./../routes/route-manage')
  , places      = require('./../actors/actor-place')
  , steward     = require('./../core/steward')
  , users       = require('./api-manage-user')
  ;


var pair = function(logger, ws, api, message, tag) {
  var user;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing pairing', message.requestID, permanent, diagnostic);
  };

  if (!message.name)                                        return error(true,  'missing name element');
  if (!message.name.length)                                 return error(true,  'empty name element');

  if (!!message.pairingCode) {
    if ((!!places.place1.info.pairingCode) && (places.place1.info.pairingCode != message.pairingCode))
                                                            return error(false, 'invalid pairingCode element');
  } else if (!!places.place1.info.pairingCode)              return error(true,  'missing pairingCode element');

  user = users.name2user('.things');
  return users.create(logger,
                     { clientInfo : ws.clientInfo
                     , send       : function(data) { pair2(logger, ws, data, tag); }
                     },
                     { prefix     : '/api/v1/user/create'
                     },
                     { requestID  : message.requestID
                     , path       : '/api/v1/user/create/' +
                                   ((!!user) ? ('.things/' + message.name) : (steward.uuid + ':things'))
                     , name       : (!!user) ? message.name                : '.things'
                     , comments   : (!!user) ? message.comments            : 'simple thing protocol clients'
                     , role       : 'device'
                     , clientName : message.name
                     }, tag, true);
};

var pair2 = function(logger, ws, data, tag) {
  var message;

  try { message = JSON.parse(data); } catch(ex) {
    return manage.error(ws, tag, 'thing pairing', message.requestID, true, 'internal error');
  }

  if ((!!message) && (!!message.result) && (!message.error)) {
    message.result.success = true;
    message.result.thingID = message.result.client;
    delete(message.result.user);
    delete(message.result.client);
  }

  try { ws.send(JSON.stringify(message)); } catch(ex) { console.log(ex); }
};

var hello = function(logger, ws, api, message, tag) {
  var thingID;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing hello', message.requestID, permanent, diagnostic);
  };

  thingID = message.path.slice(api.prefix.length + 1);
  if (thingID.length === 0)                                 return error(true,  'missing thingID');

  return users.authenticate(logger,
                           { clientInfo : ws.clientInfo
                           , send       : function(data) { hello2(logger, ws, data, tag); }
                           },
                           { prefix     : '/api/v1/user/authenticate'
                           },
                           { requestID  : message.requestID
                           , path       : '/api/v1/user/authenticate/.things/' + thingID
                           , response   : message.response
                           }, tag);
};

var hello2 = function(logger, ws, data, tag) {
  var message;

  data = data.replace(/clientID/g, 'thingID');
  try { message = JSON.parse(data); } catch(ex) {
    return manage.error(ws, tag, 'thing hello', message.requestID, true, 'internal error');
  }

  if ((!!message) && (!!message.result) && (!message.error)) {
    message.result.success = true;
    delete(message.result.userID);
    delete(message.result.role);
  }

  try { ws.send(JSON.stringify(message)); } catch(ex) { console.log(ex); }
};

var prototype = function(logger, ws, api, message, tag) {
  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing definition', message.requestID, permanent, diagnostic);
  };

  return true;
};

var register = function(logger, ws, api, message, tag) {
  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing registration', message.requestID, permanent, diagnostic);
  };

  return true;
};

var update = function(logger, ws, api, message, tag) {
  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing updating', message.requestID, permanent, diagnostic);
  };

  return true;
};

var report = function(logger, ws, api, message, tag) {
  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing reporting', message.requestID, permanent, diagnostic);
  };

  return true;
};


exports.start = function() {
  manage.apis.push({ prefix  : '/api/v1/thing/pair'
                   , route   : pair
                   , access  : manage.access.level.read    // does its own checking...
                   , required : { uuid       : true
                                , name       : true
                                }
                   , optional : { display    : true
                                , comments   : true
                                }
                   , response : {}
                   , comments : [ 'the uuid is specified as the pair suffix'
                                ]
                   });
  manage.apis.push({ prefix  : '/api/v1/thing/hello'
                   , route   : hello
                   , access  : manage.access.level.read
                   , required : { thingID  : 'id'
                                , response : true
                                }
                   , response : {}
                   , comments : [ 'the thingID is specified as the path suffix, e.g., .../1'
                                ]
                   });
  manage.apis.push({ prefix  : '/api/v1/thing/prototype'
                   , route   : prototype
                   , access  : manage.access.level.attach
                   , required : { things   : true
                                }
                   , comments : []
                   });
  manage.apis.push({ prefix  : '/api/v1/thing/register'
                   , route   : register
                   , access  : manage.access.level.attach
                   , required : { things   : true
                                }
                   , comments : []
                   });
  manage.apis.push({ prefix  : '/api/v1/thing/update'
                   , route   : update
                   , access  : manage.access.level.attach
                   , required : { things   : true
                                }
                   , comments : []
                   });
  manage.apis.push({ prefix  : '/api/v1/thing/report'
                   , route   : report
                   , access  : manage.access.level.attach
                   , required : { events   : true
                                }
                   , comments : []
                   });
};
