// twitter - Tweet http://dev.twitter.com

var twitter     = require('twit')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  ;


var logger = indicator.logger;


var Twitter = exports.Device = function(deviceID, deviceUID, info) {
  var self     = this
    ;

  self.growl = function(err, data, response) {/* jshint unused: false */
    var e;

    if (!!err) {
      if (typeof err === 'string') err = new Error(err);
// possible when restarting the steward...
      if (err.message === 'Status is a duplicate.') return;

      self.status = 'error';
      self.changed();
      logger.error('device/' + self.deviceID, { diagnostic: err.message });
      return;
    }

    if (self.status !== 'ready') {
      self.status = 'ready';
      self.changed();
    }

    logger.debug('device/' + self.deviceID, data);
  };

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = utility.clone(info);
  delete(self.info.id);
  delete(self.info.device);
  delete(self.info.deviceType);

  self.twitter = new twitter({ consumer_key        : self.info.consumerKey
                             , consumer_secret     : self.info.consumerSecret
                             , access_token        : self.info.token
                             , access_token_secret : self.info.tokenSecret
                             });
  self.previous = '';
  self.status = 'ready';
  self.elide = [ 'consumerKey', 'consumerSecret', 'token', 'tokenSecret' ];
  self.changed();


  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Twitter, indicator.Device);


Twitter.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) {
      self.setName(params.name);
      delete(params.name);
    }

    if (self.updateInfo(params)) self.setInfo();

    return true;
  }
  if (perform !== 'growl') return false;
  params.message = devices.expand(params.message, 'device/' + self.deviceID);

  if ((!params.message) || (params.message.length === 0)) return false;
  if (params.message.length > 140) params.message = params.message.substr(0, 137) + '...';

  if (params.message == self.previous) return steward.performed(false);
  self.previous = params.message;

  self.twitter.post('statuses/update', { status: self.previous }, self.growl);
  return steward.performed(taskID);
};

var validate_create = function(info) {
  var result = { invalid: [], requires: [] };

  if (!info.consumerKey) result.requires.push('consumerKey');
  else if ((typeof info.consumerKey !== 'string') || (info.consumerKey.length !== 25)) result.invalid.push('consumerKey');

  if (!info.consumerSecret) result.requires.push('consumerSecret');
  else if ((typeof info.consumerSecret !== 'string') || (info.consumerSecret.length !== 50)) {
    result.invalid.push('consumerSecret');
  }

  if (!info.token) result.requires.push('token');
  else if ((typeof info.token !== 'string') || (info.token.length <= 40)) result.invalid.push('token');

  if (!info.tokenSecret) result.requires.push('tokenSecret');
  else if ((typeof info.tokenSecret !== 'string') || (info.tokenSecret.length !== 45)) result.invalid.push('tokenSecret');

  return result;
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if (!params.consumerKey) params.consumerKey = 'XXXXXXXXXXXXXXXXXXXXXXXXX';
    if (!params.consumerSecret) params.consumerSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    if (!params.token) params.token = 'XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    if (!params.tokenSecret) params.tokenSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    return validate_create(params);
  }

  if (perform !== 'growl') {
    result.invalid.push('perform');
    return result;
  }

  if (!params.message) result.requires.push('message');
  else if (params.message.length === 0) result.invalid.push('message');

  return result;
};


exports.start = function() {
  steward.actors.device.indicator.twitter = steward.actors.device.indicator.twitter ||
      { $info     : { type: '/device/indicator/twitter' } };

  steward.actors.device.indicator.twitter.text =
      { $info     : { type       : '/device/indicator/twitter/text'
                    , observe    : [ ]
                    , perform    : [ 'growl' ]
                    , properties : { name           : true
                                   , status         : [ 'ready', 'error' ]
                                   , consumerKey    : true
                                   , consumerKSecret : true
                                   , token           : true
                                   , tokenKSecret    : true
                                   }
                    }
      , $validate : { create     : validate_create
                    , perform    : validate_perform
                    }
      };
  devices.makers['/device/indicator/twitter/text'] = Twitter;
};
