var sqlite3     = require('sqlite3')
  , utility     = require('./utility')
  ;


var logger   = utility.logger('steward');


exports.start = function() {
  var db;

  try {
    db = new sqlite3.Database(__dirname + '/../db/database.db');
  } catch(ex) {
    return logger.emerg('database', { event: 'create ' + __dirname + '/../db/database.db', diagnostic: ex.message });
  }

  db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS devices('
           + 'deviceID INTEGER PRIMARY KEY ASC, deviceUID TEXT, deviceType TEXT, parentID INTEGER, childID INTEGER, '
           + 'deviceName TEXT, deviceIkon TEXT, deviceIP TEXT, deviceMAC TEXT, '
           + 'sortOrder INTEGER default "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t01 AFTER INSERT ON devices BEGIN '
           + 'UPDATE devices SET sortOrder=NEW.deviceID WHERE deviceID=NEW.deviceID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t02 AFTER UPDATE ON devices BEGIN '
           + 'UPDATE devices SET updated=datetime("now") WHERE deviceID=NEW.deviceID; '
           + 'END');

    db.run('CREATE TABLE IF NOT EXISTS deviceProps(x INTEGER PRIMARY KEY ASC, deviceID INTEGER, key TEXT, value TEXT)');
    db.run('CREATE TRIGGER IF NOT EXISTS t03 AFTER DELETE ON devices BEGIN '
           + 'DELETE FROM deviceProps WHERE deviceID=OLD.deviceID; '
           + 'END');

    db.run('CREATE TABLE IF NOT EXISTS groups('
           + 'groupID INTEGER PRIMARY KEY ASC, groupUID TEXT, parentID INTEGER DEFAULT "0", '
           + 'groupName TEXT, groupComments TEXT DEFAULT "", groupType TEXT, groupOperator INTEGER DEFAULT "0", '
           + 'sortOrder INTEGER DEFAULT "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t04 AFTER INSERT ON groups BEGIN '
           + 'UPDATE groups SET sortOrder=NEW.groupID WHERE groupID=NEW.groupID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t05 AFTER UPDATE ON groups BEGIN '
           + 'UPDATE groups SET updated=datetime("now") WHERE groupID=NEW.groupID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t06 AFTER DELETE ON groups BEGIN '
           + 'DELETE FROM groups WHERE parentID=OLD.groupID; '
           + 'END');

    db.run('CREATE TABLE IF NOT EXISTS members(memberID INTEGER PRIMARY KEY ASC, groupID INTEGER, '
           + 'actorType TEXT, actorID INTEGER, '
           + 'sortOrder INTEGER DEFAULT "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t07 AFTER INSERT ON members BEGIN '
           + 'UPDATE members SET sortOrder=NEW.memberID WHERE memberID=NEW.memberID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t08 AFTER UPDATE ON members BEGIN '
           + 'UPDATE members SET updated=datetime("now") WHERE memberID=NEW.memberID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t09 AFTER DELETE ON groups BEGIN '
           + 'DELETE FROM members WHERE groupID=OLD.groupID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t10 AFTER DELETE ON devices BEGIN '
           + 'DELETE FROM members WHERE actorType="device" AND actorID=OLD.deviceID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t11 AFTER DELETE ON groups BEGIN '
           + 'DELETE FROM members WHERE actorType="group" AND actorID=OLD.groupID; '
           + 'END');

    db.run('CREATE TABLE IF NOT EXISTS events(eventID INTEGER PRIMARY KEY ASC, eventUID TEXT, '
           + 'eventName TEXT, eventComments TEXT DEFAULT "", '
           + 'actorType TEXT, actorID INTEGER, observe TEXT, parameter TEXT DEFAULT "", '
           + 'sortOrder INTEGER DEFAULT "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t12 AFTER INSERT ON events BEGIN '
           + 'UPDATE events SET sortOrder=NEW.eventID WHERE eventID=NEW.eventID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t13 AFTER UPDATE ON events BEGIN '
           + 'UPDATE events SET updated=datetime("now") WHERE eventID=NEW.eventID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t14 AFTER DELETE ON devices BEGIN '
           + 'DELETE FROM events WHERE actorType="device" AND actorID=OLD.deviceID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t15 AFTER DELETE ON groups BEGIN '
           + 'DELETE FROM events WHERE actorType="group" AND actorID=OLD.groupID; '
           + 'END');

    db.run('CREATE TABLE IF NOT EXISTS tasks(taskID INTEGER PRIMARY KEY ASC, taskUID TEXT, '
           + 'taskName TEXT, taskComments TEXT DEFAULT "", '
           + 'actorType TEXT, actorID INTEGER, perform TEXT, parameter TEXT DEFAULT "", '
           + 'guardType TEXT DEFAULT "", guardID INTEGER, '
           + 'sortOrder INTEGER DEFAULT "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t16 AFTER INSERT ON tasks BEGIN '
           + 'UPDATE tasks SET sortOrder=NEW.taskID WHERE taskID=NEW.taskID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t17 AFTER UPDATE ON tasks BEGIN '
           + 'UPDATE tasks SET updated=datetime("now") WHERE taskID=NEW.taskID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t18 AFTER DELETE ON devices BEGIN '
           + 'DELETE FROM tasks WHERE actorType="device" AND actorID=OLD.deviceID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t19 AFTER DELETE ON groups BEGIN '
           + 'DELETE FROM tasks WHERE actorType="group" AND actorID=OLD.groupID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t20 AFTER DELETE ON groups BEGIN '
           + 'UPDATE tasks SET guardType="" WHERE guardType="group" AND guardID=OLD.groupID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t21 AFTER DELETE ON events BEGIN '
           + 'UPDATE tasks SET guardType="" WHERE guardType="event" AND guardID=OLD.eventID; '
           + 'END');

    db.run('CREATE TABLE IF NOT EXISTS activities(activityID INTEGER PRIMARY KEY ASC, activityUID TEXT, '
           + 'activityName TEXT, activityComments TEXT DEFAULT "", armed INTEGER DEFAULT "0", '
           + 'eventType TEXT, eventID INTEGER, taskType TEXT, taskID INTEGER, '
           + 'sortOrder INTEGER DEFAULT "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')');
    db.run('CREATE TRIGGER IF NOT EXISTS t22 AFTER INSERT ON activities BEGIN '
           + 'UPDATE activities SET sortOrder=NEW.activityID WHERE activityID=NEW.activityID AND sortOrder=0; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t23 AFTER UPDATE ON activities BEGIN '
           + 'UPDATE activities SET updated=datetime("now") WHERE activityID=NEW.activityID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t24 AFTER DELETE ON events BEGIN '
           + 'DELETE FROM activities WHERE eventType="event" AND eventID=OLD.eventID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t25 AFTER DELETE ON tasks BEGIN '
           + 'DELETE FROM activities WHERE taskType="task" AND taskID=OLD.taskID; '
           + 'END');
    db.run('CREATE TRIGGER IF NOT EXISTS t26 AFTER DELETE ON groups BEGIN '
           + 'DELETE FROM activities WHERE eventType="group" AND eventID=OLD.groupID; '
           + 'DELETE FROM activities WHERE taskType="group"  AND taskID=OLD.groupID; '
           + 'END');

    db.run('CREATE TABLE IF NOT EXISTS things(thingID INTEGER PRIMARY KEY ASC, thingUID TEXT, '
           + 'thingName TEXT, thingComments TEXT DEFAULT "", thingDefinition TEXT, '
           + 'sortOrder INTEGER DEFAULT "0", '
           + 'created CURRENT_TIMESTAMP, updated CURRENT_TIMESTAMP'
           + ')', function(err) {
      if (err) return logger.error('database', { event: 'database initialization', diagnostic: err.message });

      db.all('PRAGMA table_info(devices)', function(err, rows) {
        var ikonP;

        if (err) return logger.error('database', { event: 'PRAGMA table_info(devices)', diagnostic: err.message });

        ikonP = false;
        rows.forEach(function(row) {
          if (row.name === 'deviceIkon') ikonP = true;
        });
        if (!ikonP) db.run('ALTER TABLE devices ADD COLUMN deviceIkon TEXT');
      });

      exports.db = db;
      require('./device').start();
    });
  });
};
