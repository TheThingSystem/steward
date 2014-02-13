var stringify  = require('json-stringify-safe')
  , actors     = require('./../core/steward').actors
  , clone      = require('./../core/utility').clone
  , database   = require('./../core/database')
  , devices    = require('./../core/device')
  , groups     = require('./api-manage-group')
  , manage     = require('./../routes/route-manage')
  , tasks      = require('./api-manage-task')
  ;


var events = exports.events = {};

var db;


var create = function(logger, ws, api, message, tag) {
  var actor, actorID, actorType, entity, p, parts, results, uuid, v;

  var error = function(permanent, diagnostic, viz) {
    return manage.error(ws, tag, 'event creation', message.requestID, permanent, diagnostic, viz);
  };

  if (!readyP())                  return error(false, 'database not ready');

  uuid = message.path.slice(api.prefix.length + 1);
  if (uuid.length === 0)          return error(true,  'missing uuid');

  if (!message.name)              return error(true,  'missing name element');
  if (!message.name.length)       return error(true,  'empty name element');

  if (!message.comments) message.comments = '';

  if (!message.actor)             return error(true,  'missing actor element');
  entity = message.actor.split('/');
  if (entity.length !== 2)        return error(true,  'invalid actor element');
  actorType = entity[0];
  actorID = entity[1].toString();
  actor = actors[actorType];
  if (!actor)                     return error(true,  'invalid actor ' + message.actor);
  entity = actor.$lookup(actorID);
  if (!entity)                    return error(false, 'unknown entity ' + message.actor);

  if (!message.observe)           return error(true,  'missing observe element');
  if (!message.observe.length)    return error(true,  'empty observe element');

  if (!message.parameter) message.parameter = '{}';

  if (actorType !== 'group') {
    parts = entity.whatami.split('/');
    actor = actors;
    try { for (p = 1; p < parts.length; p++) actor = actor[parts[p]]; } catch(ex) { actor = null; }
    if (!actor)                     return error(false,  'internal error');
    if ((!!actor.$validate) && (!!actor.$validate.observe)) {
      v = actor.$validate.observe(message.observe, message.parameter);
      if ((v.invalid.length > 0) || (v.requires.length > 0))  return error(false, 'invalid parameters ' + stringify(v));
    }
  }

  if (!!events[uuid])             return error(false, 'duplicate uuid', 'event/' + events[uuid].eventID);
  events[uuid] = {};

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  db.run('INSERT INTO events(eventUID, eventName, eventComments, actorType, actorID, observe, parameter, created) '
         + 'VALUES($eventUID, $eventName, $eventComments, $actorType, $actorID, $observe, $parameter, datetime("now"))',
         { $eventUID: uuid, $eventName: message.name, $eventComments: message.comments, $actorType: actorType,
           $actorID: actorID, $observe: message.observe, $parameter: message.parameter }, function(err) {
    var eventID;

    if (err) {
      delete(events[uuid]);
      logger.error(tag, { event: 'INSERT events.eventUID for ' + uuid, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    eventID = this.lastID.toString();

    results.result = { event: eventID };
    events[uuid] = { eventID       : eventID
                   , eventUID      : uuid
                   , eventName     : message.name
                   , eventComments : message.comments
                   , actor         : message.actor
                   , actorType     : actor[0]
                   , actorID       : actor[1]
                   , observe       : message.observe
                   , parameter     : message.parameter
                   , watchP        : false
                   , conditionP    : (message.observe === '.condition')
                   , observeP      : false
                   , lastTime      : null
                   };

    try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  });

  return true;
};

var list = function(logger, ws, api, message, tag) {
  var actor, againP, allP, entity, event, group, i, id, member, p, parts, props, results, suffix, treeP, type, uuid, who;

  if (!readyP()) return manage.error(ws, tag, 'event listing', message.requestID, false, 'database not ready');

  allP = message.options.depth === 'all';
  treeP = allP || (message.options.depth === 'tree');
  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0) suffix = null;

  results = { requestID: message.requestID, result: { events: {} } };
  if (allP) results.result.actors = {};
  for (uuid in events) {
    if (!events.hasOwnProperty(uuid)) continue;

    event = events[uuid];
    id = event.eventID;
    if ((!suffix) || (suffix === id)) {
      results.result.events['event/' + id] = proplist(null, event);

      if (treeP) {
        actor = actors[event.actorType];
        entity = actor.$lookup(event.actorID);
        if (!!entity) {
          props = (!!entity.proplist) ? entity.proplist() : actor.$proplist(event.actorID, entity);
          who = props.whoami; delete(props.whoami);
          type = props.whatami.split('/')[1];
          if (!results.result[type + 's']) results.result[type + 's'] = {};
          results.result[type + 's'][who] = props;

          if (allP) {
            parts = props.whatami.split('/');
            actor = actors;
            for (p = 1; p < parts.length; p++) actor = actor[parts[p]];
            if (!!actor) {
              props = clone(actor.$info);
              type = props.type; delete(props.type);
              results.result.actors[type] = props;
            }
          }
        }
      }
    }
  }


  againP = treeP && (!!results.result.groups);
  while (againP) {
    againP = false;

    for (id in results.result.groups) {
      if (!results.result.groups.hasOwnProperty(id)) continue;

      group = groups.id2group(id.split('/')[1]);
      if (!group) continue;

      for (i = 0; i < group.members.length; i++) {
        member = group.members[i];
        if (!results.result[member.actorType + 's']) results.result[member.actorType + 's'] = {};
        else if (!!results.result[member.actorType + 's'][member.actor]) continue;
        if (member.actorType == 'group') againP = true;

        props = null;
        switch (member.actorType) {
          case 'event':
            entity = id2event(member.actorID);
            if (!!entity) props = proplist(null, entity);
            break;

          case 'task':
            entity = tasks.id2task(member.actorID);
            if (!!entity) props = tasks.proplist(null, entity);
            break;

          default:
            actor = actors[member.actorType];
            entity = actor.$lookup(member.actorID);
            if (!!entity) props = entity.proplist();
            break;
        }
        if (props) {
          delete(props.whoami);
          results.result[member.actorType + 's'][member.actor] = props;

          if (allP) {
            parts = props.whatami.split('/');
            actor = actors;
            for (p = 1; p < parts.length; p++) actor = actor[parts[p]];
            if (!!actor) {
              props = clone(actor.$info);
              type = props.type; delete(props.type);
              results.result.actors[type] = props;
            }
          }

        }
      }
    }
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var remove = function(logger, ws, api, message, tag) {
  var event, eventID, results;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'event deletion', message.requestID, permanent, diagnostic);
  };

  if (!readyP())            return error(false, 'database not ready');

  eventID = message.path.slice(api.prefix.length + 1);
  if (eventID.length === 0) return error(true,  'missing event id');
  event = id2event(eventID);
  if (!event)               return error(true,  'invalid event/' + eventID);
  delete(events[event.eventUID]);

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  db.run('DELETE FROM events WHERE eventID=$eventID', { $eventID: eventID }, function(err) {
    if (err) {
      logger.error(tag, { event: 'DELETE event.eventID for ' + eventID, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      events[event.eventUID] = event;
    } else {
      results.result = { event: eventID };
    }

    try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  });

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

  db.all('SELECT * FROM events ORDER BY sortOrder', function(err, rows) {
    if (err) {
      logger.error('events', { event: 'SELECT events.*', diagnostic: err.message });
      loadedP = false;
      return;
    }
    rows.forEach(function(event) {
      var eventUUID = event.eventUID;
      var parameter = event.parameter;

      if (parameter.indexOf('{') === 0) {
        try { JSON.parse(parameter); } catch(ex) {
          logger.error('event/' + event.eventID, { event: 'JSON.parse', data: parameter, diagnostic: ex.message });
        }
      }

      events[eventUUID] = { eventID       : event.eventID.toString()
                          , eventUID      : eventUUID
                          , eventName     : event.eventName
                          , eventComments : event.eventComments
                          , actor         : event.actorType + '/' + event.actorID.toString()
                          , actorType     : event.actorType
                          , actorID       : event.actorID.toString()
                          , observe       : event.observe
                          , parameter     : event.parameter
                          , watchP        : false
                          , conditionP    : (event.observe === '.condition')
                          , observeP      : false
                          , lastTime      : null
                          };
    });

    loadedP = true;
  });

  return false;
};


var id2event = exports.id2event = function(id) {
  var uuid;

  if (!id) return null;

  for (uuid in events) if ((events.hasOwnProperty(uuid)) && (id === events[uuid].eventID)) return events[uuid];

  return null;
};

exports.idlist = function() {
  var results, uuid;

  results = [];
  for (uuid in events) if (events.hasOwnProperty(uuid)) results.push(events[uuid].eventID);
  return results;
};


var proplist = exports.proplist = function(id, event) {
  var result = { uuid      : event.eventUID
               , name      : event.eventName
               , comments  : event.eventComments
               , actor     : event.actor
               , observe   : event.observe
               , parameter : event.parameter
               , lastTime  : event.lastTime && new Date(event.lastTime)
               };

  if (!!id) {
    result.whatami =  '/event';
    result.whoami = 'event/' + id;
  }

  return result;
};


exports.start = function() {
  readyP();

  manage.apis.push({ prefix   : '/api/v1/event/create'
                   , route    : create
                   , access   : manage.access.level.write
                   , required : { uuid       : true
                                , name       : true
                                , actor      : 'actor'
                                , observe    : true
                                }
                   , optional : { comments   : true
                                , parameter  : true
                                }
                   , response : {}
                   , comments : [ 'the uuid is specified as the create suffix'
                                , 'the task actor must resolve to a device or a group of devices'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/event/list'
                   , options  : { depth: 'flat' }
                   , route    : list
                   , access   : manage.access.level.read
                   , optional : { event      : 'id'
                                , depth      : [ 'flat', 'tree', 'all' ]
                                }
                   , response : {}
                   , comments : [ 'if present, the event is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/event/delete'
                   , route    : remove
                   , access   : manage.access.level.write
                   });
};

