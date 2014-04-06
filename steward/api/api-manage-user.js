var fs          = require('fs')
  , fingerprint = require('ssh-fingerprint')
  , sqlite3     = require('sqlite3')
  , speakeasy   = require('speakeasy')
  , ssh_keygen  = require('ssh-keygen')
  , x509_keygen = require('x509-keygen').x509_keygen
  , server      = require('./../core/server')
  , steward     = require('./../core/steward')
  , manage      = require('./../routes/route-manage')
  , utility     = require('./../core/utility')
  ;


var places  = null;
var users   = {};
var clients = {};
var keys    = { x509: { key: '', crt: '' }, ssh: { key: '', pub: ''} };


var create = exports.create = function(logger, ws, api, message, tag, internalP) {
  var client, createP, data, issuer, options, name, pair, params, results, user, uuid;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'user creation', message.requestID, permanent, diagnostic);
  };

  if (!exports.db)                                          return error(false, 'database not ready');

  internalP = internalP || false;
  uuid = message.path.slice(api.prefix.length + 1);
  if (uuid.length === 0)                                    return error(true,  'missing uuid');
  if (!message.name)                                        return error(true,  'missing name element');
  if (!message.name.length)                                 return error(true,  'empty name element');
  name = message.name;

  if (uuid.indexOf('/') === -1) {
    user = null;

    if ((name.search(/\s/)      !== -1)
          || (name.indexOf('-') ===  0)
          || (name.indexOf('/') !== -1)
          || ((name.indexOf('.') !== -1) && ((!internalP) || (name.indexOf('.') !== 0)))
          || (name.indexOf(':') !== -1))            return error(true,  'invalid name element');

    if (!message.comments) message.comments = '';

    if (!message.role) message.role = 'resident';
    message.role = message.role.toLowerCase();
    if (!{ master   : true
         , resident : true
         , guest    : true
         , monitor  : true
         , device   : true
         , cloud    : true
         , none     : true }[message.role])                 return error(true,  'invalid role element');
    if (exports.count() === 0) message.role = 'master';

    if (!message.clientName) message.clientName = '';

    if (!!users[uuid])                                      return error(false, 'duplicate uuid', 'user/' + users[uuid].userID);
    if (!!name2user(name))                                  return error(false, 'duplicate name');
    users[uuid] = {};
  } else {
    pair = uuid.split('/');
    if (pair.length !== 2)                                  return error(true,  'invalid uuid');
    user = name2user(pair[0]);
    if (!user)                                              return error(false, 'invalid user in uuid');

    uuid = pair[1];
    if (uuid.length === 0)                                  return error(true,  'invalid uuid');

    if (!message.comments) message.comments = '';

    if (!!clients[uuid])                                    return error(false, 'duplicate uuid',
                                                                         'user/' + user.userName + '/' +clients[uuid].clientID);
    if (!!name2client(user, name))                          return error(false, 'duplicate name');
    clients[uuid] = {};
  }

  client = id2user(ws.clientInfo.userID);
  createP = ws.clientInfo.loopback
           || ((!!client) && (client.userRole === 'master'))
           || ((!!user) ? (user.userID === ws.clientInfo.userID) : (exports.count() === 0))
           || (internalP && ws.clientInfo.local);

  if (!createP) {
    params = utility.clone(ws.clientInfo);

    params.event = 'access';
    params.diagnostic = 'unauthorized';
    params.role = (!!client) ? client.userRole : '';
    params.resource = (!!user) ? ('user/' + user.userID) : '';
    params.internalP = internalP;
    logger.warning(tag, params);
                                                            return error(false, 'unauthorized');
  }

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }

  issuer = (!!server.vous) ? server.vous.split('.')[0] : 'steward';
  options = { length         : 40
            , random_bytes   : false
            , symbols        : false
            , google_auth_qr : true
            , name           : message.name + '@' + issuer
            , issuer         : issuer
            };
  data = speakeasy.generate_key(options);
  if (!internalP) results.result = { authenticatorURL: data.google_auth_qr, otpURL: data.url() };
  else {
    params = utility.clone(data.params);
    params.base32 = data.base32;
    params.protocol = 'totp';
    results.result = { params: params };
  }

  if (!!user) {
    results.result.user = user.userID;
    create2(logger, ws, user, results, tag, uuid, name, message.comments, data, internalP);

    return true;
  }

  exports.db.run('INSERT INTO users(userUID, userName, userComments, userRole, created) '
                 + 'VALUES($userUID, $userName, $userComments, $userRole, datetime("now"))',
                 { $userUID: uuid, $userName: message.name, $userComments: message.comments, $userRole: message.role },
                 function(err) {
    var userID;

    if (err) {
      delete(users[uuid]);
      logger.error(tag, { user: 'INSERT users.userUID for ' + uuid, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    userID = this.lastID.toString();

    results.result.user = userID;
    users[uuid] = { userID         : userID
                  , userUID        : uuid
                  , userName       : message.name
                  , userComments   : message.comments
                  , userRole       : message.role
                  , userLastLogin  : null
                  , clients        : []
                  };

    create2(logger, ws, users[uuid], results, tag, uuid, message.clientName, '', data, internalP);
  });

  return true;
};

var create2 = function(logger, ws, user, results, tag, uuid, clientName, clientComments, data, internalP) {
  var x;

  exports.db.run('INSERT INTO clients(clientUID, clientUserID, clientName, clientComments, clientAuthAlg, clientAuthParams, '
                 + 'clientAuthKey, created) '
                 + 'VALUES($clientUID, $clientUserID, $clientName, $clientComments, $clientAuthAlg, $clientAuthParams, '
                 + '$clientAuthKey, datetime("now"))',
                 { $clientUID: uuid, $clientUserID: user.userID, $clientName: clientName, $clientComments: clientComments,
                   $clientAuthAlg: 'otpauth://totp', $clientAuthParams: JSON.stringify(data.params),
                   $clientAuthKey: data.base32 }, function(err) {
    var clientID;

    if (err) {
      logger.error(tag, { user: 'INSERT clients.clientUID for ' + uuid, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    clientID = this.lastID.toString();

    data.params.name = '/user/' + user.userName + '/' + clientID;
    x = data.google_auth_qr.indexOf('otpauth://totp/');
    if (x > 0) {
      data.google_auth_qr = data.google_auth_qr.slice(0, x) + 'otpauth://totp/' + encodeURIComponent(data.params.name)
                            + '%3Fsecret=' + encodeURIComponent(data.base32);
    }
    exports.db.run('UPDATE clients SET clientAuthParams=$clientAuthParams WHERE clientID=$clientID',
                   { $clientID: clientID, $clientAuthParams: JSON.stringify(data.params) }, function(err) {
      if (err) return logger.error(tag, { event: 'UPDATE client.authParams for ' + clientID, diagnostic: err.message });

      results.result.client = clientID;
      if (!internalP) {
        results.result.authenticatorURL = data.google_auth_qr;
        results.result.otpURL = data.url();
      }
      clients[uuid] = { clientID         : clientID
                      , clientUID        : uuid
                      , clientUserID     : user.userID
                      , clientName       : clientName
                      , clientComments   : clientComments
                      , clientAuthAlg    : 'otpauth://totp'
                      , clientAuthParams : data.params
                      , clientAuthKey    : data.base32
                      , clientLastLogin  : null
                    };
      user.clients.push(clientID);

      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
    });
  });
};

var list = function(logger, ws, api, message, tag) {/* jshint unused: false */
  var allP, client, i, id, masterP, props, results, suffix, treeP, user, uuid, who;

  if (!exports.db) return manage.error(ws, tag, 'user listing', message.requestID, false, 'database not ready');

  allP = message.options.depth === 'all';
  treeP = allP || (message.options.depth === 'tree');
  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0) suffix = null;

  user = id2user(ws.clientInfo.userID);
  masterP = (!!user) && (user.userRole === 'master') && ws.clientInfo.secure;

  results = { requestID: message.requestID, result: { steward: {}, users: {} } };
  results.result.steward.uuid = steward.uuid;
  if (!places) places = require('./../actors/actor-place');
  if (places.place1.info.strict === 'off') results.result.steward.developer = true;

  if (treeP) results.result.users = {};
  if (allP) results.result.clients = {};
  for (uuid in users) {
    if (!users.hasOwnProperty(uuid)) continue;

    user = users[uuid];
    id = user.userID;
    if ((!suffix) || (suffix === id)) {
      props = proplist(null, user);
      if ((!ws.clientInfo.loopback) && (!ws.clientInfo.userID)) delete(props.role);
      results.result.users['user/' + user.userName] = props;

      if (treeP) results.result.users['user/' + user.userName].clients = user.clients;
      if ((!allP) || (!user.clients)) continue;

      for (i = 0; i < user.clients.length; i++) {
        client = id2client(user, user.clients[i]);
        who = 'user/' + user.userName + '/' + client.clientID;
        results.result.clients[who] = proplist2(null, client, user);
        if (!masterP) continue;

        results.result.clients[who].otpURL =
                       client.clientAuthAlg
                     + '/' + encodeURIComponent(client.clientAuthParams.issuer + ':' + client.clientAuthParams.name)
                     + '?secret=' + encodeURIComponent(client.clientAuthKey)
                     + '&issuer=' + encodeURIComponent(client.clientAuthParams.issuer)
                     + '&digits=' + encodeURIComponent(client.clientAuthParams.length);
        results.result.clients[who].authenticatorURL =
                       'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + client.clientAuthAlg
                      + '/' + encodeURIComponent(client.clientAuthParams.name)
                      + '%3Fsecret=' + encodeURIComponent(client.clientAuthKey);
      }
    }
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var authenticate = exports.authenticate = function(logger, ws, api, message, tag) {
  var client, clientID, date, i, meta, now, pair, params, results, stamp, user;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'user authentication', message.requestID, permanent, diagnostic);
  };

  if (!exports.db)                                          return error(false, 'database not ready');

  if ((!ws.clientInfo.local) && (!ws.clientInfo.secure))    return error(true,  'encryption required prior to authentication');

  clientID = message.path.slice(api.prefix.length + 1);
  if (clientID.length === 0)                                return error(true,  'missing clientID');
  pair = clientID.split('/');
  if (pair.length !== 2)                                    return error(true,  'invalid clientID element');
  user = name2user(pair[0]);

  if (!message.response)                                    return error(true,  'missing response element');
  if (message.response.length < 6)                          return error(true,  'invalid response element');

  if (!user)                                                return error(false, 'invalid clientID/response pair');
  client = id2client(user, pair[1]);
  if (!client)                                              return error(false, 'invalid clientID/response pair');
  if (client.clientAuthAlg !== 'otpauth://totp')            return error(true,  'internal error');

  results = { requestID: message.requestID };

// compare against previous, current, and next key to avoid worrying about clock synchornization...
  now = [ parseInt(Date.now() / 1000, 10) ];
  now.push(now[0] - 30);
  now.push(now[0] + 30);
  params = { key      : client.clientAuthKey
           , length   : message.response.length
           , encoding : 'base32'
           , step     : client.clientAuthParams.step
           };
  for (i = 0; i < now.length; i++) {
    params.time = now[i];
    if (speakeasy.totp(params) === message.response.toString()) break;
  }
  if (i >= now.length) results.error = { permanent: false, diagnostic: 'invalid clientID/response pair (check your clock)' };
  else {
    results.result = proplist(null, user);
    results.result.client = proplist2(null, client, user);
    results.result.client.clientID = clientID;

    ws.clientInfo.userID = user.userID;
    ws.clientInfo.clientID = clientID;

    meta = ws.clientInfo;
    meta.event = 'login';
    logger.notice(tag, meta);

    stamp = utility.clone(meta);
    stamp.tag = tag;
    stamp.timestamp = new Date();
    server.logins[tag] = stamp;

    now = new Date();
// http://stackoverflow.com/questions/5129624/convert-js-date-time-to-mysql-datetime
    date = now.getUTCFullYear()                         + '-'
           + ('00' + (now.getUTCMonth() + 1)).slice(-2) + '-'
           + ('00' + now.getUTCDate()).slice(-2)        + ' '
           + ('00' + now.getUTCHours()).slice(-2)       + ':'
           + ('00' + now.getUTCMinutes()).slice(-2)     + ':'
           + ('00' + now.getUTCSeconds()).slice(-2);
    exports.db.run('UPDATE users SET userLastLogin=$now WHERE userID=$userID',
                   { $userID: user.userID, $now: date }, function(err) {
      if (err) {
        logger.error(tag, { event: 'UPDATE user.lastLogin for ' + user.userID, diagnostic: err.message });
      } else {
        user.userLastLogin = now;
      }
    });
    exports.db.run('UPDATE clients SET clientLastLogin=$now WHERE clientID=$clientID',
                   { $clientID: client.clientID, $now: date }, function(err) {
      if (err) {
        logger.error(tag, { event: 'UPDATE client.lastLogin for ' + client.clientID, diagnostic: err.message });
      } else {
        client.clientLastLogin = now;
      }
    });
  }

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};

var prime = function(logger, ws, api, message, tag) {
  var client, clientID, pair, results, user;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'user authentication', message.requestID, permanent, diagnostic);
  };

  if (!exports.db)                                          return error(false, 'database not ready');

  clientID = message.path.slice(api.prefix.length + 1);
  if (clientID.length === 0)                                return error(true,  'missing clientID');
  pair = clientID.split('/');
  if (pair.length !== 2)                                    return error(true,  'invalid clientID element');
  user = name2user(pair[0]);

  if (!user)                                                return error(false, 'invalid clientID/response pair');
  client = id2client(user, pair[1]);
  if (!client)                                              return error(false, 'invalid clientID/response pair');

  if (!!message.fingerprint) {
    message.fingerprint = message.fingerprint.split(':').join('');
    if (message.fingerprint.search(/^[0-9a-f]{32}$/) !== 0) return error(true,  'invalid SSH fingerprint2');
  }

  results = { requestID: message.requestID };

  if (true) {
// NB: the same credentials when talking to all clients...

  if (!!message.fingerprint) {
    exports.db.run('UPDATE clients SET clientSSHPrint=$clientSSHPrint WHERE clientID=$clientID',
                   { $clientSSHPrint: message.fingerprint.replace(/(.{2})(?=.)/g, '$1:'), $clientID: client.clientID },
                   function(err) {
      if (err) logger.error(tag, { event: 'UPDATE client.clientSSHPrint for ' + client.clientID, diagnostic: err.message });
    });
  }

  results.result = { sni  : steward.uuid + '_' + user.userID + '-' + client.clientID
                   , ssh  : { fingerprint : fingerprint(keys.ssh.pub) }
                   , x509 : { certificate : keys.x509.crt }
                   };

  } else {
// TBD: when we have per-client credentials...

  ssh_keygen({ location : __dirname + '/../db/' + user.userID + '.' + client.clientID + '_rsa'
             , comment  : user.userName + '/' + client.clientID
             , password : ''
             , log      : logger
             , quiet    : false
             }, function(err, sshkey) {
    var sni;

    if (err) {
      logger.error(tag, { user: 'ssh_keygen', diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
      return;
    }

    sni = steward.uuid + '_' + user.userID + '-' + client.clientID;
    x509_keygen({ location : __dirname + '/../db/' + user.userID + '.' + client.clientID + '_rsa'
                , subject  : '/CN=' + sni
                , logger   : { info  : function(msg, props) {/* jshint unused: false */}
                             , error : function(msg, props) {/* jshint unused: false */}
                             }
                }, function(err, x509key) {
      var sshprint, stmt, vars;

      if (err) {
        logger.error(tag, { user: 'x509_keygen', diagnostic: err.message });
        results.error = { permanent: false, diagnostic: 'internal error' };
        try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
        return;
      }

      sshprint = fingerprint(sshkey.pubKey);
      stmt = 'UPDATE clients SET serverSNI=$serverSNI, serverX509Key=$serverX509Key, serverX509Cert=$serverX509Cert, '
             + 'serverSSHKey=$serverSSHKey, serverSSHPrint=$serverSSHPrint';
      vars = { $serverSNI      : sni
             , $serverX509Key  : x509key.key
             , $serverX509Cert : x509key.cert
             , $serverSSHKey   : sshkey.key
             , $serverSSHPrint : sshprint
             , $clientID: client.clientID
             };
      if (!!message.fingerprint) {
        stmt += ', clientSSHPrint=$clientSSHPrint ';
        vars.$clientSSHPrint = message.fingerprint.replace(/(.{2})(?=.)/g, '$1:');
      }
      stmt += 'WHERE clientID=$clientID';

      exports.db.run(stmt, vars, function(err) {
        if (err) logger.error(tag, { event: 'UPDATE client.prime for ' + client.clientID, diagnostic: err.message });
      });

      results.result = { sni  : sni
                       , ssh  : { fingerprint : sshprint }
                       , x509 : { certificate : x509key.cert }
                       };
      try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
    });
  });
}

  try { ws.send(JSON.stringify(results)); } catch(ex) { console.log(ex); }
  return true;
};


exports.count = function() {
  var n, uuid;

  n = 0;
  for (uuid in users) if (users.hasOwnProperty(uuid)) n++;

  return n;
};

var name2user = exports.name2user = function(name) {
  var uuid;

  if (!!name) for (uuid in users) if ((users.hasOwnProperty(uuid)) && (name === users[uuid].userName)) return users[uuid];
  return id2user(name);
};

var id2user = exports.id2user = function(id) {
  var uuid;

  if (!!id) for (uuid in users) if ((users.hasOwnProperty(uuid)) && (id === users[uuid].userID)) return users[uuid];
  return null;
};

var proplist = function(id, user) {
  var result = { uuid      : user.userUID
               , name      : user.userName
               , comments  : user.userComments
               , role      : user.userRole
               , lastLogin : user.userLastLogin && new Date(user.userLastLogin)
               };

  if (!!id) {
    result.whatami =  '/user';
    result.whoami = 'user/' + user.userName;
  }

  return result;
};

var name2client = function(user, name) {
  var client, i;

  if (!name) return null;

  for (i = 0; i < user.clients.length; i++) {
    client = id2client(user, user.clients[i]);
    if ((!!client) && (name === client.clientName)) return client;
  }

  return null;
};

var proplist2 = function(id, client, user) {
  var result = { uuid      : client.clientUID
               , name      : client.clientName
               , comments  : client.clientComments
               , lastLogin : client.clientLastLogin && new Date(client.clientLastLogin)
               };

  if (!!id) {
    result.whatami =  '/client';
    result.whoami = 'user/' + user.userName + '/' + id;
  }

  return result;
};

var id2client = function(user, id) {
  var i, uuid;

  if (!id) return null;

  for (uuid in clients) {
    if ((clients.hasOwnProperty(uuid)) && (id === clients[uuid].clientID)) {
      for (i = 0; i < user.clients.length; i++) if (id === user.clients[i]) return clients[uuid];

      break;
    }
  }

  return null;
};


exports.start = function() {
  var db;

  try {
    db = new sqlite3.Database(__dirname + '/../db/users.db');
  } catch(ex) {
    return steward.logger.emerg('database', { event: 'create ' + __dirname + '/../db/users.db', diagnostic: ex.message });
  }

  db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS users('
           + 'userID INTEGER PRIMARY KEY ASC, userUID TEXT, userName TEXT, userComments TEXT, userRole TEXT, '
           + 'userLastLogin CURRENT_TIMESTAMP, '
           + 'sortOrder INTEGER default "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t01 AFTER INSERT ON users BEGIN '
           + 'UPDATE users SET sortOrder=NEW.userID WHERE userID=NEW.userID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t02 AFTER UPDATE ON users BEGIN '
           + 'UPDATE users SET updated=datetime("now") WHERE userID=NEW.userID; '
           + 'END');

    db.run('CREATE TABLE IF NOT EXISTS clients('
           + 'clientID INTEGER PRIMARY KEY ASC, clientUID TEXT, clientUserID INTEGER DEFAULT "0", '
           + 'clientName TEXT, clientComments TEXT, '
           + 'clientAuthAlg TEXT, clientAuthParams TEXT, clientAuthKey TEXT, clientLastLogin CURRENT_TIMESTAMP, '
           + 'clientSSHPrint TEXT, '
           + 'serverSNI TEXT, serverX509Key TEXT, serverX509Cert TEXT, serverSSHKey TEXT, serverSSHPrint TEXT, '
           + 'sortOrder INTEGER default "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t01 AFTER INSERT ON clients BEGIN '
           + 'UPDATE clients SET sortOrder=NEW.clientID WHERE clientID=NEW.clientID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t02 AFTER UPDATE ON clients BEGIN '
           + 'UPDATE clients SET updated=datetime("now") WHERE clientID=NEW.clientID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t03 AFTER DELETE ON users BEGIN '
           + 'DELETE FROM clients WHERE clientUserID=OLD.userID; '
           + 'END');

    db.all('SELECT * FROM users ORDER BY sortOrder', function(err, rows) {
      if (err) return steward.logger.error('database', { event: 'SELECT users.*', diagnostic: err.message });

      rows.forEach(function(user) {
        var userUUID = user.userUID;

        users[userUUID] = { userID         : user.userID.toString()
                          , userUID        : userUUID
                          , userName       : user.userName
                          , userComments   : user.userComments
                          , userRole       : user.userRole
                          , userLastLogin  : user.userLastLogin && (new Date(user.userLastLogin))
                          , clients        : []
                          };

        db.all('SELECT * FROM clients WHERE clientUserID=$clientUserID ORDER BY sortOrder', { $clientUserID: user.userID },
               function(err, rows) {
          if (err) return steward.logger.error('database', { event: 'SELECT clients.*', diagnostic: err.message });

          rows.forEach(function(client) {
            var clientUUID = client.clientUID;

            clients[clientUUID] = { clientID         : client.clientID.toString()
                                  , clientUID        : clientUUID
                                  , clientUserID     : user.userID.toString()
                                  , clientName       : client.clientName
                                  , clientComments   : client.clientComments
                                  , clientAuthAlg    : client.clientAuthAlg
                                  , clientAuthParams : JSON.parse(client.clientAuthParams)
                                  , clientAuthKey    : client.clientAuthKey
                                  , clientLastLogin  : client.clientLastLogin && (new Date(client.clientLastLogin))
                                  , clientSSHPrint   : client.clientSSHPrint
                                  , serverSNI        : client.serverSNI
                                  , ServerX509Key    : client.ServerX509Key
                                  , ServerX509Cert   : client.ServerX509Cert
                                  , ServerSSHKey     : client.ServerSSHKey
                                  , ServerSSHPrint   : client.ServerSSHPrint
                                  };

            users[userUUID].clients.push(client.clientID.toString());
          });
        });
      });

      exports.db = db;
    });
  });

  fetch();

  manage.apis.push({ prefix   : '/api/v1/user/create'
                   , route    : create
                   , access   : manage.access.level.none    // does its own checking...
                   , required : { uuid       : true
                                , name       : true
                                }
                   , optional : { comments   : true
                                , role       : [ 'master', 'resident', 'guest', 'monitor', 'device', 'cloud' ]
                                , clientName : true
                                }
                   , response : {}
                   , comments : [ 'the uuid is specified as the create suffix, either USER or USER/CLIENT'
                                , 'the default role is "resident"'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/user/list'
                   , options  : { depth: 'flat' }
                   , route    : list
                   , access   : manage.access.level.read
                   , optional : { user       : 'id'
                                , depth      : [ 'flat', 'tree', 'all' ]
                                }
                   , response : {}
                   , comments : [ 'if present, the user is specified as the path suffix' ]
                   });
  manage.apis.push({ prefix   : '/api/v1/user/authenticate'
                   , route    : authenticate
                   , access   : manage.access.level.none
                   , required : { clientID : 'id'
                                , response : true
                                }
                   , response : {}
                   , comments : [ 'the clientID is specified as the path suffix, e.g., .../mrose/1'
                                ]
                   });
  manage.apis.push({ prefix   : '/api/v1/user/prime'
                   , route    : prime
                   , access   : manage.access.level.write
                   , required : { clientID : 'id'
                                }
                   , optional : { fingerprint : true
                                }
                   , response : {}
                   , comments : [ 'the clientID is specified as the path suffix, e.g., .../mrose/1'
                                ]
                   });
};


var fetch = function() {
  var x, y, zP;

  zP = false;
  for (x in keys) if (keys.hasOwnProperty(x)) for (y in keys[x]) if (keys[x].hasOwnProperty(y) && (keys[x][y].length === 0)) {
    if (!!server[x]) fs.exists(server[x][y], fetchf(x, y));
    zP = true;
  }

  if (zP) setTimeout(fetch, 1 * 1000);
};

var fetchf = function(x, y) {
  return function(exists) {
    if (!exists) return;

    fs.readFile(server[x][y], function(err, data) {
      if (err) return server.logger.error('server', { event: 'fs.readFile', file: server.x509.crt });
      keys[x][y] = data.toString();
    });
  };
};
