/* GET /oneshot
               ?entity=activity &name='...'
               ?entity=actor    &prefix='...' &perform='...' &parameter='...'
               ?entity=group    &name='...'   &perform='...' &parameter='...'  (must be a 'device' group)
               ?entity=task     &name='...'

   parameter is optional
 */

var url         = require('url')
  , utility     = require('./../core/utility')
  , activities  = require('./../api/api-manage-activity')
  , actors      = require('./../api/api-manage-actor')
  , groups      = require('./../api/api-manage-group')
  , tasks       = require('./../api/api-manage-task')
  ;

var logger = utility.logger('server');

var requestID = 1;

exports.process = function(request, response, tag) {
  var api, data, e, f, g, json, message, prefix, u, ws;

  u = url.parse(request.url, true);

  requestID++;
  message = { requestID: u.query.requestID || requestID.toString() };
  f = { activity : function() {
                     if (!u.query.name) return false;
                     e = activities.name2activity(u.query.name);
                     if (!e) {
                       data = { error: { permanent: true, diagnostic: 'unknown activity: ' + u.query.name } };
                       return true;
                     }
                     g = activities.perform;
                     return '/api/v1/activity/perform/' + e.activityID;
                   }

      , actor    : function() {
                     if ((!u.query.prefix) || (!u.query.perform)) return false;
                     g = actors.perform;
                     message.perform = u.query.perform;
                     message.parameter = u.query.parameter;
                     prefix = u.query.prefix;
                     if (prefix.indexOf('/') === 0) prefix = prefix.substring(1);
                     return '/api/v1/actor/perform/' + prefix;
                   }

      , group    : function() {
                     if ((!u.query.name) || (!u.query.perform)) return false;
                     e = groups.name2group(u.query.name);
                     if (!e) {
                       data = { error: { permanent: true, diagnostic: 'unknown group: ' + u.query.name } };
                       return true;
                     }
                     if (e.groupType !== 'device') {
                       data = { error: { permanent: true, diagnostic: 'invalid group: ' + u.query.name } };
                       return true;
                     }
                     message.perform = u.query.perform;
                     message.parameter = u.query.parameter;
                     g = groups.perform;
                     return '/api/v1/group/perform/' + e.groupID;
                   }

      , task     : function() {
                     if (!u.query.name) return false;
                     e = tasks.name2task(u.query.name);
                     if (!e) {
                       data = { error: { permanent: true, diagnostic: 'unknown task: ' + u.query.name } };
                       return true;
                     }
                     g = tasks.perform;
                     return '/api/v1/task/perform/' + e.taskID;
                   }
      }[u.query.entity];
  message.path = f && f();
  if (!message.path) {
    logger.warning(tag, { event: 'invalid parameters', parameters: u.query });
    return false;
  }
  if (!!data) logger.warning(tag, data);
  else {
    api = { prefix: message.path.split('/').slice(0, 5).join('/') };
    ws = { clientInfo : { loopback      : request.connection.remoteAddress === '127.0.0.1'
                        , subnet        : true
                        , local         : true
                        , remoteAddress : request.connection.remoteAddress
                        }
         , send       : function(result) { try { data = JSON.parse(result); } catch(ex) { data = ''; } }
         };
    g(logger, ws, api, message, tag);
  }

  json = JSON.stringify(data);
  logger.info(tag, { code: 200, type: 'application/json', octets: json.length });
  response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': json.length });
  response.end(request.method === 'GET' ? json : '');

  return true;
};


exports.start = function() {};
