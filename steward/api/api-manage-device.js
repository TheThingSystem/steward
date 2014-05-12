var stringify  = require('json-stringify-safe')
  , actors     = require('./../core/steward').actors
  , clone      = require('./../core/utility').clone
  , database   = require('./../core/database')
  , devices    = require('./../core/device')
  , manage     = require('./../routes/route-manage')
  ;


var db;


var create = function(logger, ws, api, message, tag) {
  var actor, info, p, parts, v, uuid;

  var error = function(permanent, diagnostic, viz) {
    return manage.error(ws, tag, 'device creation', message.requestID, permanent, diagnostic, viz);
  };

  if (!readyP())                                            return error(false, 'database not ready');

  uuid = message.path.slice(api.prefix.length + 1);
  if (uuid.length === 0)                                    return error(true,  'missing uuid');

  if (!message.name)                                        return error(true,  'missing name element');
  if (!message.name.length)                                 return error(true,  'empty name element');

  if (!message.comments) message.comments = '';

  if (!message.whatami)                                     return error(true,  'missing whatami element');
  if (!message.whatami.length)                              return error(true,  'empty whatami element');
  parts = message.whatami.split('/');
  actor = actors;
  try { for (p = 1; p < parts.length; p++) actor = actor[parts[p]]; } catch(ex) { actor = null; }
  if (!actor)                                               return error(false, 'invalid device ' + message.whatami);

  if (!message.info) message.info = {};

  if ((!actor.$validate) || (!actor.$validate.create))      return error(false, 'device not creatable ' + message.whatami);
  v = actor.$validate.create(message.info);
  if ((v.invalid.length > 0) || (v.requires.length > 0))    return error(false, 'invalid parameters ' + stringify(v));

  info = clone(message.info);
  info.deviceType = message.whatami;
  info.id = message.whatami + '.' + uuid;
  info.device = { name: message.name };

  devices.discover(info, function(err, deviceID) {
    var results = { requestID: message.requestID };

    try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

    if (!!err)                                              return error(false, err.message);
    if (!deviceID)                                          return error(false, 'duplicate uuid',
                                                                         'device/' + devices.devices[info.id].device.deviceID);

    db.run('INSERT INTO deviceProps(deviceID, key, value) VALUES($deviceID, $key, $value)',
           { $deviceID: deviceID, $key: 'info', $value: JSON.stringify(info) });

    results.result = { device: deviceID };
    try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  });

  return true;
};

var list = function(logger, ws, api, message, tag) {/* jshint unused: false */
  var actor, allP, child, children, doneP, device, i, id, p, parts, props, results, suffix, treeP, type, uuid;

  allP = message.options.depth === 'all';
  treeP = allP || (message.options.depth === 'tree');
  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0) suffix = null;

  doneP = false;
  results = { requestID: message.requestID, result: { devices: {} } };
  if (allP) results.result.actors = {};
  for (uuid in devices.devices) {
    if (!devices.devices.hasOwnProperty(uuid)) continue;

    device = devices.devices[uuid];
    if (!device.device) continue;

    id = device.device.deviceID;
    if ((!suffix) || (suffix === id)) {
      props = clone(device.device.proplist());
      delete(props.whoami);
      results.result.devices['device/' + id] = props;
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

      if (suffix) {
        if (!treeP) break;
        doneP = true;
        suffix = null;
      } else if (!treeP) continue;
    }

    children = device.device.children();
    for (i = 0; i < children.length; i++) {
      child = children[i];
      id = child.deviceID;
      if ((!suffix) || (suffix === child.deviceID)) {
        props = child.proplist();
        delete(props.whoami);
        results.result.devices['device/' + id] = props;
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

        if (suffix) doneP = true;
      }
    }

    if (doneP) break;
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var perform = exports.perform = function(logger, ws, api, message, tag) {
  var actor, device, deviceID, p, parts, performed, results, v;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'device performance', message.requestID, permanent, diagnostic);
  };

  if (!readyP())                                            return error(false, 'database not ready');

  deviceID = message.path.slice(api.prefix.length + 1);
  if (deviceID.length === 0)                                return error(true,  'missing deviceID');

  if (!message.perform) logger.error(tag, message);
  if (!message.perform)                                     return error(true,  'missing perform element');
  if (!message.perform.length)                              return error(true,  'empty perform element');

  if (!message.parameter) message.parameter = '{}';

  actor = actors.device;
  if (!actor)                                               return error(false, 'internal error');
  device = actor.$lookup(deviceID);
  if (!device)                                              return error(false, 'unknown device ' + deviceID);

  parts = device.whatami.split('/');
  actor = actors;
  try { for (p = 1; p < parts.length; p++) actor = actor[parts[p]]; } catch(ex) { actor = null; }
  if (!actor)                                               return error(false, 'invalid device ' + device.whatami);

  p = message.parameter;
  if ((!!actor.$validate) && (!!actor.$validate.perform)) {
    v = actor.$validate.perform(message.perform, p);
    if ((v.invalid.length > 0) || (v.requires.length > 0))  return error(false, 'invalid parameters ' + stringify(v));
  }

  results = { requestID: message.requestID };

  if (!!device.perform) logger.debug('device/' + device.deviceID, { api: 'device', perform: message.perform, parameter: p });
  performed = (!!device.perform) ? (device.perform)(device, null, message.perform, p) : false;
  results.result = { status: performed ? 'success' : 'failure' };

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};


exports.name2device = function(name) {
  var actor, device, i, results;

  if (!name) return null;
  name = name.toLowerCase();

  actor = actors.device;
  if (!actor) return;

  results = actor.$list();
  for (i = 0; i < results.length; i++) {
    device = actor.$lookup(results[i]);
    if ((!!device) && (device.name.toLowerCase() === name)) return device;
  }

  return null;
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

  db.all('SELECT devices.deviceID, devices.deviceUID, deviceProps.value FROM devices '
         + 'LEFT JOIN deviceProps '
         + 'WHERE devices.deviceID>0 AND devices.deviceID=deviceProps.deviceID AND deviceProps.key="info"',
         function(err, rows) {
    if (err) {
      logger.error('devices', { event: 'SELECT devices.deviceUID, deviceProps.value', diagnostic: err.message });
      loadedP = false;
      return;
    }
    rows.forEach(function(row) {
      try { devices.discover(JSON.parse(row.value)); } catch(ex) {
        logger.error('device/' + row.deviceID, { event: 'JSON.parse', data: row.value, diagnostic: ex.message });
      }
    });

    loadedP = true;
  });

  return false;
};


exports.start = function() {
  readyP();

  manage.apis.push({ prefix   : '/api/v1/device/create'
                   , route    : create
                   , access   : manage.access.level.write
                   , required : { uuid       : true
                                , name       : true
                                , whatami    : 'prototype-name'
                                , info       : 'property-list'
                                }
                   , optional : { comments   : true
                                }
                   , response : {}
                   , comments : [ 'the uuid is specified as the create suffix'
                                , 'the prototype-name must refer to a creatable device'
                                , 'the property-list must be valid for the device'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/device/list'
                   , options  : { depth: 'flat' }
                   , route    : list
                   , access   : manage.access.level.read
                   , optional : { device     : 'id'
                                , depth      : [ 'flat', 'tree', 'all' ]
                                }
                   , response : {}
                   , comments : [ 'if present, the device is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/device/perform'
                   , route    : perform
                   , access   : manage.access.level.perform
                   , required : { deviceID   : 'id'
                                , perform    : true
                                }
                   , optional : { parameter  : true
                                }
                   , response : {}
                   , comments : [ 'the deviceID is specified as the path suffix'
                                , 'the perform/parameter pair must be valid for the device'
                                ]
                   });
};
