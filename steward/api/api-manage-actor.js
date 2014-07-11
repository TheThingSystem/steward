var stringify  = require('json-stringify-safe')
  , clone      = require('./../core/utility').clone
  , steward    = require('./../core/steward')
  , manage     = require('./../routes/route-manage')
  ;


var list = exports.list = function(logger, ws, api, message, tag) {/* jshint unused: false */
  var actor, actors, againP, allP, child, entity, entities, i, id, info, p, parts, props, results, suffix, treeP, what, who;

  allP = message.options.depth === 'all';
  treeP = allP || (message.options.depth === 'tree');
  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0) suffix = null;

  results = { requestID: message.requestID, result: { actors: {} } };
  actors = steward.actors;
  for (actor in actors) {
    if (!actors.hasOwnProperty(actor)) continue;

    info = clone(actors[actor].$info);
    what = info.type; delete(info.type);
    results.result.actors[what] = info;
    if (!treeP) continue;

    for (child in actors[actor]) {
      if ((!actors[actor].hasOwnProperty(child)) || (child.charAt(0) === '$')) continue;

      info = clone(actors[actor][child].$info);
      what = info.type; delete(info.type);
      results.result.actors[what] = info;
    }
  }

  againP = treeP;
  while (againP) {
    againP = false;

    for (id in results.result.actors) {
      if (!results.result.actors.hasOwnProperty(id)) continue;

      parts = id.split('/');
      actor = actors;
      for (p = 1; p < parts.length; p++) actor = actor[parts[p]];
      for (child in actor) {
        if ((!actor.hasOwnProperty(child)) || (child.charAt(0) === '$')) continue;
        info = clone(actor[child].$info);
        if (!results.result.actors[info.type]) {
          againP = true;

          what = info.type; delete(info.type);
          results.result.actors[what] = info;
        }
      }
    }
  }

  if (allP) {
    for (id in results.result.actors) {
      if (!results.result.actors.hasOwnProperty(id)) continue;

      parts = id.split('/');
      actor = actors;
      for (p = 1; p < parts.length; p++) actor = actor[parts[p]];
      if (!actor) {
        logger.error(tag, 'missing linkage for ' + id);
        continue;
      }
      if (!!actor.$list) {
        entities = (actor.$list)();
        for (i = 0; i < entities.length; i++) {
          if (!(entity = actor.$lookup(entities[i]))) continue;
          props = (!!entity.proplist) ? entity.proplist() : actor.$proplist(entities[i], entity);
          what = props.whatami; delete(props.whatami);
          who = props.whoami; delete(props.whoami);
          if (!results.result[what]) results.result[what] = {};
          results.result[what][who] = props;
        }
      }
    }
  }

  if (!!suffix) {
    parts = suffix.split('/');
    if (parts[parts.length - 1] === '') parts.pop();
    suffix = '/' + parts.join('/');

    for (actor in results.result.actors) {
      if ((results.result.actors.hasOwnProperty(actor)) && (actor.indexOf(suffix) !== 0)) delete(results.result.actors[actor]);
    }

    for (actor in results.result) {
      if ((results.result.hasOwnProperty(actor)) && (actor !== 'actors') && (actor.indexOf(suffix) !== 0)) {
        delete(results.result[actor]);
      }
    }
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var perform = exports.perform = function(logger, ws, api, message, tag) {
  var actor, actors, againP, child, entity, entities, i, id, info, p, parts, performed, props, present, results, suffix, v,
      what, who;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'actor performance', message.requestID, permanent, diagnostic);
  };

  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0)                               return error(true,  'missing actor prefix');
  if (suffix.indexOf('group') === 0)                     return error(true,  'group may not be used as actor prefix');

  if (!message.perform) logger.error(tag, message);
  if (!message.perform)                                  return error(true,  'missing perform element');
  if (!message.perform.length)                           return error(true,  'empty perform element');

  if (!message.parameter) message.parameter = '{}';

  present = { actors: {}, who: {} };
  actors = steward.actors;
  for (actor in actors) {
    if (!actors.hasOwnProperty(actor)) continue;

    info = clone(actors[actor].$info);
    what = info.type; delete(info.type);
    present.actors[what] = info;

    for (child in actors[actor]) {
      if ((!actors[actor].hasOwnProperty(child)) || (child.charAt(0) === '$')) continue;

      info = clone(actors[actor][child].$info);
      what = info.type; delete(info.type);
      present.actors[what] = info;
    }
  }

  againP = true;
  while (againP) {
    againP = false;

    for (id in present.actors) {
      if (!present.actors.hasOwnProperty(id)) continue;

      parts = id.split('/');
      actor = actors;
      for (p = 1; p < parts.length; p++) actor = actor[parts[p]];
      for (child in actor) {
        if ((!actor.hasOwnProperty(child)) || (child.charAt(0) === '$')) continue;
        info = clone(actor[child].$info);
        if (!present.actors[info.type]) {
          againP = true;

          what = info.type; delete(info.type);
          present.actors[what] = info;
        }
      }
    }
  }

  for (id in present.actors) {
    if (!present.actors.hasOwnProperty(id)) continue;

    parts = id.split('/');
    actor = actors;
    for (p = 1; p < parts.length; p++) actor = actor[parts[p]];
    if (!!actor.$list) {
      entities = (actor.$list)();
      for (i = 0; i < entities.length; i++) {
        if (!(entity = actor.$lookup(entities[i]))) continue;
        props = (!!entity.proplist) ? entity.proplist() : actor.$proplist(entities[i], entity);
        who = props.whoami;
        present.who[who] = props.whatami;
      }
    }
  }

  parts = suffix.split('/');
  if (parts[parts.length - 1] === '') parts.pop();
  suffix = '/' + parts.join('/');

// TBD: temporal ordering
// TBD: the guard is ignored

  results = { requestID: message.requestID, actors: {} };
  who = present.who;
  for (who in present.who) {
    if ((!present.who.hasOwnProperty(who)) || (present.who[who].indexOf(suffix) !== 0)) continue;

    actor = actors[who.split('/')[0]];
    if (!actor) {
      results.actors[who] = { status: 'failure', permanent: true, diagnostic: 'internal error' };
      continue;
    }
    entity = actor.$lookup(who.split('/')[1].toString());
    if (!entity) {
      results.actors[who] = { status: 'failure', permanent: false, diagnostic: 'unknown entity ' + who };
      continue;
    }

    parts = entity.whatami.split('/');
    actor = actors;
    try { for (p = 1; p < parts.length; p++) actor = actor[parts[p]]; } catch(ex) { actor = null; }
    if (!actor) {
      results.actors[who] = { status: 'failure', permanent: false, diagnostic: 'unknown performer ' + who };
      continue;
    }

    p = message.parameter;
    if ((!!actor.$validate) && (!!actor.$validate.perform)) {
      v = actor.$validate.perform(message.perform, p);
      if ((v.invalid.length > 0) || (v.requires.length > 0)) {
        results.actors[who] = { status: 'failure', diagnostic: 'invalid parameters ' + stringify(v) };
        continue;
      }
    }

    if (!!entity.perform) logger.debug('device/' + entity.deviceID, { api: 'actor', perform: message.perform, parameter: p });
    performed = (!!entity.perform) ? (entity.perform)(entity, null, message.perform, p) : false;
    results.actors[who] = { status: performed ? 'success' : 'failure' };
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};


exports.start = function() {
  manage.apis.push({ prefix   : '/api/v1/actor/list'
                   , options  : { depth: 'flat' }
                   , route    : list
                   , access   : manage.access.level.read
                   , optional : { actor      : 'id'
                                , depth      : [ 'flat', 'tree', 'all' ]
                                }
                   , response : {}
                   , comments : [ 'if present, the actor is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/actor/perform'
                   , route    : perform
                   , access   : manage.access.level.perform
                   , required : { prefix     : true
                                , perform    : true
                                }
                   , optional : { parameter  : true
                                }
                   , response : {}
                   , comments : [ 'the actor prefix is specified as the path suffix'
                                , 'the perform/parameter pair is checked for validity for each actor'
                                ]
                   });

  steward.status.actors =
      { reporter : function(logger, ws) {
                     list(logger, ws, { prefix: '/api/v1/actor/list' },
                          { options: { depth: 'all' }, path: '/api/v1/actor/list/', requestID: 0 }, '');
                   }
      };
};
