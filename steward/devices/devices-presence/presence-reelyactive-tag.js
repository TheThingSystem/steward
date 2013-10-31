// +++ under development
// reelyActive tags -- http://reelyactive.com/corporate/technology.htm


var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , presence    = require('./../device-presence')
  ;


// var logger = presence.logger;


var Tag = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'present';
  self.changed();
  self.info = { rankings: [] };

  self.events = {};
  self.rankings = [];
  self.rolling = 30;
  self.rolling2 = self.rolling * 2;
  self.tagID = info.params.tagID;

  utility.broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'observe') {
      if (observe === 'sequence') self.events[eventID] = { observe: observe, parameter: parameter };
      return;
    }
    if (request === 'perform') return devices.perform(self, eventID, observe, parameter);
  });

  setInterval(function() { self.update(self, null, new Date().getTime()); }, 10 * 1000);
};
util.inherits(Tag, presence.Device);


// TBD: multiple reels reporting the same tag...

Tag.prototype.update = function(self, v, timestamp) {
  var i, rankings, status;

  if (!!v) self.rankings.push({ reels: v, timestamp: timestamp });
  if (self.rankings.length > self.rolling2) self.rankings.splice(0, 1);

  timestamp -= self.rolling * 1000;
  for (i = self.rankings.length - 1; i >= 0; i--) if (self.rankings[i].timestamp < timestamp) break;
  if (i >= 0) self.rankings.splice(0, i + 1);

  if (self.rankings.length !== 0) {
    rankings = self.rankings[self.rankings.length - 1].reels;
    status = 'present';
  } else {
    rankings = [];
    status = 'absent';
  }

// +++ examine events here...

  if ((self.status === status) && (self.info.rankings.length === rankings.length)) {
    for (i = 0; i < rankings.length; i++) if (self.info.rankings[i] !== rankings[i]) break;
    if (i === rankings.length) return;
  }

  self.status = status;
  self.info.rankings = rankings;
  self.changed();
};

var validate_observe = function(observe, parameter) {/* jshint unused: false */

  var result = { invalid: [], requires: [] };

  if (observe.charAt(0) === '.') return result;

  if (observe !== 'sequence') {
    result.invalid.push('observe');
    return result;
  }

// +++ validate sequence expression here...

  return result;
};

exports.start = function() {
  steward.actors.device.presence.reelyactive = steward.actors.device.presence.reelyactive ||
      { $info     : { type: '/device/presence/reelyactive' } };

  steward.actors.device.presence.reelyactive.tag =
      { $info     : { type       : '/device/presence/reelyactive/tag'
                    , observe    : [ 'sequence' ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'present', 'absent', 'recent' ]
                                   , rankings : 'array'
                                   }
                    }
      , $validate : { observe    : validate_observe
                    , perform    : devices.validate_perform
                    }
      };
  devices.makers['/device/presence/reelyactive/tag'] = Tag;
};
