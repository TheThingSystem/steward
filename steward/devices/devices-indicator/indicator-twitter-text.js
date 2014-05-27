// twitter - Tweet http://dev.twitter.com

var http        = require('http')
  , twitter     = require('twit')
  , url         = require('url')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , indicator   = require('./../device-indicator')
  , places      = require('./../../actors/actor-place')
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


Twitter.operations =
{ set    : function(self, params) {
             if (!!params.name) {
               self.setName(params.name);
               delete(params.name);
             }
             if (self.updateInfo(params)) self.setInfo();
           }

, growl  : function(self, params) {
             var post;

             params.message = devices.expand(params.message, 'device/' + self.deviceID);

             if ((!params.message) || (params.message.length === 0)) return false;
             if (params.message.length > 140) params.message = params.message.substr(0, 137) + '...';

             if (params.message == self.previous) return steward.performed(false);
             self.previous = params.message;

             post = { status: self.previous };
             if (!!params.location) {
               params.location = devices.expand(params.location, 'device/' + self.deviceID);
               if ((util.isArray(params.location)) && (params.location.length > 1)) {
                 if ((!places.place1)
                         || (!util.isArray(places.place1.info.location))
                         || (places.places1.info.location[0] !== params.location[0])
                         || (places.places1.info.location[1] !== params.location[1])) {
                   post.lat = params.location[0];
                   post.long = params.location[1];
                 } else {
                   delete(params.location);
                   delete(params.imageurl);
                 }
               }
             }

             if (!params.imageurl) return self.twitter.post('statuses/update', post, self.growl);

             params.imageurl = devices.expand(params.imageurl, 'device/' + self.deviceID);
             http.request (url.parse(params.imageurl), function(response) {
               var body = null;

               response.on('data', function(data) {
                 body = (!!body) ? new Buffer.concat([ body, data ]) : data;
               }).on('end', function() {
                 var name, payload;

                 if (!body) {
                   logger.warning('device/' + self.deviceID, { event: 'http', diagnostic: 'empty result' });
                   return self.twitter.post('statuses/update', post, self.growl);
                 }

                 payload = [ { headers : { 'Content-Disposition'       : 'form-data; name="media[]"; filename="media.png"'
                                         , 'Content-Type'              : 'image/png'
                                         , 'Content-Transfer-Encoding' : 'base64'
                                         }
                             , value   : body.toString('base64')
                             }
                           ];
                 for (name in post) if (post.hasOwnProperty(name)) {
                   payload.push({ headers : { 'Content-Disposition'    : 'form-data; name="' + name + '"' }
                                , value   : post[name]
                                });
                 }

                 self.twitter.post('statuses/update_with_media', self.twitter.makeForm(payload), self.growl);
               }).on('close', function() {
                 logger.warning('device/' + self.deviceID, { event: 'http', diagnostic: 'premature eof' });
               });
             }).on('error', function(err) {
               logger.error('device/' + self.deviceID, { event: 'http', diagnostic: err.message });
             }).end();
           }
};

Twitter.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (!Twitter.operations[perform]) return devices.perform(self, taskID, perform, parameter);

  Twitter.operations[perform](this, params);
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

  if (!Twitter.operations[perform]) return devices.validate_perform(perform, parameter);

  if (!params) return result;

  if (perform === 'set') {
    if (!params.consumerKey) params.consumerKey = 'XXXXXXXXXXXXXXXXXXXXXXXXX';
    if (!params.consumerSecret) params.consumerSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    if (!params.token) params.token = 'XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    if (!params.tokenSecret) params.tokenSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    return validate_create(params);
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
