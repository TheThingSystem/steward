var reqno = 101;
var callbacks = {};

var add_callback = function(cb) {
  callbacks[reqno.toString()] = cb;

  return reqno++;
};

var create_activity = function(ws, name, armed, event, task, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/activity/create/' + name
                         , requestID : add_callback(cb)
                         , name      : name
                         , armed     : armed
                         , event     : event
                         , task      : task
                         }));
};

var create_device = function(ws, name, whatami, info, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/device/create/' + name
                         , requestID : add_callback(cb)
                         , name      : name
                         , whatami   : whatami
                         , info      : info || {}
                         }));
};

var create_event = function(ws, name, actor, observe, parameter, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/event/create/' + name
                         , requestID : add_callback(cb)
                         , name      : name
                         , actor     : actor
                         , observe   : observe
                         , parameter : JSON.stringify(parameter) || ''
                         }));
};

var create_group = function(ws, name, type, operator, members, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/group/create/' + name
                         , requestID : add_callback(cb)
                         , name      : name
                         , type      : type     || ''
                         , operator  : operator || ''
                         , members   : members  || []
                         }));
};

var create_task = function(ws, name, actor, perform, parameter, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/task/create/' + name
                         , requestID : add_callback(cb)
                         , name      : name
                         , actor     : actor
                         , perform   : perform
                         , parameter : JSON.stringify(parameter) || ''
                         }));
};

var list_activity = function(ws, activityID, options, cb) {
  if ((activityID !== '') && (parseInt(activityID, 10) <= 0)) throw new Error('activityID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/activity/list/' + activityID
                         , requestID : add_callback(cb)
                         , options   : options || {}
                         }));
};

var list_actors = function(ws, prefix, options, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/actor/list/' + prefix
                         , requestID : add_callback(cb)
                         , options   : options || {}
                         }));
};

var list_device = function(ws, deviceID, options, cb) {
  if ((deviceID !== '') && (parseInt(deviceID, 10) <= 0)) throw new Error('deviceID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/device/list/' + deviceID
                         , requestID : add_callback(cb)
                         , options   : options || {}
                         }));
};

var list_event = function(ws, eventID, options, cb) {
  if ((eventID !== '') && (parseInt(eventID, 10) <= 0)) throw new Error('eventID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/event/list/' + eventID
                         , requestID : add_callback(cb)
                         , options   : options || {}
                         }));
};

var list_group = function(ws, groupID, options, cb) {
  if ((groupID !== '') && (parseInt(groupID, 10) <= 0)) throw new Error('groupID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/group/list/' + groupID
                         , requestID : add_callback(cb)
                         , options   : options || {}
                         }));
};

var list_task = function(ws, taskID, options, cb) {
  if ((taskID !== '') && (parseInt(taskID, 10) <= 0)) throw new Error('taskID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/task/list/' + taskID
                         , requestID : add_callback(cb)
                         , options   : options || {}
                         }));
};

var list_users = function(ws, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/user/list/'
                         , requestID : add_callback(cb)
                         , options   : { depth: 'all' }
                         }));
};

var modify_activity = function(ws, activityID, name, armed, event, task, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/activity/modify/' + activityID
                         , requestID : add_callback(cb)
                         , name      : name
                         , armed     : armed
                         , event     : event
                         , task      : task
                         }));
};

var modify_group = function(ws, groupID, name, type, operator, members, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/group/modify/' + groupID
                         , requestID : add_callback(cb)
                         , name      : name
                         , type      : type     || ''
                         , operator  : operator || ''
                         , members   : members  || []
                         }));
};

var perform_activity = function(ws, activityID, cb) {
  if (parseInt(activityID, 10) <= 0) throw new Error('activityID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/activity/perform/' + activityID
                         , requestID : add_callback(cb)
                         }));
};

var perform_actors = function(ws, prefix, perform, parameter, cb) {
  ws.send(JSON.stringify({ path      : '/api/v1/actor/perform/' + prefix
                         , requestID : add_callback(cb)
                         , perform   : perform
                         , parameter : JSON.stringify(parameter) || ''
                         }));
};

var perform_device = function(ws, deviceID, perform, parameter, cb) {
  if (parseInt(deviceID, 10) <= 0) throw new Error('deviceID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/device/perform/' + deviceID
                         , requestID : add_callback(cb)
                         , perform   : perform
                         , parameter : JSON.stringify(parameter) || ''
                         }));
};

var perform_group = function(ws, groupID, perform, parameter, cb) {
  if (parseInt(groupID, 10) <= 0) throw new Error('groupID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/group/perform/' + groupID
                         , requestID : add_callback(cb)
                         , perform   : perform
                         , parameter : JSON.stringify(parameter) || ''
                         }));
};

var perform_task = function(ws, taskID, cb) {
  if (parseInt(taskID, 10) <= 0) throw new Error('taskID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/task/perform/' + taskID
                         , requestID : add_callback(cb)
                         }));
};

var delete_activity = function(ws, activityID, cb) {
  if (parseInt(activityID, 10) <= 0) throw new Error('activityID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/activity/delete/' + activityID
                         , requestID : add_callback(cb)
                         }));
};

var delete_device = function(ws, deviceID, cb) {
  if (parseInt(deviceID, 10) <= 0) throw new Error('deviceID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/device/delete/' + deviceID
                         , requestID : add_callback(cb)
                         }));
};

var delete_event = function(ws, eventID, cb) {
  if (parseInt(eventID, 10) <= 0) throw new Error('eventID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/event/delete/' + eventID
                         , requestID : add_callback(cb)
                         }));
};

var delete_group = function(ws, groupID, cb) {
  if (parseInt(groupID, 10) <= 0) throw new Error('groupID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/group/delete/' + groupID
                         , requestID : add_callback(cb)
                         }));
};

var delete_task = function(ws, taskID, cb) {
  if (parseInt(taskID, 10) <= 0) throw new Error('taskID must be positive integer');

  ws.send(JSON.stringify({ path      : '/api/v1/task/delete/' + taskID
                         , requestID : add_callback(cb)
                         }));
};
