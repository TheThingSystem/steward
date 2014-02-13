var actors     = require('./../core/steward').actors
  , clone      = require('./../core/utility').clone
  , database   = require('./../core/database')
  , devices    = require('./../core/device')
  , utility    = require('./../core/utility')
  , events     = require('./api-manage-event')
  , groups     = require('./api-manage-group')
  , manage     = require('./../routes/route-manage')
  , tasks      = require('./api-manage-task')
  ;


var activities = exports.activities = {};

var db;


var create = function(logger, ws, api, message, tag) {
  var event, group, results, task, uuid;

  var error = function(permanent, diagnostic, viz) {
    return manage.error(ws, tag, 'activity creation', message.requestID, permanent, diagnostic, viz);
  };

  if (!readyP())                       return error(false, 'database not ready');

  uuid = message.path.slice(api.prefix.length + 1);
  if (uuid.length === 0)               return error(true,  'missing uuid');

  if (!message.name)                   return error(true,  'missing name element');
  if (!message.name.length)            return error(true,  'empty name element');

  if (!message.comments) message.comments = '';

  if (!message.armed) message.armed = false;

  if (!message.event)                  return error(true,  'missing event element');
  event = message.event.split('/');
  if (event.length !== 2)              return error(true,  'invalid event element');
  event[1] = event[1].toString();
  switch (event[0]) {
    case 'group':
      group = groups.id2group(event[1]);
      if (!group)                      return error(false, 'unknown event ' + message.event);
      if (group.groupType !== 'event') return error(false, 'not an event ' + message.event);
      break;

    case 'event':
      if (!events.id2event(event[1]))  return error(false, 'unknown event ' + message.event);
      break;

    default:
                                       return error(true, 'invalid event ' + message.event);
  }

  if (!message.task)                   return error(true,  'missing task element');
  task = message.task.split('/');
  if (task.length !== 2)               return error(true,  'invalid task element');
  task[1] = task[1].toString();
  switch (task[0]) {
    case 'group':
      group = groups.id2group(task[1]);
      if (!group)                      return error(false, 'unknown task ' + message.task);
      if (group.groupType !== 'task')  return error(false, 'not a task ' + message.task);
      break;

    case 'task':
      if (!tasks.id2task(task[1]))     return error(false, 'unknown task ' + message.task);
      break;

    default:
                                       return error(true, 'invalid task ' + message.task);
  }

  if (!!activities[uuid])              return error(false, 'duplicate uuid', 'activity/' + activities[uuid].activityID);
  activities[uuid] = {};

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  db.run('INSERT INTO activities(activityUID, activityName, activityComments, armed, eventType, eventID, taskType, '
         + 'taskID, created) '
         + 'VALUES($activityUID, $activityName, $activityComments, $armed, $eventType, $eventID, $taskType, '
         + '$taskID, datetime("now"))',
         { $activityUID: uuid, $activityName: message.name, $activityComments: message.comments,
           $armed: !!message.armed, $eventType: event[0], $eventID: event[1], $taskType: task[0], $taskID: task[1] },
         function(err) {
    var activityID;

    if (err) {
      delete(activities[uuid]);
      logger.error(tag, { event: 'INSERT activities.activityUID for ' + uuid, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    activityID = this.lastID.toString();

    results.result = { activity: activityID };
    activities[uuid] = { activityID       : activityID
                       , activityUID      : uuid
                       , activityName     : message.name
                       , activityComments : message.comments
                       , armed            : !!message.armed
                       , event            : message.event
                       , eventType        : event[0]
                       , eventID          : event[1]
                       , task             : message.task
                       , taskType         : task[0]
                       , taskID           : task[1]
                       , lastTime         : null
                       };

    try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  });

  return true;
};

var list = function(logger, ws, api, message, tag) {
  var activity, actor, actorID, actorIDs, actorType, againP, allP, entity, entities, event, group, i, id, member, p, parts,
      props, results, suffix, task, treeP, type, uuid;

  if (!readyP()) return manage.error(ws, tag, 'activity listing', message.requestID, false, 'database not ready');

  allP = message.options.depth === 'all';
  treeP = allP || (message.options.depth === 'tree');
  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0) suffix = null;

  results = { requestID: message.requestID, result: { activities: {} } };
  if (treeP) { entities = {}; results.result.events = {}; results.result.tasks = {}; }
  if (allP) results.result.actors = {};
  for (uuid in activities) {
    if (!activities.hasOwnProperty(uuid)) continue;

    activity = activities[uuid];
    id = activity.activityID;
    if ((!suffix) || (suffix === id)) {
      results.result.activities['activity/' + id] = proplist(null, activity);

      if (treeP) {
        if (activity.eventType === 'group') {
          if (!results.result.groups) results.result.groups = {};
          group = groups.id2group(activity.eventID);
          if (!!group) results.result.groups[activity.event] = groups.proplist(null, group);
        } else {
          event = events.id2event(activity.eventID);
          if (!!event) results.result.events[activity.event] = events.proplist(null, event);
        }

        if (activity.taskType === 'group') {
          if (!results.result.groups) results.result.groups = {};
          group = groups.id2group(activity.taskID);
          if (!!group) results.result.groups[activity.task] = groups.proplist(null, group);
        } else {
          task = tasks.id2task(activity.taskID);
          if (!!task) results.result.tasks[activity.task] = tasks.proplist(null, task);
        }

        if (treeP) {
          entities[activity.event] = {};
          entities[activity.task] = {};
        }
      }
    }
  }

  if ((allP) && (!suffix)) {
    actorIDs = groups.idlist();
    if (!results.result.groups) results.result.groups = {};
    for (i = 0; i < actorIDs.length; i++) {
      if (!!results.result.groups['group/' + actorIDs[i]]) continue;
      results.result.groups['group/' + actorIDs[i]] = groups.proplist(null, groups.id2group(actorIDs[i]));
    }

    actorIDs = events.idlist();
    if (!results.result.groups) results.result.events = {};
    for (i = 0; i < actorIDs.length; i++) {
      if (!!results.result.events['event/' + actorIDs[i]]) continue;
      results.result.events['event/' + actorIDs[i]] = events.proplist(null, events.id2event(actorIDs[i]));
    }

    actorIDs = tasks.idlist();
    if (!results.result.groups) results.result.tasks = {};
    for (i = 0; i < actorIDs.length; i++) {
      if (!!results.result.tasks['task/' + actorIDs[i]]) continue;
      results.result.tasks['task/' + actorIDs[i]] = tasks.proplist(null, tasks.id2task(actorIDs[i]));
    }
  }

  againP = treeP;
  while (againP) {
    againP = false;
    for (entity in entities) {
      if (!entities.hasOwnProperty(entity)) continue;

      member = entity.split('/');
      actorType = member[0];
      actorID = member[1];

      switch (actorType) {
        case 'event':
          event = events.id2event(actorID);
          if (!event) break;
          if (!results.result.events[entity]) results.result.events[entity] = events.proplist(null, event);
          if (!entities[event.actor]) {
            againP = true;
            entities[event.actor] = {};
          }
          break;

        case 'task':
          task = tasks.id2task(actorID);
          if (!task) break;
          if (!results.result.tasks[entity]) results.result.tasks[entity] = tasks.proplist(null, task);
          if (!entities[task.actor]) {
            againP = true;
            entities[task.actor] = {};
          }
          if ((!!task.guard) && (!entities[task.guard])) {
            againP = true;
            entities[task.guard] = {};
          }
          break;

        case 'group':
          group = groups.id2group(actorID);
          if (!group) break;
          if (!results.result.groups) results.result.groups = {};
          if (!results.result.groups[entity]) results.result.groups[entity] = groups.proplist(null, group);
          for (i = 0; i < group.members.length; i++) {
            member = group.members[i].actor;
            if (!entities[member]) {
              againP = true;
              entities[member] = {};
            }
          }
          break;

        default:
          if (!actors[actorType].$lookup) {
            logger.warning(tag, { event: 'internal', diagonstic: 'actors[' + actorType + '].$lookup is nulll' });
          }
          if (!(actor = actors[actorType].$lookup(actorID))) continue;
          props = (!!actor.proplist) ? actor.proplist(null, actor) : actors[actorType].$proplist(actorID, actor);
          if (!results.result[actorType + 's']) results.result[actorType + 's'] = {};
          results.result[actorType + 's'][props.whoami] = props;
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
          break;
      }
    }
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var modify = function(logger, ws, api, message, tag) {
  var activity, activity2, activityID, columns, event, group, i, results, s, s1, s3, task;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'activity modification', message.requestID, permanent, diagnostic);
  };

  activityID = message.path.slice(api.prefix.length + 1);
  if (activityID.length === 0)                              return error(true,  'missing activityID');
  activity = id2activity(activityID);
  if (!activity)                                            return error(false, 'unknown activity ' + activityID);
  activity2 = utility.clone(activity);

  columns = [];

  if ((!!message.name) && (message.name.length) && (message.name !== activity.activityName)) {
    activity2.activityName = message.name;
    columns.push('activityName');
  }

  if ((!!message.comments) && (message.comments !== activity.activityComments)) {
    activity2.activityComments = message.comments;
    columns.push('activityComments');
  }

  if ((typeof message.armed !== "undefined") && (message.armed !== activity.armed)) {
    activity2.armed = message.armed;
    columns.push('armed');
  }

  if ((!!message.event) && (message.event !== (activity.eventType + '/' + activity.eventID))) {
    event = message.event.split('/');
    if (event.length !== 2)            return error(true,  'invalid event element');
    event[1] = event[1].toString();
    switch (event[0]) {
      case 'group':
        group = groups.id2group(event[1]);
        if (!group)                    return error(false, 'unknown event ' + message.event);
        if (group.groupType !== 'event')return error(false, 'not an event ' + message.event);
        break;

      case 'event':
        if (!events.id2event(event[1]))return error(false, 'unknown event ' + message.event);
        break;

      default:
                                       return error(true, 'invalid event ' + message.event);
    }
    activity2.eventType = event[0];
    activity2.eventID = event[1];
    columns.push('eventType', 'eventID');
  }

  if ((!!message.task) && (message.task !== (activity.taskType + '/' + activity.taskID))) {
    task = message.task.split('/');
    if (task.length !== 2)             return error(true,  'invalid task element');
    task[1] = task[1].toString();
    switch (task[0]) {
      case 'group':
        group = groups.id2group(task[1]);
        if (!group)                    return error(false, 'unknown task ' + message.task);
        if (group.groupType !== 'task')return error(false, 'not a task ' + message.task);
        break;

      case 'task':
        if (!tasks.id2task(task[1]))   return error(false, 'unknown task ' + message.task);
        break;

      default:
                                       return error(true, 'invalid task ' + message.task);
    }
    activity2.taskType = task[0];
    activity2.taskID = task[1];
    columns.push('taskType', 'taskID');
  }

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  results.result = { activity: activity.activityID };
  if (columns.length > 0) {
    s = '(';
    s1 = 'UPDATE activities SET ';
    s3 = {};
    for (i = 0, s = ''; i < columns.length; i++, s = ', ') {
      s1 += s + columns[i] + '=$' + columns[i];
      s3['$' + columns[i]] = activity2[columns[i]];
    }
    s3.$activityID = activity.activityID;

    db.run(s1 +  ' WHERE activityID=$activityID', s3, function(err) {
      if (err) {
        logger.error(tag, { event: 'MODIFY activities.activityID for ' + activity.activityID, diagnostic: err.message });
        results.error = { permanent: false, diagnostic: 'internal error' };
        try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
        return;
      }

      activities[activity.activityUID] = activity2;
    });
  }

  return true;
};

var perform = exports.perform = function(logger, ws, api, message, tag) {
  var activity, activityID;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'activity performance', message.requestID, permanent, diagnostic);
  };

  if (!readyP())                                            return error(false, 'database not ready');

  activityID = message.path.slice(api.prefix.length + 1);
  if (activityID.length === 0)                              return error(true,  'missing activityID');

  activity = id2activity(activityID);
  if (!activity)                                            return error(false, 'unknown activity ' + activityID);

  switch (activity.taskType) {
    case 'group':
      message.path = '/api/v1/group/perform/' + activity.taskID;
      return groups.perform(logger, ws, { prefix: '/api/v1/group/perform' }, message, tag);

    case 'task':
      message.path = '/api/v1/task/perform/' + activity.taskID;
      return tasks.perform(logger, ws, { prefix: '/api/v1/task/perform' }, message, tag);

    default:
      return                                                       error(false, 'unknown task ' + activity.task);
  }
};

var remove = function(logger, ws, api, message, tag) {
  var activity, activityID, results;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'activity deletion', message.requestID, permanent, diagnostic);
  };

  if (!readyP())            return error(false, 'database not ready');

  activityID = message.path.slice(api.prefix.length + 1);
  if (activityID.length === 0) return error(true,  'missing activity id');
  activity = id2activity(activityID);
  if (!activity)               return error(true,  'invalid activity/' + activityID);
  delete(activities[activity.activityUID]);

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  db.run('DELETE FROM activities WHERE activityID=$activityID', { $activityID: activityID }, function(err) {
    if (err) {
      logger.error(tag, { event: 'DELETE activity.activityID for ' + activityID, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      activities[activity.activityUID] = activity;
    } else {
      results.result = { activity: activityID };
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

  db.all('SELECT * FROM activities ORDER BY sortOrder', function(err, rows) {
    if (err) {
      logger.error('activities', { event: 'SELECT activities.*', diagnostic: err.message });
      loadedP = false;
      return;
    }
    rows.forEach(function(activity) {
      var activityUUID = activity.activityUID;

      activities[activityUUID] = { activityID       : activity.activityID.toString()
                                 , activityUID      : activityUUID
                                 , activityName     : activity.activityName
                                 , activityComments : activity.activityComments
                                 , armed            : activity.armed
                                 , event            : activity.eventType + '/' + activity.eventID.toString()
                                 , eventType        : activity.eventType
                                 , eventID          : activity.eventID.toString()
                                 , task             : activity.taskType + '/' + activity.taskID.toString()
                                 , taskType         : activity.taskType
                                 , taskID           : activity.taskID.toString()
                                 , lastTime         : null
                                 };
    });

    loadedP = true;
  });

  return false;
};


var id2activity = exports.id2activity = function(id) {
  var uuid;

  if (!id) return null;

  for (uuid in activities) {
    if ((activities.hasOwnProperty(uuid)) && (id === activities[uuid].activityID)) return activities[uuid];
  }

  return null;
};

exports.name2activity = function(name) {
  var uuid;

  if (!name) return null;
  name = name.toLowerCase();

  for (uuid in activities) {
    if ((activities.hasOwnProperty(uuid)) && (name === activities[uuid].activityName.toLowerCase())) return activities[uuid];
  }

  return null;
};

exports.idlist = function() {
  var results, uuid;

  results = [];
  for (uuid in activities) if (activities.hasOwnProperty(uuid)) results.push(activities[uuid].activityID);
  return results;
};


var proplist = function(id, activity) {
  var result = { uuid     : activity.activityUID
               , name     : activity.activityName
               , comments : activity.activityComments
               , armed    : activity.armed
               , event    : activity.event
               , task     : activity.task
               , lastTime : activity.lastTime && new Date(activity.lastTime)
               };

  if (!!id) {
    result.whatami =  '/activity';
    result.whoami = 'activity/' + id;
  }

  return result;
};


exports.start = function() {
  readyP();

  manage.apis.push({ prefix   : '/api/v1/activity/create'
                   , route    : create
                   , access   : manage.access.level.write
                   , required : { uuid       : true
                                , name       : true
                                , event      : 'actor'
                                , task       : 'actor'
                                }
                   , optional : { comments   : true
                                , armed      : [ 'true', 'false' ]
                                }
                   , response : {}
                   , comments : [ 'the uuid is specified as the create suffix'
                                , 'the event actor must resolve to an event or a group of events'
                                , 'the task actor must resolve to an event or a group of tasks'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/activity/list'
                   , options  : { depth: 'flat' }
                   , route    : list
                   , access   : manage.access.level.read
                   , optional : { activityID : 'id'
                                , depth      : [ 'flat', 'tree', 'all' ]
                                }
                   , response : {}
                   , comments : [ 'if present, the activityID is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/activity/modify'
                   , route    : modify
                   , access   : manage.access.level.write
                   , required : { activityID : 'id' }
                   , response : ''
                   , comments : [ 'the activityID is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/activity/perform'
                   , route    : perform
                   , access   : manage.access.level.perform
                   , required : { activityID : 'id' }
                   , response : {}
                   , comments : [ 'the activityID is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/activity/delete'
                   , route    : remove
                   , access   : manage.access.level.write
                   , required : { activityID : 'id' }
                   , response : ''
                   , comments : [ 'the activityID is specified as the path suffix' ]
                   });
};
