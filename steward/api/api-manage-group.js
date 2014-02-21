var util       = require('util')
  , stringify  = require('json-stringify-safe')
  , database   = require('./../core/database')
  , devices    = require('./../core/device')
  , steward    = require('./../core/steward')
  , actors     = steward.actors
  , utility    = require('./../core/utility')
  , broker      = utility.broker
  , events     = require('./api-manage-event')
  , manage     = require('./../routes/route-manage')
  , tasks      = require('./api-manage-task')
  ;


var groups    = exports.groups    = {};
var operators = exports.operators = { and: 0, or: 1, not: 2 };
// TBD: replace 'device' with 'actor' ???
var types     = exports.types     = { device: 'device', event: 'event', task: 'task' };

var db;


var create = function(logger, ws, api, message, tag) {
  var actor, i, member, members, operator, parent, parentID, results, type, uuid;

  var error = function(permanent, diagnostic, viz) {
    return manage.error(ws, tag, 'group creation', message.requestID, permanent, diagnostic, viz);
  };

  if (!readyP())                                            return error(false, 'database not ready');

  uuid = message.path.slice(api.prefix.length + 1);
  if (uuid.length === 0)                                    return error(true,  'missing uuid');

  parentID = message.parentID || 0;
  if (parentID !== 0) {
    parent = id2group(parentID);
    if (!parent)                                            return error(true,  'invalid parent group/' + parentID);
  }

  if (!message.name)                                        return error(true,  'missing name element');
  if (!message.name.length)                                 return error(true,  'empty name element');

  if (!message.comments) message.comments = '';

  if (!message.type) type = 'device';
  else {
    type = utility.key2value(types, message.type);
     if (type === undefined)                                return error(true,  'missing type element');
  }
  if ((parentID !== 0) && (parent.groupType !== type))      return error(false, 'parent/group type mismatch');

  if (!message.operator) operator = operators.and;
  else {
    operator = utility.key2value(operators, message.operator);
    if (operator === undefined)                             return error(true,  'invalid group operator');
  }

  if (!message.members)                                     return error(true,  'missing members element');
  members = message.members;
  if (!util.isArray(members))                               return error(true,  'members element not an array');
  if ((operator === operators.not) && members.length !== 1) return error(true,  'not operator requires 1 member');
  for (i = 0; i < members.length; i++) {
    if (!members[i])                                        return error(true,  'null member element');
    member = members[i].split('/');
    if (member.length !== 2)                                return error(true,  'invalid member element');
    member[1] = member[1].toString();
    member[2] = members[i];
    members[i] = member;

    switch (member[0]) {
      case 'event':
      case 'task':
        if (member[0] !== type)                             return error(false, 'group/member type mismatch');
        break;

      case 'group':
        member = id2group(member[1]);
        if (!member)                                        return error(false, 'invalid member ' + members[i]);
        if (member.groupType !== type)                      return error(false, 'group/member type mismatch');
        break;

      default:
        actor = actors[member[0]];
        if (!actor)                                         return error(true,  'invalid member ' + member[2]);
        if (!actor.$lookup(member[1]))                      return error(false, 'unknown member ' + member[2]);
        if (type !== 'device')                              return error(false, 'group/actor type mismatch');
        break;
    }
  }

  if (!!groups[uuid])                                       return error(false, 'duplicate uuid',
                                                                         'group/' + groups[uuid].groupID);
  groups[uuid] = {};

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  db.run('INSERT INTO groups(groupUID, parentID, groupName, groupComments, groupType, groupOperator, created) '
         + 'VALUES($groupUID, $parentID, $groupName, $groupComments, $groupType, $groupOperator, datetime("now"))',
         { $groupUID: uuid, $parentID: parentID, $groupName: message.name, $groupComments: message.comments,
           $groupType: type, $groupOperator: operator }, function(err) {
    var cnt, groupID, triple;

    var addmember = function(err) {
      if (err) {
        logger.error(tag, { event: 'INSERT members.groupID for ' + groupID, diagnostic: err.message });
        results.error = { permanent: false, diagnostic: 'internal error' };
      }
      if (--cnt <= 0) try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
    };

    if (err) {
      delete(groups[uuid]);
      logger.error(tag, { event: 'INSERT groups.groupUID for ' + uuid, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    groupID = this.lastID.toString();
    cnt = members.length;

    results.result = { group: groupID };
    groups[uuid] = { groupID       : groupID
                   , groupUID      : uuid
                   , parentID      : parentID
                   , groupName     : message.name
                   , groupComments : message.comments
                   , groupType     : type
                   , groupOperator : operator
                   , members       : []
                   };

    if (cnt === 0) {
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    for (i = 0; i < members.length; i++) {
      member = members[i];
      triple = { actor: member[2], actorType: member[0], actorID: member[1] };
      triple[member[0] + 'ID'] = member[1];
      groups[uuid].members.push(triple);
      db.run('INSERT INTO members(groupID, actorType, actorID, created) '
             + 'VALUES($groupID, $actorType, $actorID, datetime("now"))',
             { $groupID: groupID, $actorType: triple.actorType, $actorID: triple.actorID }, addmember);
    }
  });

  return true;
};

var list = function(logger, ws, api, message, tag) {
  var actor, againP, allP, child, childID, entity, event, group, i, id, j, member, needed, parents, props, results, suffix,
      task, treeP, type, uuid, who;

  if (!readyP()) return manage.error(ws, tag, 'group listing', message.requestID, false, 'database not ready');

  allP = message.options.depth === 'all';
  treeP = allP || (message.options.depth === 'tree');
  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0) suffix = null;

  results = { requestID: message.requestID, result: {} };

  parents = {};
  if (allP) for (uuid in groups) if (groups.hasOwnProperty(uuid)) parents['group/' + groups[uuid].groupID] = [];

  results = { requestID: message.requestID, result: {} };
  for (actor in actors) if (actors.hasOwnProperty(actor)) results.result[actor + 's'] = {};
  if (treeP) {
    results.result.events = {};
    results.result.tasks = {};
  }
  for (uuid in groups) {
    if (!groups.hasOwnProperty(uuid)) continue;

    group = groups[uuid];
    id = group.groupID;
    if ((!suffix) || (suffix === id)) {
      results.result.groups['group/' + id] = proplist(null, group);

      if (treeP) {
        for (i = 0; i < group.members.length; i++) {
          member = group.members[i];
          if (!!member.groupID) continue;

          entity = null;
          switch (member.actorType) {
            case 'event':
              event = events.id2event(member.actorID);
              if (!event) break;
              results.result[member.actorType + 's'][member.actor] = events.proplist(null, event);
              actor = actors[type = event.actorType];
              entity = actor.$lookup(event.actorID);
              break;

            case 'task':
              task = tasks.id2task(member.actorID);
              if (!task) break;
              results.result[member.actorType + 's'][member.actor] = tasks.proplist(null, task);
              actor = actors[type = task.actorType];
              break;

            default:
              actor = actors[type = member.actorType];
              entity = actor.$lookup(member.actorID);
              break;
          }
          if (!!entity) {
            props = entity.proplist();
            who = props.whoami; delete(props.whoami);
            results.result[type + 's'][who] = props;
          }
        }
      }
    }

    if (allP) {
      for (i = 0; i < group.members.length; i++) {
        child = id2group(group.members[i].groupID);
        if (!!child) parents['group/' + group.members[i].groupID].push(id);
      }
    }
  }

  againP = treeP;
  while (againP) {
    againP = false;

    for (id in results.result.groups) {
      if (!results.result.groups.hasOwnProperty(id)) continue;

      group = id2group(id.split('/')[1]);
      if (!group) continue;    // eh?

      needed = allP ? parents[id] : [];
      for (i = 0; i < group.members.length; i++) needed.push(group.members[i].groupID);

      for (i = 0; i < needed.length; i++) {
        if (((childID = needed[i]) === '0') || (!!results.result.groups['group/' + childID])) continue;
        child = id2group(childID);
        if (!child) continue;

        againP = true;

        results.result.groups['group/' + childID] = proplist(null, child);

        for (j = 0; j < child.members.length; j++) {
          member = child.members[j];
          if (!!member.groupID) continue;

          props = null;
          switch (member.actorType) {
            case 'event':
              entity = events.id2event(member.actorID);
              if (!!entity) props = events.proplist(null, entity);
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
          }
        }
      }
    }
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var modify = function(logger, ws, api, message, tag) {
  var actor, columns, group, group2, groupID, i, member, members, members2, operator, parent, results, s, s1, s3, triple, type;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'group modification', message.requestID, permanent, diagnostic);
  };

  if (!readyP())            return error(false, 'database not ready');

  groupID = message.path.slice(api.prefix.length + 1);
  if (groupID.length === 0) return error(true,  'missing group id');
  group = id2group(groupID);
  if (!group)               return error(true,  'invalid group/' + groupID);
  group2 = utility.clone(group);

  columns = [];

  if (!!message.parentID) {
    if (message.parentID !== 0) {
      parent = id2group(message.parentID);
      if (!parent)                                          return error(true,  'invalid parent group/' + message.parentID);
    }
    if ((message.parentID.toString() != group.parentID)) {
      group2.parentID = message.parentID.toString();
      columns.push('parentID');
    }
  }

  if ((!!message.name) && (message.name.length) && (message.name !== group.groupName)) {
    group2.groupName = message.name;
    columns.push('groupName');
  }

  if ((!!message.comments) && (message.comments !== group.groupComments)) {
    group2.groupComments = message.comments;
    columns.push('groupComments');
  }

  if (!!message.type) {
    type = utility.key2value(types, message.type);
    if (type === undefined)                                 return error(true,  'missing type element');

    if ((!message.parentID) && (group.parentID !== 0)) parent = id2group(group.parentID);
    if ((!!parent) && (parent.groupType !== type))          return error(false, 'parent/group type mismatch');

    if (type !== group.groupType) {
      group2.groupType = type;
      columns.push('groupType');
    }
  } else type = group.groupType;

  if (!!message.operator) {
    operator = utility.key2value(operators, message.operator);
    if (operator === undefined)                             return error(true,  'invalid group operator');

    if (operator !== group.groupOperator) {
      group2.groupOperator = operator;
      columns.push('groupOperator');
    }
  }

  members = [];
  if (!!message.members) {
    members = message.members;
    if (!util.isArray(members))                             return error(true,  'members element not an array');
    if ((operator === operators.not) && members.length !== 1) return error(true,  'not operator requires 1 member');
    for (i = 0; i < members.length; i++) {
    if (!members[i])                                        return error(true,  'null member element');
      member = members[i].split('/');
      if (member.length !== 2)                              return error(true,  'invalid member element');
      member[1] = member[1].toString();
      member[2] = members[i];
      members[i] = member;

      switch (member[0]) {
        case 'event':
        case 'task':
          if (member[0] !== type)                           return error(false, 'group/member type mismatch');
          break;

        case 'group':
          member = id2group(member[1]);
          if (!member)                                      return error(false, 'invalid member ' + members[i]);
          if (member.groupType !== type)                    return error(false, 'group/member type mismatch');
          break;

        default:
          actor = actors[member[0]];
          if (!actor)                                       return error(true,  'invalid member ' + member[2]);
          if (!actor.$lookup(member[1]))                    return error(false, 'unknown member ' + member[2]);
          if (type !== 'device')                            return error(false, 'group/actor type mismatch');
          break;
      }
    }
  }

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  if (!!members) {
    members2 = [];
    for (i = 0; i < message.members.length; i++) if (group.members.indexOf(message.members[i]) < 0) members2.push(members[i]);
    members = members2;

    members2 = [];
    for (i = 0; i < group.members.length; i++) if (message.members.indexOf(group.members[i]) < 0) members2.push(group.members[i]);

  }
  var fixmembers = function() {
    var cnt, j;

    var addmember = function(err) {
      if (err) {
        logger.error(tag, { event: 'INSERT members.groupID for ' + group.groupID, diagnostic: err.message });
        results.error = { permanent: false, diagnostic: 'internal error' };
      }
      if (--cnt <= 0) try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
    };

    var delmember = function(err) {
      if (err) {
        logger.error(tag, { event: 'DELETE members.groupID for ' + group.groupID, diagnostic: err.message });
        results.error = { permanent: false, diagnostic: 'internal error' };
      }
      if (--cnt <= 0) try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
    };

    cnt = (!!members) ? members.length : 0;

    groups[group.groupUID] = group2;
    if (!!members) groups[group.members] = members;

    if (cnt === 0) {
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    for (i = 0; i < members.length; i++) {
      member = members[i];
      triple = { actor: member[2], actorType: member[0], actorID: member[1] };
      triple[member[0] + 'ID'] = member[1];
      group.members.push(triple);

      db.run('INSERT INTO members(groupID, actorType, actorID, created) '
             + 'VALUES($groupID, $actorType, $actorID, datetime("now"))',
             { $groupID: groupID, $actorType: triple.actorType, $actorID: triple.actorID }, addmember);
    }

    for (i = 0; i < members2.length; i++) {
      member = members2[i].split('/');
      triple = { actor: members2[i], actorType: member[0], actorID: member[1].toString() };
      triple[member[0] + 'ID'] = member[1];
      j = group.members.indexOf(members2[i]);
      if (j >= 0) group.members.splice(j, 1);

      db.run('DELETE FROM members WHERE groupID=$groupID AND actorType=$actorType AND actorID=$actorID',
             { $groupID: groupID, $actorType: triple.actorType, $actorID: triple.actorID }, delmember);
    }
  };

  results.result = { group: group.groupID };
  if (columns.length > 0) {
    s = '(';
    s1 = 'UPDATE groups SET ';
    s3 = {};
    for (i = 0, s = ''; i < columns.length; i++, s = ', ') {
      s1 += s + columns[i] + '=$' + columns[i];
      s3['$' + columns[i]] = group2[columns[i]];
    }
    s3.$groupID = group.groupID;

    db.run(s1 + ' WHERE groupID=$groupID', s3, function(err) {
      if (err) {
        logger.error(tag, { event: 'MODIFY groups.groupID for ' + group.groupID, diagnostic: err.message });
        results.error = { permanent: false, diagnostic: 'internal error' };
        try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
        return;
      }

      fixmembers();
    });
  } else fixmembers();

  return true;
};

var perform = exports.perform = function(logger, ws, api, message, tag) {
  var actor, entity, group, groupID, i, j, member, members, p, parts, performed, present, results, search1, search2, v;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'group performance', message.requestID, permanent, diagnostic);
  };

  if (!readyP())                                            return error(false, 'database not ready');

  groupID = message.path.slice(api.prefix.length + 1);
  if (groupID.length === 0)                                 return error(true,  'missing groupID');

  group = id2group(groupID);
  if (!group)                                               return error(false, 'unknown group ' + groupID);

  if (group.groupType === 'task') return perform2(logger, ws, message, group, tag);
  else if (group.groupType !== 'device')                    return error(true,  'invalid groupType: ' + group.groupType);

  if (!message.perform)                                     return error(true,  'missing perform element');
  if (!message.perform.length)                              return error(true,  'empty perform element');

  if (!message.parameter) message.parameter = '{}';

  present = {};
  search1 = [ group ];
  while (search1.length > 0) {
    search2 = [];

    for (i = 0; i < search1.length; i++) {
      members = search1[i].members;
      for (j = 0; j < members.length; j++) {
        actor = members[j].actor;
        if (!!present[actor]) continue;
        present[actor] = members[j];

        member = actor.split('/');
        if (member[0] !== 'group') continue;
        group = id2group(member[1]);
        if (!!group) search2.push(group);
      }
    }

    search1 = search2;
  }

  results = { requestID: message.requestID, devices: {} };
  for (actor in present) {
    if (!present.hasOwnProperty(actor)) continue;

    member = present[actor];
    if (member.actorType === 'group') continue;

    actor = actors[member.actorType];
    if (!actor) {
      results.devices[member.actor] = { status: 'failure', permanent: true,  diagnostic: 'internal error' };
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

    p = message.parameter;
    if ((!!actor.$validate) && (!!actor.$validate.perform)) {
      v = actor.$validate.perform(message.perform, p);
      if ((v.invalid.length > 0) || (v.requires.length > 0)) {
        results.devices[member.actor] = { status: 'failure', diagnostic: 'invalid parameters ' + stringify(v) };
        continue;
      }
    }

    if (!!entity.perform) logger.debug('device/' + entity.deviceID, { api: 'group', perform: message.perform, parameter: p });
    performed = (!!entity.perform) ? (entity.perform)(entity, null, message.perform, p) : false;
    results.devices[member.actor] = { status: performed ? 'success' : 'failure' };
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var perform2 = function(logger, ws, message, group /*, tag */) {
  var device, i, performance, performances, results, task, uuid;

  steward.prepare('group/' + group.groupID);

  performances = [];
  for (uuid in tasks.tasks) {
    if (!tasks.tasks.hasOwnProperty(uuid)) continue;

    task = tasks.tasks[uuid];
    if (!task.performP) continue;

    task.performP = false;

    performances.push({ taskID:    task.taskID
                      , devices:   steward.participants(task.actor)
                      , perform:   task.perform
                      , parameter: task.parameter });
  }

  results = { requestID: message.requestID, tasks: {} };
  for (i = 0; i < performances.length; i++) {
    performance = performances[i];
    results.tasks[performance.taskID] = { devices: utility.keys(performance.devices)
                                        , perform: task.perform
                                        , parameter: task.parameter
                                        };

    logger.debug('perform',
                { taskID: performance.taskID, perform: performance.perform, parameter: performance.parameter });
    for (device in performance.devices) {
      if (!performance.devices.hasOwnProperty(device)) continue;

      broker.publish('actors', 'perform', performance.taskID, device, performance.perform, performance.parameter);
    }
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};


var remove = function(logger, ws, api, message, tag) {
  var group, groupID, results;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'group deletion', message.requestID, permanent, diagnostic);
  };

  if (!readyP())            return error(false, 'database not ready');

  groupID = message.path.slice(api.prefix.length + 1);
  if (groupID.length === 0) return error(true,  'missing group id');
  group = id2group(groupID);
  if (!group)               return error(true,  'invalid group/' + groupID);
  delete(groups[group.groupUID]);

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  db.run('DELETE FROM groups WHERE groupID=$groupID', { $groupID: groupID }, function(err) {
    if (err) {
      logger.error(tag, { event: 'DELETE group.groupID for ' + groupID, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      groups[group.groupUID] = group;
    } else {
      results.result = { group: groupID };
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

  db.all('SELECT * FROM groups ORDER BY sortOrder', function(err, rows) {
    if (err) {
      logger.error('groups', { event: 'SELECT groups.*', diagnostic: err.message });
      loadedP = false;
      return;
    }
    rows.forEach(function(group) {
      var groupUUID = group.groupUID;

      groups[groupUUID] = { groupID       : group.groupID.toString()
                          , groupUID      : groupUUID
                          , parentID      : group.parentID.toString()
                          , groupName     : group.groupName
                          , groupComments : group.groupComments
                          , groupType     : group.groupType
                          , groupOperator : group.groupOperator
                          , members       : []
                          };
      db.all('SELECT * FROM members WHERE groupID=$groupID ORDER BY sortOrder',
             { $groupID: group.groupID }, function(err, members) {
        if (err) {
          logger.error('group/' + group.groupID,
                       { event: 'SELECT members.* for groupID ' + group.groupID, diagnostic: err.message });
          loadedP = false;
          return;
        }
        members.forEach(function(member) {
          var triple = { actor     : member.actorType + '/' + member.actorID
                       , actorType : member.actorType
                       , actorID   : member.actorID.toString() };
          triple[member.actorType + 'ID'] = member.actorID.toString();
          groups[groupUUID].members.push(triple);
        });
      });
    });

    loadedP = true;
  });

  return false;
};


var id2group = exports.id2group = function(id) {
  var uuid;

  if (!id) return null;

  for (uuid in groups) if ((groups.hasOwnProperty(uuid)) && (id === groups[uuid].groupID)) return groups[uuid];

  return null;
};

exports.name2group = function(name) {
  var uuid;

  if (!name) return null;
  name = name.toLowerCase();

  for (uuid in groups) {
    if ((groups.hasOwnProperty(uuid)) && (name === groups[uuid].groupName.toLowerCase())) return groups[uuid];
  }

  return null;
};

var idlist = exports.idlist = function() {
  var results, uuid;

  results = [];
  for (uuid in groups) if (groups.hasOwnProperty(uuid)) results.push(groups[uuid].groupID);
  return results;
};

var actorlist = function(membership) {
  var i, members;

  members = [];
  for (i = 0; i < membership.length; i++) members.push(membership[i].actor);
  return members;
};


var proplist = exports.proplist = function(id, group) {
  var result = { uuid     : group.groupUID
               , name     : group.groupName
               , comments : group.groupComments
               , members  : actorlist(group.members)
               , status   : (utility.value2key(operators, group.groupOperator) || group.groupOperator) + ' ' + group.groupType
               };

  if (!!id) {
    result.whatami =  '/group';
    result.whoami = 'group/' + id;
  }

  return result;
};


exports.start = function() {
  readyP();

  actors.group = { $info     : { type       : '/group'
                               , properties : { operators : utility.keys(operators)
                                              , types     : utility.keys(types)
                                              }
                               }
                 , $lookup   : id2group
                 , $list     : idlist
                 , $proplist : proplist
                 };

  manage.apis.push({ prefix   : '/api/v1/group/create'
                   , route    : create
                   , access   : manage.access.level.write
                   , required : { uuid       : true
                                , name       : true
                                , members    : 'array'
                                }
                   , optional : { comments   : true
                                , parentID   : true
                                , type       : [ 'group', 'event', 'task' ]
                                , operators  : [ 'operators', 'or', 'not' ]
                                }
                   , response : {}
                   });
  manage.apis.push({ prefix   : '/api/v1/group/list'
                   , options  : { depth: 'flat' }
                   , route    : list
                   , access   : manage.access.level.read
                   , optional : { event      : 'id'
                                , depth      : [ 'flat', 'tree', 'all' ]
                                }
                   , response : {}
                   , comments : [ 'if present, the group is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/group/modify'
                   , route    : modify
                   , access   : manage.access.level.write
                   , required : { groupID : 'id' }
                   , response : ''
                   , comments : [ 'the groupID is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/group/perform'
                   , route    : perform
                   , access   : manage.access.level.perform
                   , required : { groupID    : 'id'
                                , perform    : true
                                }
                   , optional : { parameter  : true
                                }
                   , response : {}
                   , comments : [ 'the groupID is specified as the path suffix'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/group/delete'
                   , route    : remove
                   , access   : manage.access.level.write
                   , required : { groupID : 'id' }
                   , response : ''
                   , comments : [ 'the groupID is specified as the path suffix' ]
                   });
};
