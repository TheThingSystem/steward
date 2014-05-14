var stringify  = require('json-stringify-safe')
  , actors     = require('./../core/steward').actors
  , clone      = require('./../core/utility').clone
  , database   = require('./../core/database')
  , devices    = require('./../core/device')
  , events     = require('./api-manage-event')
  , groups     = require('./api-manage-group')
  , manage     = require('./../routes/route-manage')
  ;


var tasks = exports.tasks = {};

var db;


var create = function(logger, ws, api, message, tag) {
  var actor, actorID, actorType, entity, group, guard, p, parts, results, uuid, v;

  var error = function(permanent, diagnostic, viz) {
    return manage.error(ws, tag, 'task creation', message.requestID, permanent, diagnostic, viz);
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

  if (!message.perform) logger.error(tag, message);
  if (!message.perform)           return error(true,  'missing perform element');
  if (!message.perform.length)    return error(true,  'empty perform element');
  if (!message.parameter) message.parameter = '{}';

  if (actorType !== 'group') {
    parts = entity.whatami.split('/');
    actor = actors;
    try { for (p = 1; p < parts.length; p++) actor = actor[parts[p]]; } catch(ex) { actor = null; }
    if (!actor)                   return error(false,  'internal error');
    if ((!!actor.$validate) && (!!actor.$validate.perform)) {
      v = actor.$validate.perform(message.perform, message.parameter);
      if ((v.invalid.length > 0) || (v.requires.length > 0)) return error(false, 'invalid parameters ' + stringify(v));
    }
  }

  if (!message.guard) message.guard = '/';
  guard = message.guard.split('/');
  if (guard.length !== 2)         return error(true,  'invalid guard element');
  guard[1] = guard[1].toString();
  if (guard[0] !== '') {
    switch (guard[0]) {
      case 'group':
        group = groups.id2group(guard[1]);
        if (!group)               return error(false, 'unknown guard ' + message.guard);
        if (group.groupType !== 'event')return error(false, 'not an event ' + message.guard);
        break;

      case 'event':
        if (!events.id2event(guard[1]))return error(false, 'unknown guard ' + message.guard);
        break;

      default:
                                  return error(true, 'invalid event ' + message.guard);
    }
  }

  if (!!tasks[uuid])              return error(false, 'duplicate uuid',
                                               (!!tasks[uuid].taskID) ? 'task/' + tasks[uuid].taskID : null);
  tasks[uuid] = {};

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  db.run('INSERT INTO tasks(taskUID, taskName, taskComments, actorType, actorID, perform, parameter, guardType, guardID, '
         + 'created) '
         + 'VALUES($taskUID, $taskName, $taskComments, $actorType, $actorID, $perform, $parameter, $guardType, $guardID, '
         + 'datetime("now"))',
         { $taskUID: uuid, $taskName: message.name, $taskComments: message.comments, $actorType: actorType,
           $actorID: actorID, $perform: message.perform, $parameter: message.parameter, $guardType: guard[0],
           $guardID: guard[1] }, function(err) {
    var taskID;

    if (err) {
      delete(tasks[uuid]);
      logger.error(tag, { task: 'INSERT tasks.taskUID for ' + uuid, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    taskID = this.lastID.toString();

    results.result = { task: taskID };
    tasks[uuid] = { taskID       :  taskID
                  , taskUID      : uuid
                  , taskName     : message.name
                  , taskComments : message.comments
                  , actor        : message.actor
                  , actorType    : actor[0]
                  , actorID      : actor[1]
                  , perform      : message.perform
                  , parameter    : message.parameter
                  , guard        : guard[0] !== '' ? message.guard : null
                  , guardType    : guard[0]
                  , guardID      : guard[1]
                  , performP     : false
                  , lastTime     : null
                  };

    try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  });

  return true;
};

var list = function(logger, ws, api, message, tag) {
  var actor, againP, allP, entity, event, group, i, id, member, p, parts, props, results, suffix, task, treeP, type, uuid, who;

  if (!readyP()) return manage.error(ws, tag, 'task listing', message.requestID, false, 'database not ready');

  allP = message.options.depth === 'all';
  treeP = allP || (message.options.depth === 'tree');
  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0) suffix = null;

  results = { requestID: message.requestID, result: { tasks: {} } };
  if (allP) results.result.actors = {};
  for (uuid in tasks) {
    if (!tasks.hasOwnProperty(uuid)) continue;

    task = tasks[uuid];
    id = task.taskID;
    if ((!suffix) || (suffix === id)) {
      results.result.tasks['task/' + id] = proplist(null, task);

      if (treeP) {
        actor = actors[task.actorType];
        if (!actor) continue;
        entity = actor.$lookup(task.actorID);
        if (!!entity) {
          props = (!!entity.proplist) ? entity.proplist() : actor.$proplist(task.actorID, entity);
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

        if (!task.guard) continue;
        if (task.guardType === 'group') {
          group = groups.id2group(task.guardiD);
          if (!group) continue;

          if (!results.result.groups) results.result.groups = {};
          results.result.group[task.guard] = groups.proplist(null, group);
          continue;
        }

        if (task.guardType !== 'event') continue;
        event = events.id2event(task.guardID);
        if (!event) continue;

        if (!results.result.events) results.result.events = {};
        results.result.events[task.guard] = events.proplist(null, event);
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
            entity = events.id2event(member.actorID);
            if (!!entity) props = events.proplist(null, entity);
            break;

          case 'task':
            entity = id2task(member.actorID);
            if (!!entity) props = proplist(null, entity);
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


var perform = exports.perform = function(logger, ws, api, message, tag) {
  var actor, entity, group, i, j, member, members, p, parts, performed, present, results, search1, search2, task, taskID, v;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'task performance', message.requestID, permanent, diagnostic);
  };

  if (!readyP())                                            return error(false, 'database not ready');

  taskID = message.path.slice(api.prefix.length + 1);
  if (taskID.length === 0)                                  return error(true,  'missing taskID');

  task = id2task(taskID);
  if (!task)                                                return error(false, 'unknown task ' + taskID);

  present = {};
  search1 = [ { actorType: task.actorType, actorID: task.actorID, actor: task.actorType + '/' + task.actorID } ];
  while (search1.length > 0) {
    search2 = [];

    for (i = 0; i < search1.length; i++) {
      member = search1[i];
      if (!!present[member.actor]) continue;
      present[member.actor] = member;

      if (member.actorType !== 'group') continue;
      group = groups.id2group(member.actorID);
      if (!group) continue;

      members = group.members;
      for (j = 0; j < members.length; j++) {
        actor = members[j].actor;
        if (!!present[actor]) continue;
        if (member[0] !== 'group') present[actor] = members[j];

        member = actor.split('/');
        if (member[0] === 'group') search2.push({ actorType: 'group', actorID: member[1], actor: actor });
      }
    }

    search1 = search2;
  }

// TBD: temporal ordering
// NB:  the guard is ignored

  results = { requestID: message.requestID, devices: {} };
  for (actor in present) {
    if (!present.hasOwnProperty(actor)) continue;

    member = present[actor];
    if (member.actorType === 'group') continue;

    actor = actors[member.actorType];
    if (!actor) {
      results.devices[member.actor] = { status: 'failure',  permanent: true, diagnostic: 'internal error' };
      continue;
    }
    entity = actor.$lookup(member.actorID);
    if (!entity) {
      results.devices[member.actor] = { status: 'failure', permanent: false, diagnostic: 'unknown entity ' + member.actor };
      continue;
    }

    parts = entity.whatami.split('/');
    actor = actors;
    try { for (p = 1; p < parts.length; p++) actor = actor[parts[p]]; } catch(ex) { actor = null; }
    if (!actor) {
      results.devices[member.actor] = { status: 'failure', permanent: false, diagnostic: 'unknown performer ' + member.actor };
      continue;
    }

    p = task.parameter;
    if ((!!actor.$validate) && (!!actor.$validate.perform)) {
      v = actor.$validate.perform(task.perform, p);
      if ((v.invalid.length > 0) || (v.requires.length > 0)) {
        results.devices[member.actor] = { status: 'failure', diagnostic: 'invalid parameters ' + stringify(v) };
        continue;
      }
    }

    if (!!entity.perform) logger.debug('device/' + entity.deviceID, { api: 'task', perform: task.perform, parameter: p });
    performed = (!!entity.perform) ? (entity.perform)(entity, null, task.perform, p) : false;
    results.devices[member.actor] = { status: performed ? 'success' : 'failure' };
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var remove = function(logger, ws, api, message, tag) {
  var task, taskID, results;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'task deletion', message.requestID, permanent, diagnostic);
  };

  if (!readyP())            return error(false, 'database not ready');

  taskID = message.path.slice(api.prefix.length + 1);
  if (taskID.length === 0) return error(true,  'missing task id');
  task = id2task(taskID);
  if (!task)               return error(true,  'invalid task/' + taskID);
  delete(tasks[task.taskUID]);

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  db.run('DELETE FROM tasks WHERE taskID=$taskID', { $taskID: taskID }, function(err) {
    if (err) {
      logger.error(tag, { event: 'DELETE tasks.taskID for ' + taskID, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      tasks[task.taskUID] = task;
    } else {
      results.result = { task: taskID };
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

  db.all('SELECT * FROM tasks ORDER BY sortOrder', function(err, rows) {
    if (err) {
      logger.error('tasks', { event: 'SELECT tasks.*', diagnostic: err.message });
      loadedP = false;
      return;
    }
    rows.forEach(function(task) {
      var guardID = task.guardID || '';
      var taskUUID = task.taskUID;
      var parameter = task.parameter;

      if (parameter.indexOf('{') === 0) {
        try { JSON.parse(parameter); } catch(ex) {
          logger.error('task/' + task.taskID, { event: 'JSON.parse', data: parameter, diagnostic: ex.message });
        }
      }

      tasks[taskUUID] = { taskID       : task.taskID.toString()
                        , taskUID      : taskUUID
                        , taskName     : task.taskName
                        , taskComments : task.taskComments
                        , actor        : task.actorType + '/' + task.actorID.toString()
                        , actorType    : task.actorType
                        , actorID      : task.actorID.toString()
                        , guard        : task.guardType !== '' ? (task.guardType + '/' + guardID) : null
                        , guardType    : task.guardType
                        , guardID      : guardID.toString()
                        , perform      : task.perform
                        , parameter    : task.parameter
                        , performP     : false
                        , lastTime     : null
                        };
    });

    loadedP = true;
  });

  return false;
};


var id2task = exports.id2task = function(id) {
  var uuid;

  if (!id) return null;

  for (uuid in tasks) if ((tasks.hasOwnProperty(uuid)) && (id === tasks[uuid].taskID)) return tasks[uuid];

  return null;
};

exports.name2task = function(name) {
  var uuid;

  if (!name) return null;
  name = name.toLowerCase();

  for (uuid in tasks) if ((tasks.hasOwnProperty(uuid)) && (name === tasks[uuid].taskName.toLowerCase())) return tasks[uuid];

  return null;
};

exports.idlist = function() {
  var results, uuid;

  results = [];
  for (uuid in tasks) if (tasks.hasOwnProperty(uuid)) results.push(tasks[uuid].taskID);
  return results;
};


var proplist = exports.proplist = function(id, task) {
  var result = { uuid      : task.taskUID
               , name      : task.taskName
               , comments  : task.taskComments
               , actor     : task.actor
               , perform   : task.perform
               , parameter : task.parameter
               , guard     : task.guard
               , lastTime  : task.lastTime && new Date(task.lastTime)
               };

  if (!!id) {
    result.whatami =  '/task';
    result.whoami = 'task/' + id;
  }

  return result;
};


exports.start = function() {
  readyP();

  manage.apis.push({ prefix   : '/api/v1/task/create'
                   , route    : create
                   , access   : manage.access.level.write
                   , required : { uuid       : true
                                , name       : true
                                , actor      : 'actor'
                                , perform    : true
                                }
                   , optional : { comments   : true
                                , parameter  : true
                                }
                   , response : {}
                   , comments : [ 'the uuid is specified as the create suffix'
                                , 'the actor must resolve to a device or a group of devices'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/task/list'
                   , options  : { depth: 'flat' }
                   , route    : list
                   , access   : manage.access.level.read
                   , optional : { task       : 'id'
                                , depth      : [ 'flat', 'tree', 'all' ]
                                }
                   , response : {}
                   , comments : [ 'if present, the task is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/task/perform'
                   , route    : perform
                   , access   : manage.access.level.perform
                   , required : { taskID     : 'id'
                                , perform    : true
                                }
                   , optional : { parameter  : true
                                }
                   , response : {}
                   , comments : [ 'the taskID is specified as the path suffix'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/task/delete'
                   , route    : remove
                   , access   : manage.access.level.write
                   , required : { taskID : 'id' }
                   , response : ''
                   , comments : [ 'the taskID is specified as the path suffix' ]
                   });
};
