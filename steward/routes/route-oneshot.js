/*  GET /oneshot
                ?behavior = perform | report

                &entity   = activity    & ( name=... | id=... )
                &entity   = actor       & prefix=...
                &entity   = device      & ( name=... | id=... )
                &entity   = group       & ( name=... | id=... )
                &entity   = place       & ( name=... | id=... )
                &entity   = task        & ( name=... | id=... )

    for perform behavior:
      - actor, device, and group: & perform=... [ & parameter=... ]
      - group must be a 'device' group

    for report behavior:
      - only actor, device, and place allowed
 */

var url         = require('url')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  , activities  = require('./../api/api-manage-activity')
  , actors      = require('./../api/api-manage-actor')
  , devices     = require('./../api/api-manage-device')
  , groups      = require('./../api/api-manage-group')
  , places      = require('./../actors/actor-place')
  , tasks       = require('./../api/api-manage-task')
  ;

var logger = utility.logger('server');

var requestID = 1;

var find = function(query) {
  var e, id, x;

  if (!!query.id) {
    id = query.id;
    if (!!query.entity) {
      x = id.indexOf(query.entity + '/');
      if (x === 0) id = id.substr(query.entity.length + 1);
    }
  }

  var f = { activity : function() {
                         if (!!id) {
                            e = activities.id2activity(id);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown activityID: ' + query.id } };
                          } else if (!!query.name) {
                            e = activities.name2activity(query.name);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown activity: ' + query.name } };
                          } else return false;
                          if (query.behavior === 'report') return false;

                          return { message : { path: '/api/v1/activity/perform/' + e.activityID }
                                 , perform : activities.perform
                                 };
                        }

           , actor    : function() {
                          var prefix;

                          if ((!query.prefix) || ((query.behavior === 'perform') && (!query.perform))) return false;
                          if (query.behavior === 'report') return false;

                          prefix = query.prefix;
                          if (prefix.indexOf('/') === 0) prefix = prefix.substring(1);
                          return { message : { path      : '/api/v1/actor/perform/' + prefix
                                             , perform   : query.perform
                                             , parameter : query.parameter
                                             }
                                 , perform : actors.perform
                                 };
                        }

           , device   : function() {
                          var actor;

                          actor = steward.actors.device;
                          if (!actor) return { error: { permanent: false, diagnostic: 'internal error' } };
                          if (!!id) {
                            e = actor.$lookup(id);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown deviceID: ' + query.id } };
                          } else if (!!query.name) {
                            e = devices.name2device(query.name);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown device: ' + query.name } };
                          } else return false;
                          if ((query.behavior === 'perform') && (!query.perform)) return false;

                          return { message : { path      : '/api/v1/device/perform/' + e.deviceID
                                             , perform   : query.perform
                                             , parameter : query.parameter
                                             }
                                  , entity : e
                                 , perform : devices.perform
                                 };
                        }

           , group    : function() {
                         if (!!id) {
                            e = groups.id2group(id);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown groupID: ' + query.id } };
                          } else if (!!query.name) {
                            e = groups.name2group(query.name);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown group: ' + query.name } };
                          } else return false;
                          if (query.behavior === 'perform') {
                            if (!query.perform) return false;
                            if (e.groupType !== 'device') {
                              return { error: { permanent: true, diagnostic: 'invalid group: ' + query.name } };
                            }
                          }
                          if (query.behavior === 'report') return false;

                           return { message : { path      : '/api/v1/group/perform/' + e.groupID
                                             , perform   : query.perform
                                             , parameter : query.parameter
                                             }
                                 , perform  : groups.perform
                                 };
                        }

           , place    : function() {
                          var actor;

                          actor = steward.actors.place;
                          if (!actor) return { error: { permanent: false, diagnostic: 'internal error' } };
                          if (!!id) {
                            e = actor.$lookup(id);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown placeID: ' + query.id } };
                          } else if (!!query.name) {
                            e = places.name2place(query.name);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown place: ' + query.name } };
                          } else return false;
                          if ((query.behavior === 'perform') && (!query.perform)) return false;

// TBD: allow multiple places -- needed when we introduce /person/X
                          return { message : { path      : '/api/v1/actor/perform/place'
                                             , perform   : query.perform
                                             , parameter : query.parameter
                                             }
                                  , entity : e
                                 , perform : actors.perform
                                 };
                        }

           , task     : function() {
                         if (!!id) {
                            e = tasks.id2task(id);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown taskID: ' + query.id } };
                          } else if (!!query.name) {
                            e = tasks.name2task(query.name);
                            if (!e) return { error: { permanent: true, diagnostic: 'unknown task: ' + query.name } };
                          } else return false;
                          if (query.behavior === 'report') return false;

                          return { message : { path: '/api/v1/task/perform/' + e.taskID }
                                 , perform : tasks.perform
                                 };
                        }
           }[query.entity];

  if (!f) return { error: { permanent: true, diagnostic: 'invalid parameters' } };

  return f();
};

var report = function(query, entity) {
  var data, i, prop, properties, s;

  data = '';
  properties = (!!query.properties) ? query.properties.split(',') : [ 'status' ];
  for (i = 0, s = ''; i < properties.length; i++, s = ', ') {
    prop = properties[i];
    if (properties.length > 1) {
      if ((i + 1) === properties.length) s += 'and ';
      data += s + prop + ' is ';
    }
    if (prop === 'status') data += entity.status;
    else if (!entity.info[prop]) data += 'unknown';
    else {
      data += entity.info[prop];
    }
  }

  return data;
};


exports.process = function(request, response, tag) {
  var api, ct, data, f, message, o, query, ws;

  query = url.parse(request.url, true).query;
  ct = 'application/json';

  o = find(query);
  if (!!o.error) {
    data = o;
    logger.warning(tag, data);
  } else {
    message = o.message;

    f = { perform : function() {
                      requestID++;
                      message.requestID = query.requestID || requestID.toString();
                      api = { prefix: message.path.split('/').slice(0, 5).join('/') };
                      ws = { clientInfo : { loopback      : request.connection.remoteAddress === '127.0.0.1'
                                          , subnet        : true
                                          , local         : true
                                          , remoteAddress : request.connection.remoteAddress
                                          }
                           , send       : function(result) { data = result; }
                           };
                      o.perform(logger, ws, api, message, tag);
                    }

        , report  : function() {
                      ct = 'text/plain';
                      data = report(query, o.entity);
                    }
        }[query.behavior];
    if (!!f) f(); else data = { error: { permanent: true, diagnostic: 'invalid behavior: ' + query.behavior } };
  }

  if (typeof data !== 'string') data = JSON.stringify(data);
  logger.info(tag, { code: 200, type: ct, octets: data.length });
  response.writeHead(200, { 'Content-Type': ct, 'Content-Length': data.length });
  response.end(request.method === 'GET' ? data : '');

  return true;
};


exports.start = function() {};
