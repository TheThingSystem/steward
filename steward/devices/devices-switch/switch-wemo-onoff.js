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


var WeMo_Switch = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/switch/wemo/onoff';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'waiting';
  self.sid = null;
  self.seq = 0;
  self.logger = plug.logger;

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (request === 'ping') {
      self.logger.info('device/' + self.deviceID, { status: self.status });
      return;
    }

    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') self.perform(self, taskID, perform, parameter);
  });

  utility.broker.subscribe('discovery', function(method, headers, content) {
    if (method === 'notify') self.notify(self, headers, content);
  });

  self.jumpstart(self);
};
util.inherits(WeMo_Switch, plug.Device);


WeMo_Switch.prototype.jumpstart = function(self) {
  discovery.upnp_subscribe('device/' + self.deviceID, self.url, self.sid, '/upnp/event/basicevent1',
                           function(err, state, response) {
    var i, secs;

    self.logger.debug('subscribe: ' + state + ' code ' + response.statusCode,
                      { err: stringify(err), headers: stringify(response.headers) });
    if (err) {
      self.logger.info('device/' + self.deviceID, { event: 'subscribe', diagnostic: err.message });
      setTimeout(function() { self.jumpstart(self); }, secs * 30 * 1000);
      return;
    }

    if ((response.statusCode !== 200) || (!response.headers.sid)) {
      self.sid = null;
      setTimeout(function() { self.jumpstart(self); }, secs * 30 * 1000);
      return;
    }

    self.sid = response.headers.sid;
    self.seq = 0;
    if (!!response.headers.timeout) {
      secs = response.headers.timeout;
      if ((i = secs.indexOf('Second-')) >= 0) secs = secs.substring(i + 7);
      secs = parseInt(secs, 10) - 1;
      if (secs <= 10) secs = 10;
      setTimeout(function() { self.jumpstart(self); }, secs * 1000);
    } else secs = 0;

    self.logger.info('device/' + self.deviceID, { subscribe: self.sid, sequence: self.seq, seconds: secs });
  });
};

WeMo_Switch.prototype.perform = function(self, taskID, perform, parameter) {/* jshint multistr: true */
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

    case 'set':
      if (!params.name) return false;
      action = '"urn:Belkin:service:basicevent:1#SetFriendlyName"';
      body =
'<u:SetFriendlyName xmlns:u="urn:Belkin:service:basicevent:1">\
   <FriendlyName>' + params.name.replace(/[<&]/g, function(str) { return (str === "&") ? "&amp;" : "&lt;";}) + '</FriendlyName>\
</u:SetFriendlyName>';
      break;

    default:
      return;
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

    self.logger.debug('perform: ' + state + ' code ' + response.statusCode, { err: stringify(err), result: stringify(result) });
    if (err) return;

    faults = result.faults;
    for (i = 0; i < faults.length; i++) {
      self.logger.error('device/' + self.deviceID,
                        { event: 'controller', parameter: 'SetBinaryState', diagonstic: stringify(faults[i]) });
    }

    if ((faults.length === 0) && (perform === 'set')) self.setName(params.name);
  });

  return steward.performed(taskID);
};

WeMo_Switch.prototype.notify = function(self, headers, content) {
  var parser = new xml2js.Parser();

  if ((headers.sid !== self.sid) || (headers.seq < self.seq)) return;
  self.seq = headers.seq + 1;

  try { parser.parseString(content, function(err, data) {
    if (err) {
      self.logger.error('device/' + self.deviceID, { event: 'xml2js.Parser', content: content, diagnostic: err.message });
      return;
    }

    self.observe(self, (!!data['e:propertyset']) ? data['e:propertyset']['e:property'] : []);
  }); } catch(ex) { self.logger.error('device/' + self.deviceID, { event: 'notify', diagnostic: ex.message }); }
};

WeMo_Switch.prototype.observe = function(self, results) {
  var i, now, onoff, previous;

  now = new Date();

  previous = self.status;
  if (self.status === 'waiting') self.changed(now);
  self.status = 'busy';
  if (!util.isArray(results)) return;

  for (i = 0; i < results.length; i++) {
    onoff = results[i].BinaryState;
    if (!util.isArray(onoff)) continue;

    self.status = parseInt(onoff[0], 10) ? 'on' : 'off';
    break;
  }

  if (self.status != previous) self.changed(now);
};


var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (perform === 'set') {
    if (!parameter) {
      result.requires.push('parameter');
      return result;
    }
    try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

    if (!params.name) result.requires.push('name');
  } else if ((perform !== 'on') && (perform !== 'off')) result.invalid.push('perform');

  return result;
};



exports.start = function() {
  steward.actors.device['switch'].wemo = steward.actors.device['switch'].wemo ||
      { $info     : { type: '/device/switch/wemo' } };

  steward.actors.device['switch'].wemo.onoff =
      { $info     : { type       : '/device/switch/wemo/onoff'
                    , observe    : [ ]
                    , perform    : [ 'off', 'on' ]
                    , properties : { name   : true
                                   , status : [ 'waiting', 'busy', 'on', 'off' ]
                                   }
                    }
      , $validate : {  perform   : validate_perform }
      };
  devices.makers['urn:Belkin:device:controllee:1'] = WeMo_Switch;
};
