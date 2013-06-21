var sqlite3     = require('sqlite3')
  , speakeasy   = require('speakeasy')
  , steward     = require('./../core/steward')
  , manage      = require('./../routes/route-manage')
  ;



var users = {};


var create = function(logger, ws, api, message, tag) {
  var alg, data, options, results, uuid;

  var error = function(permanent, diagnostic) {
    return manage.error(ws, tag, 'user creation', message.requestID, permanent, diagnostic);
  };

  uuid = message.path.slice(api.prefix.length + 1);
  if (uuid.length === 0)                                    return error(true,  'missing uuid');

  if (!message.name)                                        return error(true,  'missing name element');
  if (!message.name.length)                                 return error(true,  'empty name element');
  if ((message.name.search(/\s/) !== -1)
        || (message.name.indexOf('-') === 0)
        || (message.name.indexOf('.') !== -1)
        || (message.name.indexOf(':') !== -1))              return error(true,  'invalid name element');


  if (!message.comments) message.comments = '';

  if (!!users[uuid])                                        return error(false, 'duplicate uuid');
  if (!!name2user[message.name])                            return error(false, 'duplicate name');
  users[uuid] = {};

  results = { requestID: message.requestID };
  try { ws.send(JSON.stringify(results)); } catch (ex) { console.log(ex); }

  alg = 'otpauth://totp';
  options = { length         : 40
            , random_bytes   : false
            , symbols        : false
            , google_auth_qr : true
            , name           : message.name + '@steward'
            , issuer         : 'steward'
            };
  data = speakeasy.generate_key(options);

  exports.db.run('INSERT INTO users(userUID, userName, userComments, userAuthAlg, userAuthParams, userAuthKey, created) '
                 + 'VALUES($userUID, $userName, $userComments, $userAuthAlg, $userAuthParams, $userAuthKey, datetime("now"))',
                 { $userUID: uuid, $userName: message.name, $userComments: message.comments, $userAuthAlg: alg,
                   $userAuthParams: JSON.stringify(data.params), $userAuthKey: data.base32 }, function(err) {
    var userID;

    if (err) {
      delete(users[uuid]);
      logger.error(tag, { user: 'INSERT users.userUID for ' + uuid, diagnostic: err.message });
      results.error = { permanent: false, diagnostic: 'internal error' };
      try { ws.send(JSON.stringify(results)); } catch (ex) { console.log(ex); }
      return;
    }

    userID = this.lastID.toString();

    results.result = { user             : userID 
                     , authenticatorURL : data.google_auth_qr
                     , otpURL           : data.url()
                     };
console.log(results.result);
    users[uuid] = { userID         : userID
                  , userUID        : uuid
                  , userName       : message.name
                  , userComments   : message.comments
                  , userAuthAlg    : alg
                  , userAuthParams : data.params
                  , userAuthKey    : data.base32
                  , lastTime       : null
                  };

    try { ws.send(JSON.stringify(results)); } catch (ex) { console.log(ex); }
  });

  return true;
};

var list = function(logger, ws, api, message, tag) {/* jshint unused: false */
  var allP, id, results, suffix, treeP, user, uuid;

  allP = message.options.depth === 'all';
  treeP = allP || (message.options.depth === 'tree');
  suffix = message.path.slice(api.prefix.length + 1);
  if (suffix.length === 0) suffix = null;

  results = { requestID: message.requestID, result: { users: {} } };
  if (allP) results.result.users = {};
  for (uuid in users) {
    if (!users.hasOwnProperty(uuid)) continue;

    user = users[uuid];
    id = user.userID;
    if ((!suffix) || (suffix === id)) {
      results.result.users['user/' + id] = proplist(null, user);
    }
  }

  try { ws.send(JSON.stringify(results)); } catch (ex) { console.log(ex); }
  return true;
};


var name2user = function(name) {
  var uuid;

  if (!!name) for (uuid in users) if ((users.hasOwnProperty(uuid)) && (name === users[uuid].userName)) return users[uuid];
  return null;
}

var authuser = function(user, otp) {
  if ((!!user) || (user.userAuthAlg !== 'otpauth://totp')) return null;

  return (otp === speakeasy.totp({ key: user.userAuthKey }));
}

var id2user = function(id) {
  var uuid;

  if (!!id) for (uuid in users) if ((users.hasOwnProperty(uuid)) && (id === users[uuid].userID)) return users[uuid];
  return null;
};

var proplist = function(id, user) {
  var result = { uuid     : user.userUID
               , name     : user.userName
               , comments : user.userComments
               , lastTime : user.lastTime && new Date(user.lastTime)
               };

  if (!!id) {
    result.whatami =  '/user';
    result.whoami = 'user/' + id;
  }

  return result;
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
           + 'userID INTEGER PRIMARY KEY ASC, userUID TEXT, userName TEXT, userComments TEXT, '
           + 'userAuthAlg TEXT, userAuthParams TEXT, userAuthKey TEXT, '
           + 'sortOrder INTEGER default "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t01 AFTER INSERT ON users BEGIN '
           + 'UPDATE users SET sortOrder=NEW.userID WHERE userID=NEW.userID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t02 AFTER UPDATE ON users BEGIN '
           + 'UPDATE users SET updated=datetime("now") WHERE userID=NEW.userID; '
           + 'END');

    db.all('SELECT * FROM users ORDER BY sortOrder', function(err, rows) {
      if (err) return steward.logger.error('database', { event: 'SELECT users.*', diagnostic: err.message });

      rows.forEach(function(user) {
        var userUUID = user.userUID;

        users[userUUID] = { userID         : user.userID.toString()
                          , userUID        : userUUID
                          , userName       : user.userName
                          , userComments   : user.userComments
                          , userAuthAlg    : user.userAuthAlg
                          , userAuthParams : user.userAuthParams
                          , userAuthKey    : user.userAuthKey
                          };
      });
    });

    exports.db = db;
  });

  manage.apis.push({ prefix  : '/api/v1/user/create'
                   , route   : create
                   , access  : manage.access.level.write
                   , required : { uuid       : true
                                , name       : true
                                }
                   , optional : { comments   : true
                                }
                   , response : {}
                   , comments : [ 'the uuid is specified as the create suffix'
                                ]
                   });
  manage.apis.push({ prefix  : '/api/v1/user/list'
                   , options : { depth: 'flat' }
                   , route   : list
                   , access  : manage.access.level.read
                   , optional : { user       : 'id'
                                , depth      : [ 'flat', 'tree', 'all' ]
                                }
                   , response : {}
                   , comments : [ 'if present, the user is specified as the path suffix' ]
                   });
};
