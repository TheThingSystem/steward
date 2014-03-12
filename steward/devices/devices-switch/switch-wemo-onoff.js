// Wemo Switch: http://www.belkin.com/us/wemo-switch

var stringify   = require('json-stringify-safe')
  , util        = require('util')
  , xml2js      = require('xml2js')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , discovery   = require('./../../discovery/discovery-ssdp')
  , plug        = require('./../device-switch')
  ;


var WeMo_OnOff = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = { Insight: '/device/switch/wemo/meter' }[info.deviceType] || '/device/switch/wemo/onoff';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'waiting';
  self.changed();
  self.info = { };
  self.sid = null;
  self.seq = 0;
  self.logger = plug.logger;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  utility.broker.subscribe('discovery', function(method, headers, content) {
    if (method === 'notify') self.notify(self, headers, content);
  });

  self.jumpstart(self);
  if (self.whatami === '/device/switch/wemo/meter') self.jumpstart(self, '/upnp/event/insight1');
  self.primer(self);
};
util.inherits(WeMo_OnOff, plug.Device);


WeMo_OnOff.prototype.primer = function(self) {/* jshint multistr: true */
  var action, body;

  action = '"urn:Belkin:service:basicevent:1#GetBinaryState"';
  body =
'<u:GetBinaryState xmlns:u="urn:Belkin:service:basicevent:1">\
   <BinaryState>0</BinaryState>\
</u:GetBinaryState>';

  discovery.upnp_roundtrip('device/' + self.deviceID, self.url,
                           { method   : 'POST'
                           , pathname : '/upnp/control/basicevent1'
                           , headers  : { SOAPACTION     : action
                                        , 'Content-Type' : 'text/xml; charset="utf-8"'
                                        }
                           },
'<?xml version="1.0" encoding="utf-8"?>\
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\
 <s:Body>' + body + '</s:Body>\
</s:Envelope>', function(err, state, response, result) {
    var faults, i;

    self.logger.debug('device/' + self.deviceID, { event : 'primer'
                                                 , state : state
                                                 , code  : response.statusCode
                                                 , err   : stringify(err)
                                                 , result: stringify(result)
                                                 });

    if (!!err) return;

    try {
      self.observe(self, result.results[0]['u:GetBinaryStateResponse'][0]);
    } catch(ex) {}
    faults = result.faults;
    for (i = 0; i < faults.length; i++) {
      self.logger.error('device/' + self.deviceID,
                        { event: 'controller', parameter: 'GetBinaryState', diagonstic: stringify(faults[i]) });
    }
  });
};

WeMo_OnOff.prototype.jumpstart = function(self, path) {
  if (!path) path = '/upnp/event/basicevent1';
  discovery.upnp_subscribe('device/' + self.deviceID, self.url, self.sid, path, function(err, state, response) {
    var i, secs;

    self.logger.debug('device/' + self.deviceID, { event   : 'subscribe'
                                                 , state   : state
                                                 , code    : response.statusCode
                                                 , err     : stringify(err)
                                                 , headers : stringify(response.headers)
                                                 });

    if (!!err) {
      self.logger.info('device/' + self.deviceID, { event: 'subscribe', diagnostic: err.message });
      self.timer = setTimeout(function() { self.jumpstart(self); }, 30 * 1000);
      return;
    }

    if ((response.statusCode !== 200) || (!response.headers.sid)) {
      self.sid = null;
      self.timer = setTimeout(function() { self.jumpstart(self, path); }, 30 * 1000);
      return;
    }

    self.sid = response.headers.sid;
    self.seq = 0;
    if (!!response.headers.timeout) {
      secs = response.headers.timeout;
      if ((i = secs.indexOf('Second-')) >= 0) secs = secs.substring(i + 7);
      secs = parseInt(secs, 10) - 1;
      if (secs <= 10) secs = 10;
      self.timer = setTimeout(function() { self.jumpstart(self, path); }, secs * 1000);
    } else secs = 0;

    self.logger.info('device/' + self.deviceID, { subscribe: self.sid, sequence: self.seq, seconds: secs });
  });
};

WeMo_OnOff.prototype.perform = function(self, taskID, perform, parameter) {/* jshint multistr: true */
  var action, body, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  switch (perform) {
    case 'off':
      action = '"urn:Belkin:service:basicevent:1#SetBinaryState"';
      body =
'<u:SetBinaryState xmlns:u="urn:Belkin:service:basicevent:1">\
   <BinaryState>0</BinaryState>\
</u:SetBinaryState>';
      break;

    case 'on':
      action = '"urn:Belkin:service:basicevent:1#SetBinaryState"';
      body =
'<u:SetBinaryState xmlns:u="urn:Belkin:service:basicevent:1">\
   <BinaryState>1</BinaryState>\
</u:SetBinaryState>';
      break;

    case 'wake':
      return self.wake();

    case 'set':
      if (!params.name) return false;
      action = '"urn:Belkin:service:basicevent:1#ChangeFriendlyName"';
      body =
'<u:ChangeFriendlyName xmlns:u="urn:Belkin:service:basicevent:1">\
   <FriendlyName>' + params.name.replace(/[<&]/g, function(str) { return (str === "&") ? "&amp;" : "&lt;";}) + '</FriendlyName>\
</u:ChangeFriendlyName>';
      break;

    default:
      return false;
  }

  discovery.upnp_roundtrip('device/' + self.deviceID, self.url,
                           { method   : 'POST'
                           , pathname : '/upnp/control/basicevent1'
                           , headers  : { SOAPACTION     : action
                                        , 'Content-Type' : 'text/xml; charset="utf-8"'
                                        }
                           },
'<?xml version="1.0" encoding="utf-8"?>\
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\
 <s:Body>' + body + '</s:Body>\
</s:Envelope>', function(err, state, response, result) {
    var faults, i;

    self.logger.debug('device/' + self.deviceID, { event  : 'perform'
                                                 , state  : state
                                                 , code   : response.statusCode
                                                 , err    : stringify(err)
                                                 , result : stringify(result)
                                                 });

    if (!!err) return;

    faults = result.faults;
    for (i = 0; i < faults.length; i++) {
      self.logger.error('device/' + self.deviceID,
                        { event: 'controller', perform: perform, parameter: parameter, diagonstic: stringify(faults[i]) });
    }
    if (faults.length !== 0) return;

    switch (perform) {
      case 'set':
        self.setName(params.name);
        return;

       case 'off':
       self.status = 'off';
        break;

       case 'on':
        break;

      default:
        return;
    }
    self.changed();
    if (!!self.timer) { clearTimeout(self.timer); self.timer = null; }
    self.jumpstart(self);
  });

  return steward.performed(taskID);
};

WeMo_OnOff.prototype.notify = function(self, headers, content) {
  var parser = new xml2js.Parser();

  if ((headers.sid !== self.sid) || (headers.seq < self.seq)) return;
  self.seq = headers.seq + 1;

  self.logger.debug('device/' + self.deviceID, { event   : 'notify'
                                               , content : content
                                               });

  try { parser.parseString(content, function(err, data) {
    if (!!err) {
      self.logger.error('device/' + self.deviceID, { event: 'xml2js.Parser', content: content, diagnostic: err.message });
      return;
    }

    self.observe(self, (!!data['e:propertyset']) ? data['e:propertyset']['e:property'] : []);
  }); } catch(ex) { self.logger.error('device/' + self.deviceID, { event: 'notify', diagnostic: ex.message }); }
};

WeMo_OnOff.prototype.observe = function(self, results) {
  var changedP, i, now, prop, result, value;

  now = new Date();

  if (self.status === 'waiting') self.changed(now);
  if (!util.isArray(results)) return;

  var f = function(k, v) {
    var g = { BinaryState   : function() {
                                var onoff  = parseInt(v, 10) ? 'on' : 'off';

                                if (self.status !== onoff) {
                                  changedP = true;
                                  self.status = onoff;
                                }
                              }

            , InsightParams : function() {
                                var status = v.split('|')
                                  , watts  = parseInt(status.length > 6 ? status[6] : 'NaN', 10)
                                  ;

                                if ((!isNaN(watts)) && (self.info.currentUsage !== watts)) {
                                  changedP = true;
                                  self.info.currentUsage = watts;
                                }
                              }

            , TodayKWH      : function() {
                                var status = v.split('|')
                                  , kwh    = parseInt(status.length > 0 ? status[0] : 'NaN', 10)
                                  ;

                                if (self.info.dailyUsage !== kwh) {
                                  changedP = true;
                                  self.info.dailyUage = kwh;
                                }
                              }
            }[k];
    if (!!g) g();
  };

  changedP = false;
  for (i = 0; i < results.length; i++) {
    result = results[i];
    for (prop in result) if (result.hasOwnProperty(prop)) {
      value = result[prop];
      if ((util.isArray(value)) && (value.length > 0)) f(prop, value[0]);
    }
  }
  if (changedP) self.changed(now);
};


var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'off') return result;

  if (perform === 'wake') return result;

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
    return result;
  }

  if (perform !== 'on') result.invalid.push('perform');

  return result;
};


exports.start = function() {
  steward.actors.device['switch'].wemo = steward.actors.device['switch'].wemo ||
      { $info     : { type: '/device/switch/wemo' } };

  steward.actors.device['switch'].wemo.onoff =
      { $info     : { type       : '/device/switch/wemo/onoff'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on', 'wake' ]
                    , properties : { name   : true
                                   , status : [ 'waiting', 'busy', 'on', 'off' ]
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  devices.makers['urn:Belkin:device:controllee:1'] = WeMo_OnOff;
  devices.makers['urn:Belkin:device:lightswitch:1'] = WeMo_OnOff;

  steward.actors.device['switch'].wemo.meter = utility.clone(steward.actors.device['switch'].wemo.onoff);
  steward.actors.device['switch'].wemo.meter.$info.type = '/device/switch/wemo/meter';
  steward.actors.device['switch'].wemo.meter.$info.properties.currentUsage = 'watts';
  steward.actors.device['switch'].wemo.meter.$info.properties.dailyUsage   = 'watt-hours';
  devices.makers['urn:Belkin:device:insight:1'] = WeMo_OnOff;
};
