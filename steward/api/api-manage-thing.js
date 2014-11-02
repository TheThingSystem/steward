var stringify   = require('json-stringify-safe')
  , util        = require('util')
  , database    = require('./../core/database')
  , devices     = require('./../core/device')
  , manage      = require('./../routes/route-manage')
  , places      = require('./../actors/actor-place')
  , steward     = require('./../core/steward')
  , users       = require('./api-manage-user')
  , utility     = require('./../core/utility')
  , broker      = utility.broker
  ;


var things = exports.things = {};

var eventIDs  = {};
var eventUIDs = {};
var taskIDs   = {};
var thingIDs  = {};
var thingUDNs = {};

var db;

var pair = function(logger, ws, api, message, tag) {
  var user;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing pairing', message.requestID, permanent, diagnostic);
  };

  if (!message.name)                                        return error(true,  'missing name element');
  if (!message.name.length)                                 return error(true,  'empty name element');

  if (places.place1.info.pairing === 'off')                 return error(false, 'unknown api: ' + message.path);
  if (!!message.pairingCode) {
    if ((!!places.place1.info.pairingCode) && (places.place1.info.pairingCode !== message.pairingCode))
                                                            return error(false, 'invalid pairingCode element');
  } else if (!!places.place1.info.pairingCode)              return error(true,  'missing pairingCode element');

  user = users.name2user('.things');
  return users.create(logger,
                     { clientInfo : ws.clientInfo
                     , send       : function(data) { pair2(logger, ws, data, tag); }
                     , ws2        : ws
                     },
                     { prefix     : '/api/v1/user/create'
                     },
                     { requestID  : message.requestID
                     , path       : '/api/v1/user/create/' +
                                   ((!!user) ? ('.things/' + message.name) : (steward.uuid + ':things'))
                     , name       : (!!user) ? message.name                : '.things'
                     , comments   : (!!user) ? message.comments            : 'simple thing protocol client'
                     , role       : 'device'
                     , clientName : message.name
                     }, tag, true);
};

var pair2 = function(logger, ws, data, tag) {
  var results;

  try { results = JSON.parse(data); } catch(ex) {
    return manage.error(ws, tag, 'thing pairing', results.requestID, true, 'internal error');
  }

  if ((!!results) && (!!results.result) && (!results.error)) {
    results.result.success = true;
    results.result.thingID = results.result.client;
    delete(results.result.user);
    delete(results.result.client);
  }
  if (!!results) results.timestamp = Math.round((new Date().getTime()) / 1000);

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
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
                           , ws2        : ws
                           },
                           { prefix     : '/api/v1/user/authenticate'
                           },
                           { requestID  : message.requestID
                           , path       : '/api/v1/user/authenticate/.things/' + thingID
                           , response   : message.response
                           }, tag);
};

var hello2 = function(logger, ws, data, tag) {
  var results;

  data = data.replace(/clientID/g, 'thingID');
  try { results = JSON.parse(data); } catch(ex) {
    return manage.error(ws, tag, 'thing hello', results.requestID, true, 'internal error');
  }

  if ((!!results) && (!!results.result) && (!results.error)) {
    results.result.success = true;
    delete(results.result.userID);
    delete(results.result.role);
  }
  if (!!results) results.timestamp = Math.round((new Date().getTime()) / 1000);

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
};

var prototype = exports.protodef = function(logger, ws, api, message, tag) {
  var path, props, results, thingPath;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing definition', message.requestID, permanent, diagnostic);
  };

  if (!readyP())                                            return error(false, 'database not ready');

  if (!message.things)                                      return error(true,  'missing things element');

  results = { requestID: message.requestID, things: {} };
  for (thingPath in message.things) {
    if (!message.things.hasOwnProperty(thingPath)) continue;

    path = thingPath.split('/');
    if ((path.length < 3) || (path[0] !== '') || (path[1] !== 'device')) {
      results.things[thingPath] = { error: { permanent: false, diagnostic: 'invalid thingPath' } };
      continue;
    }

    props = message.things[thingPath];
    if (!util.isArray(props.observe)) props.observe = [];
    if (!util.isArray(props.perform)) props.perform = [];
    if (!props.device)                                      return error(true,  'missing device in ' + thingPath);
    if (!props.device.name)                                 return error(true,  'missing device name in ' + thingPath);
    if (!props.name)                                        return error(true,  'missing name in ' + thingPath);
    props.name = true;
    if (!props.status)                                      return error(true,  'missing status in ' + thingPath);
    if (!props.properties) props.properties = {};
    if (!props.validate) props.validate = { observe: false, perform: false };
    props.validate.observe = !!props.validate.observe;
    props.validate.perform = !!props.validate.perform;

    results.things[thingPath] = { success: true };
    if (!addprototype(thingPath, props)) results.things[thingPath].diagnostic = 'previously defined';
    else insprototype(logger, thingPath, '', '', props, tag);
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var addprototype = function(thingPath, props) {
  var actors, i, info, path, prop, validate;

  path = thingPath.split('/');
  actors = steward.actors;
  for (i = 1; i < path.length - 1; i++) {
    if (!actors[path[i]]) actors[path[i]] = { $info : { type : path.slice(0, i + 1).join('/') } };
    actors = actors[path[i]];
  }

  info = utility.clone(props);
  info.name = props.name;
  info.status = props.status;
  for (prop in info.properties) if (info.properties.hasOwnProperty(prop)) info[prop] = info.properties[prop];
  validate = {};
  if (!!info.validate.observe) validate.observe = validate_observe;
  if (!!info.validate.perform) validate.perform = validate_perform;
  delete(info.type);
  delete(info.device);
  delete(info.observe);
  delete(info.perform);
  delete(info.properties);
  delete(info.validate);

  if (!!actors[path[i]]) return false;

  actors[path[i]] = { $info     : { type       : thingPath
                                  , observe    : props.observe
                                  , perform    : props.perform
                                  , properties : info
                                  }
                    , $validate : validate
                    };
  devices.makers[thingPath] = Thing;
  return true;
};

var insprototype = function(logger, thingPath, name, comments, props, tag) {
  db.run('INSERT INTO things(thingUID, thingName, thingComments, thingDefinition, created) '
         + ' VALUES($thingUID, $thingName, $thingComments, $thingDefinition, datetime("now"))',
         { $thingUID: thingPath, $thingName: name, $thingComments: comments, $thingDefinition: JSON.stringify(props) },
         function(err) {
    if (err) logger.error(tag, { user: 'INSERT things.thingUID for ' + thingPath, diagnostic: err.message });

    things[thingPath] = { thingID         : this.lastID
                        , thingUID        : thingPath
                        , thingName       : name
                        , thingComments   : comments
                        , thingDefinition : props
                        };
  });
};


var register = exports.register = function(logger, ws, api, message, tag) {
  var changedP, device, info, props, id, results, thingID, udn, updated;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing registration', message.requestID, permanent, diagnostic);
  };

  if (!message.things)                                      return error(true,  'missing things element');

  results = { requestID: message.requestID, things: {} };
  for (thingID in message.things) {
    if (!message.things.hasOwnProperty(thingID)) continue;

    props = message.things[thingID];
    if (!props.devicetype)                                  return error(true,  'missing devicetype property in ' + thingID);
    if (!devices.makers[props.devicetype])                  return error(true,  'unknown devicetype in ' + thingID);
    if (!props.name)                                        return error(true,  'missing name in ' + thingID);
    if (!props.status)                                      return error(true,  'missing status in ' + thingID);
    if (!props.device)                                      return error(true,  'missing device in ' + thingID);
    if (!props.device.name)                                 return error(true,  'missing device name in ' + thingID);
    if (!props.device.model) props.device.model = {};
    if (!props.device.unit)                                 return error(true,  'missing device unit property in ' + thingID);
    if (!props.device.unit.udn)                             return error(true,  'missing device unit UDN in ' + thingID);
    if (!props.updated) props.updated = new Date().getTime();

    udn = props.device.unit.udn;
    for (id = ('00000000' + Math.round(Math.random() * 99999999)).substr(-8);
         !!thingIDs[id];
         id = ('00000000' + Math.round(Math.random() * 99999999)).substr(-8)) continue;
    thingIDs[id] = { udn: udn, clientID: ws.clientInfo.clientID, remoteAddress: ws.clientInfo.remoteAddress };
    thingUDNs[udn] = id;

// NB: should make sure that all of info is defined in props...
    info = (!!props.info) ? utility.clone(props.info) : {};
    info.source = ws.clientInfo;
    info.params = { ws: ws, thingID: id, name: props.name, status: props.status };
    info.device = { url                          : null
                  , name                         : props.device.name
                  , manufacturer                 : props.device.maker
                  , model        : { name        : props.device.model.name
                                   , description : props.device.model.descr
                                   , number      : props.device.model.number
                                   }
                  , unit         : { serial      : props.device.unit.serial
                                   , udn         : udn
                                   }
                  };
    info.deviceType = props.devicetype;
    info.id = info.device.unit.udn;

    if (!!devices.devices[info.id]) {
      device = devices.devices[info.id].device;
      if ((!device) || (!!device.ws)) {
        results.things[thingID] = { error: { permanent: false, diagnostic: 'UDN is already registered' } };
        continue;
      }

      device.ws = info.params.ws;
      device.clientSerialNo = device.ws.clientInfo.clientSerialNo;
      device.thingID = info.params.thingID;

      changedP = false;
      if ((!!props.name) && (props.name !== device.name)) {
        changedP = true;
        device.name = props.name.toString();
      }
      if ((!!props.status) && (props.status !== device.status)) {
        changedP = true;
        device.status = props.status.toString();
      }
      if (!!props.updated) {
        try {
          updated = new Date(props.updated).getTime();
          if (!isNaN(updated)) device.updated = updated;
        } catch(ex) { }
      }
      device.ping(device);
      if (!!props.uptime) device.bootime = device.updated - props.uptime;
      device.addinfo(props.info, changedP);

      results.things[thingID] = { success: true, thingID: id };
      continue;
    }
    results.things[thingID] = { success: true, thingID: id };

    logger.info(info.device.name, { id: info.device.unit.serial, params: thingIDs[id] });
    devices.discover(info);
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var update = function(logger, ws, api, message, tag) {
  var changedP, child, device, props, results, thingID, updated;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing updating', message.requestID, permanent, diagnostic);
  };

  if (!message.things)                                      return error(true,  'missing things element');

  results = { requestID: message.requestID, things: {} };
  for (thingID in message.things) {
    if (!message.things.hasOwnProperty(thingID)) continue;

    if (!thingIDs[thingID]) {
      results.things[thingID] = { error : { permanent: false, diagnostic: 'invalid thingID' } };
      continue;
    }

    child = devices.devices[thingIDs[thingID].udn];
    if (!child)                                             return error(true, 'internal error');
    device = child.device;
    if ((!device) || (device.clientSerialNo !== ws.clientInfo.clientSerialNo)) {
      results.things[thingID] = { error : { permanent: false, diagnostic: 'invalid clientID' } };
      continue;
    }
    if (!device.thingID) {
      results.things[thingID] = { error : { permanent: false, diagnostic: 'invalid thing' } };
      continue;
    }

    props = message.things[thingID];
    changedP = false;
    if ((!!props.name) && (props.name !== device.name)) {
      changedP = true;
      device.name = props.name.toString();
    }
    if ((!!props.status) && (props.status !== device.status)) {
      changedP = true;
      device.status = props.status.toString();
    }
    if (!!props.updated) {
      try {
        updated = new Date(props.updated).getTime();
        if (!isNaN(updated)) device.updated = updated;
      } catch(ex) { }
    }
    device.ping(device);
    if (!!props.uptime) device.bootime = device.updated - props.uptime;
    device.addinfo(props.info, changedP);

    results.things[thingID] = { success: true };
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var report = function(logger, ws, api, message, tag) {
  var event, eventID, results;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'thing reporting', message.requestID, permanent, diagnostic);
  };

  if ((!!message.tasks) && (!message.events))               return true;

  if (!message.events)                                      return error(true,  'missing event element');

  results = { requestID: message.requestID, events: {} };

  for (eventID in message.events) {
    if (!message.events.hasOwnProperty(eventID)) continue;

    if (!eventIDs[eventID]) {
      results.events[eventID] = { error : { permanent: false, diagnostic: 'invalid eventID' } };
      continue;
    }
// NB: should check clientID here too...

    event = message.events[eventID];
    if (!!event.status) {
      if (event.status === 'proceed') return true
      if (event.status === 'success') return steward.report(eventIDs[eventID].eventID, {});
                                                          return error(true,  'invalid status for ' + eventID);
    }
    if (!!event.error) {
      steward.report(eventIDs[eventID].eventID, { error: true, message: event.error.diagnostic || 'unspecified' });
      delete(eventIDs[eventID]);
    }

    if (!event.reason)                                    return error(true,  'missing reason in ' + eventID);

    switch (event.reason) {
      case 'observe':
        steward.report(eventIDs[eventID].eventID, {});
        results.events[eventID] = { success: true };
        break;

      case 'failure':
        steward.report(eventIDs[eventID].eventID, { error: true, message: event.diagnostic || 'unspecified' });
        delete(eventIDs[eventID]);
        results.events[eventID] = { success: true };
        break;

      default:
        results.events[eventID] = { error : { permanent: true, diagnostic: 'invalid reason' } };
        break;
    }
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  return true;
};


var loadedP = false;

var readyP = function() {
  if (loadedP) return true;

  if (!database.db) {
    setTimeout(readyP, 1000);
    return false;
  }
  db = database.db;

  var logger = devices.logger;

  db.all('SELECT * FROM things ORDER BY sortOrder', function(err, rows) {
    if (err) {
      logger.error('devices', { event: 'SELECT things.*', diagnostic: err.message });
      loadedP = false;
      return;
    }
    rows.forEach(function(thing) {
      var thingPath = thing.thingUID;

      things[thingPath] = { thingID         : thing.thingID.toString()
                          , thingUID        : thingPath
                          , thingName       : thing.thingName
                          , thingComments   : thing.thingComments
                          , thingDefinition : JSON.parse(thing.thingDefinition)
                          };

      thing.thingDefinition.status = 'absent';
      addprototype(thingPath, things[thingPath].thingDefinition);
    });

    loadedP = true;
  });

  return false;
};


exports.start = function() {
  readyP();

  manage.apis.push({ prefix   : '/api/v1/thing/pair'
                   , route    : pair
                   , access   : manage.access.level.none    // does its own checking...
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
  manage.apis.push({ prefix   : '/api/v1/thing/hello'
                   , route    : hello
                   , access   : manage.access.level.none    // does its own checking...
                   , required : { thingID  : 'id'
                                , response : true
                                }
                   , response : {}
                   , comments : [ 'the thingID is specified as the path suffix, e.g., .../1'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/thing/prototype'
                   , route    : prototype
                   , access   : manage.access.level.attach
                   , required : { things   : true
                                }
                   , comments : []
                   });
  manage.apis.push({ prefix   : '/api/v1/thing/register'
                   , route    : register
                   , access   : manage.access.level.attach
                   , required : { things   : true
                                }
                   , comments : []
                   });
  manage.apis.push({ prefix   : '/api/v1/thing/update'
                   , route    : update
                   , access   : manage.access.level.attach
                   , required : { things   : true
                                }
                   , comments : []
                   });
  manage.apis.push({ prefix   : '/api/v1/thing/report'
                   , route    : report
                   , access   : manage.access.level.attach
                   , required : { events   : true
                                }
                   , comments : []
                   });
};


var Thing = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.params.name;
  self.ws = info.params.ws;
  self.clientSerialNo = self.ws.clientInfo.clientSerialNo;
  self.thingID = info.params.thingID;
  self.status = info.params.status;
  delete(info.params);
  self.logger = devices.logger;

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);
  delete(self.info.source);
  delete(self.info.status);

  self.changed();

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (!self.ws) return;

    if (request === 'logout') {
      if (eventID !== self.clientSerialNo) return;

      delete(self.ws);
      delete(self.clientSerialNo);
      delete (self.thingID);
      if (!!self.timer) { clearTimeout(self.timer); delete(self.timer); }
      self.status = 'absent';
      return self.changed();
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') return self.observe(self, eventID, observe, parameter);
    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });

  self.ping(self);
};
util.inherits(Thing, devices.Device);


Thing.prototype.ping = function(self) {
  if (!!self.timer) clearTimeout(self.timer);
  self.timer = setTimeout (function () { self.status = 'absent'; self.changed(); }, 60 * 1000);
};


var requestID = 0;

Thing.prototype.observe = function(self, eventID, observe, parameter) {
  var id, message;

  if (!!eventUIDs[eventID]) id = eventUIDs[eventID];
  else {
    for (id = ('00000000' + Math.round(Math.random() * 99999999)).substr(-8);
         !!eventIDs[id];
         id = ('00000000' + Math.round(Math.random() * 99999999)).substr(-8)) continue;
    eventIDs[id] = { eventID: eventID, clientID: self.ws.clientInfo.clientID, remoteAddress: self.ws.clientInfo.remoteAddress };
    eventUIDs[eventID] = id;
  }

  requestID++;
  message = { path: '/api/v1/thing/observe', requestID: requestID.toString(), events: {} };
  message.events[id] = { thingID   : self.thingID
                       , observe   : observe
                       , parameter : typeof parameter !== 'string' ? stringify(parameter) : parameter
                       , testOnly  : false };

  try { self.ws.send(JSON.stringify(message)); } catch(ex) { console.log(ex); }
};

Thing.prototype.perform = function(self, taskID, perform, parameter) {
  var id, message;

// the 'set' task is reserved to the steward
  if (perform === 'set') return devices.perform(self, taskID, perform, parameter);

  for (id = ('00000000' + Math.round(Math.random() * 99999999)).substr(-8);
       !!taskIDs[id];
       id = ('00000000' + Math.round(Math.random() * 99999999)).substr(-8)) continue;
  taskIDs[id] = { taskID: taskID, clientID: self.ws.clientInfo.clientID, remoteAddress: self.ws.clientInfo.remoteAddress };

  requestID++;
  message = { path: '/api/v1/thing/perform', requestID: requestID.toString(), tasks: {} };
  message.tasks[id] = { thingID   : self.thingID
                      , perform   : perform
                      , parameter : typeof parameter !== 'string' ? stringify(parameter) : parameter
                      , testOnly  : false };

  try { self.ws.send(JSON.stringify(message)); } catch(ex) { console.log(ex); }

  return true;
};

// TBD: later, not sure how to deal with async/sync interaction

var validate_observe = function(info) {/* jshint unused: false */
  return { invalid: [], requires: [] };
};

var validate_perform = function(info) {/* jshint unused: false */
  return { invalid: [], requires: [] };
};
