/*  GET /oneshot
                ?behavior = perform | report

                &entity   = activity    & ( name=... | id=... )
                &entity   = actor       & prefix=...
                &entity   = device      & ( name=... | id=... )
                &entity   = group       & ( name=... | id=... )
                &entity   = place       & ( name=... | id=... )
                &entity   = task        & ( name=... | id=... )

    for perform behavior:
      - actors, devices, device groups, and places: & perform=... [ & parameter=... ]
      - group must be a 'device' or a 'task' group

    for report behavior:
      - only actors, devices, and places allowed
 */

var querystring = require('querystring')
  , url         = require('url')
  , device      = require('./../core/device')
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

var find = function(query, tag) {
  var e, g, id, x;

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
                          var api, d, entity, entities, message, prefix, proplists, results, ws;

                          if ((!query.prefix) || ((query.behavior === 'perform') && (!query.perform))) return false;

                          prefix = query.prefix;
                          if (prefix.indexOf('/') === 0) prefix = prefix.substring(1);
                          if (query.behavior === 'report') {
                            requestID++;
                            message = { requestID : requestID.toString()
                                      , path      : '/api/v1/actor/list/' + prefix
                                      , options   : { depth: 'all' }
                                      };
                            api = { prefix: '/api/v1/actor/list' };
                            ws = { send: function(result) { try { results = JSON.parse(result); } catch(ex) {} } };
                            results = {};
                            actors.list(logger, ws, api, message, tag);

                            proplists = [];
                            for (d in results.result) {
                              if (!results.result.hasOwnProperty(d)) continue;
                              if ((d.indexOf('/device') !== 0) && (d.indexOf('/place') !== 0)) continue;

                              entities = results.result[d];
                              for (entity in entities) if (entities.hasOwnProperty(entity)) proplists.push(entities[entity]);
                            }
                          }
                          return { message   : { path      : '/api/v1/actor/perform/' + prefix
                                               , perform   : query.perform
                                               , parameter : query.parameter
                                               }
                                 , perform   : actors.perform
                                 , proplists : proplists
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

                          return { message  : { path      : '/api/v1/device/perform/' + e.deviceID
                                              , perform   : query.perform
                                              , parameter : query.parameter
                                              }
                                 , perform  : devices.perform
                                 , proplist : e.proplist()
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
                            if (e.groupType === 'task') {
                            } else if (e.groupType !== 'device') {
                              return { error: { permanent: true, diagnostic: 'invalid group: ' + query.name } };
                            } else if (!query.perform) return false;
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
                          return { message  : { path      : '/api/v1/actor/perform/place'
                                              , perform   : query.perform
                                              , parameter : query.parameter
                                              }
                                 , perform  : actors.perform
                                 , proplist : e.proplist()
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

  if (!!f) g = f();

  return (g || { error: { permanent: true, diagnostic: 'invalid parameters' } });
};

var report = function(query, proplist) {
  var data, i, metricP, parts, prop, properties, s, v;

  data = '';
  properties = (!!query.properties) ? query.properties.split(',') : [ 'status' ];
  for (i = 0, s = ''; i < properties.length; i++, s = ', ') {
    prop = properties[i];

    v = device.expand('.[.' + prop + '].', proplist);
    if (!v) continue;

    parts = prop.split('.');
    prop = parts[parts.length - 1];

    if (properties.length > 1) {
      if ((i + 1) === properties.length) s += 'and ';
// heh
      data += s + ({ co       : 'carbon monoxide'
                   , co2      : 'C O 2'
                   , no       : 'nitrous oxide'
                   , no2      : 'N O 2'
                   , voc      : 'volatile organic compounds'
                   }[prop] || prop) + ' is ';
    }
// TBD: this is really a UI thing, but it is rather convenient to place here...
    metricP = places.place1.info.displayUnits === 'metric';
    v = places.customary(prop, v, false);
    data += v;
    if (!isNaN(v)) {
      data += { accuracy        : metricP ? ' meters' : ' feet'
              , batteryLevel    : ' percent'
              , co              : ' parts per million'
              , co2             : ' parts per million'
              , distance        : metricP ? ' kilometers' : ' miles'
              , extTemperature  : ' degrees'
              , goalTemperature : ' degrees'
              , heading         : ' degrees'
              , humidity        : ' percent'
              , intTemperature  : ' degrees'
              , light           : ' luminous flux'
              , moisture        : ' milli bars'
              , no              : ' parts per million'
              , no2             : ' parts per million'
              , noise           : ' decibels'
              , odometer        : metricP ? ' kilometers' : ' miles'
              , pressure        : ' milli bars'
              , rainRate        : metricP ? ' millimeters per hour' : ' inches per hour'
              , rainTotal       : metricP ? ' millimeters' : ' inches'
              , range           : metricP ? ' kilometers' : ' miles'
              , temperature     : ' degrees'
              , velocity        : metricP ? ' meters per second' : ' miles per hour'
              , visibility      : metricP ? ' kilometers' : ' miles'
              , voc             : ' parts per million'
              , waterVolume     : ' percent'
              , windAverage     : metricP ? ' meters per second' : ' miles per hour'
              , windchill       : ' degrees'
              , windGust        : metricP ? ' meters per second' : ' miles per hour'
              }[prop] || '';
    }
  }

  return data.replace('[object Object]', 'complicated');
};


exports.process = function(request, response, tag) {
  var data;

  if (request.method === 'GET') return oneshot(request, response, url.parse(request.url, true).query, tag);
  if (request.method !== 'POST') {
    logger.info(tag, { event: 'invalid method', code: 405, method: request.method });
    response.writeHead(405, { Allow: 'GET, POST' });
    response.end();

    return true;
  }

  request.setEncoding('utf8');

  data = '';
  request.on('data', function(chunk) {
    data += chunk.toString();
  }).on('end', function() {
    oneshot(request, response, querystring.parse(data), tag);
  });

  return true;
};

var oneshot = function(request, response, query, tag) {
  var api, ct, data, f, message, o, ws;

  ct = 'application/json';

  o = find(query, tag);
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
                      var proplist, i, s;

                      ct = 'text/plain';
                      if (!!o.proplist) data = report(query, o.proplist);
                      else if (o.proplists.length === 0) data = 'nothing to report';
                      else if (o.proplists.length === 1) data = report(query, o.proplists[0]);
                      else {
                        data = '';
                        for (i = 0, s = 'report for '; i < o.proplists.length; i++, s = '; report for ') {
                          proplist = o.proplists[i];
                          data += s + proplist.name + ': ' + report(query, proplist);
                        }
                      }

                      if (data.length === 0) data = 'no information is available';
                    }
        }[query.behavior];
    if (!!f) f(); else data = { error: { permanent: true, diagnostic: 'invalid behavior: ' + query.behavior } };
  }

  if (typeof data !== 'string') data = JSON.stringify(data);
  logger.info(tag, { code: 200, type: ct, octets: data.length });
  response.writeHead(200, { 'Content-Type': ct, 'Content-Length': data.length });
  response.end(data);

  return true;
};


exports.start = function() {};
