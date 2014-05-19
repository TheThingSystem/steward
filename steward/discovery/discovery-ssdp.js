var fs          = require('fs')
  , http        = require('http')
  , lsof        = require('lsof')
  , portfinder  = require('portfinder')
  , SSDP        = require('node-ssdp')
  , stringify   = require('json-stringify-safe')
  , url         = require('url')
  , util        = require('util')
  , xml2js      = require('xml2js')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  , broker      = utility.broker
  ;


var logger = utility.logger('discovery');

var client;
var listening;

var listen = function(addr, portno) {/* jshint multistr: true */
  var data, filename, filepath, ssdp;

  filename = 'index-' + addr + '.xml';
  filepath = __dirname + '/../sandbox/' + filename;
  data =
'<?xml version="1.0"?>\
\
<root xmlns="urn:schemas-upnp-org:device-1-0">\
  <specVersion>\
    <major>1</major>\
    <minor>0</minor>\
  </specVersion>\
  <URLBase>http://' + addr + ':' + portno + '/</URLBase>\
  <device>\
    <deviceType>urn:schemas-upnp-org:device:Basic:1</deviceType>\
    <friendlyName>steward</friendlyName>\
    <manufacturer>The Thing System, Inc.</manufacturer>\
    <manufacturerURL>http://thingsystem.com/</manufacturerURL>\
    <modelDescription>the steward</modelDescription>\
    <modelName>steward/1.0 node.js</modelName>\
    <UDN>uuid:' + steward.uuid + '</UDN>\
    <serviceList></serviceList>\
    <presentationURL></presentationURL>\
  </device>\
</root>';
  fs.unlink(filepath, function(err) {/* jshint unused: false */
    fs.writeFile(filepath, data, { encoding: 'utf8', mode: parseInt('0644', 8), flag: 'w' }, function(err) {
      if (!!err) {
        logger.error('discovery', { event: 'fs.writefile', diagnostic: err.message });
        fs.unlink(filepath);
      }
    });
  });

  ssdp = new SSDP();
  ssdp.logger = logger;
  ssdp.description = filename;
  ssdp.addUSN('upnp:rootdevice');
  ssdp.addUSN('urn:schemas-upnp-org:device:Basic:1');

  try { ssdp.server(addr, portno, 1900); } catch(ex) {
    lsof.rawUdpPort(1900, function(data) {
      logger.error('discovery', { event: 'listen', diagnostic: ex.message, listeners: stringify(data) });
    });

    throw(ex);
  }

  client = ssdp;
  client.description = filename;
  client.on('advertise-alive', function(heads) {
    logger.debug('advertise-alive', { heads: stringify(heads) });
  }).on('advertise-bye', function(heads) {
    logger.debug('advertise-bye', { heads: stringify(heads) });
  }).on('response', function(msg, rinfo) {
    var i, j, localP, o;

    logger.debug('UPnP response', { rinfo: stringify(rinfo) });

    var lines = msg.toString().split("\r\n");
    var matches = /HTTP\/(\d)\.(\d) (\d{3}) (.*)/i.exec(lines[0]);
    var info = {
      'http'      : {
            major : matches[1]
          , minor : matches[2]
          , code  : matches[3]
          }
        , source  : 'ssdp'
        , ssdp    : {}
        , device  : {}
        };

    for (i = 1; i < lines.length; i++) {
      j = lines[i].indexOf(':');
      if (j <= 0) break;
      info.ssdp[lines[i].substring(0, j)] = lines[i].substring(j + 1).trim();
    }

    if (info.ssdp.ST !== 'upnp:rootdevice') return;

    o = url.parse(info.ssdp.LOCATION || info.ssdp.Location);
    if (o.hostname !== rinfo.address) {
      logger.warning('discovery', { event: 'forwarded SSDP response', responder: rinfo, location: o.hostname });
    }

    localP = false;
    steward.forEachAddress(function(addr) { if (o.hostname === addr) { localP = true; } });
    if (!localP) exports.ssdp_discover(info, o);
  }).search('ssdp:all');

  setTimeout(function() { client.search('ssdp:all'); }, 30 * 1000);

  portfinder.getPort({ port: 8886 }, function(err, portno) {
    if (err) {
      logger.error('start', { event: 'portfinder.getPort 8887', diagnostic: err.message });
      return;
    }

    http.createServer(function(request, response) {
      var content = '';

      if (request.method !== 'NOTIFY') {
        response.writeHead(405, { Allow: 'NOTIFY' });
        response.end();
        return;
      }

      request.setEncoding('utf8');
      request.on('data', function(chunk) {
        content += chunk.toString();
      }).on('end', function() {
        response.writeHead(200, {});
        response.end();

        broker.publish('discovery', 'notify', request.headers, content);
      });
    }).on('listening', function() {
      listening = 'http://' + addr + ':' + portno;
      logger.info('UPnP listening on ' + listening);
    }).listen(portno, addr);
  });
};

exports.ssdp_discover = function(info, options, callback) {
  options.agent = false;

  http.get(options, function(response) {
    var content = '';

    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      content += chunk.toString();
    }).on('end', function() {
      var parser = new xml2js.Parser();

      if (response.statusCode !== 200) {
        if (!!callback) return callback(new Error('HTTP status code ' + response.statusCode));
        return logger.error('discovery', { event: 'http.get', options: options, code: response.statusCode, content: content });
      }

      try { parser.parseString(content, function(err, data) {
        var pair;

        if (!!err) {
          if (content === 'status=ok') return;    // Chromecast (when playing)
          return logger.error('discovery', { event      : 'parser.parseString'
                                           , options    : options
                                           , content    : content
                                           , diagnostic : err.message
                                           });
        }
        if (!data) data = { root: {} };
        if (!data.root.device) {
          data.root.device = [ { friendlyName     : [ '' ]
                               , manufacturer     : [ '' ]
                               , modelName        : [ '' ]
                               , modelDescription : [ '' ]
                               , UDN              : [ '' ]
                               }
                             ];
        }
        if (!data.root.device[0].serialNumber) data.root.device[0].serialNumber = data.root.device[0].serialNum || [ '' ];
        if (!data.root.device[0].modelDescription) data.root.device[0].modelDescription = [''];
        if (!data.root.device[0].modelNumber) data.root.device[0].modelNumber = [''];

        info.upnp = data;

        info.device =
          { url             : (!!data.root.URLBase) ? data.root.URLBase[0] : options.protocol + '//' + options.host + '/'
          , name            : data.root.device[0].friendlyName[0]
          , manufacturer    : data.root.device[0].manufacturer[0]
          , model           :
              { name        : data.root.device[0].modelName[0]
              , description : data.root.device[0].modelDescription[0]
              , number      : data.root.device[0].modelNumber[0]
              }
          , unit            :
              { serial      : data.root.device[0].serialNumber[0]
              , udn         : data.root.device[0].UDN[0]
              }
          };
        info.url = info.device.url;

        for (pair in pairings) if (pairings.hasOwnProperty(pair)) {
          try { info.deviceType = pairings[pair](info.upnp); } catch(ex) { continue; }
          if (!!info.deviceType) break;
        }
        if (!info.deviceType) {
          info.deviceType = info.device.model.name;
          info.deviceType2 = data.root.device[0].deviceType[0];
          if ((!!data.root.device[0].serviceList)
                  && (!!data.root.device[0].serviceList[0].service)
                  && (!!data.root.device[0].serviceList[0].service[0])) {
            info.deviceType3 = data.root.device[0].serviceList[0].service[0].serviceType[0];
          }
        }
        info.id = info.device.unit.udn;
        if (!!devices.devices[info.id]) return;

        logger.info('UPnP ' + info.device.name, { url: info.url });
        devices.discover(info);
      }); } catch(ex) { logger.error('discovery', { event: 'SSDP parse', diagnostic: ex.message }); }
      if (!!callback) callback(null);
    }).on('close', function() {
      if (!!callback) return callback(new Error('premature EOF'));
      logger.error('discovery', { event: 'ssdp', diagnostic: info.ssdp.LOCATION + ' => premature EOF' });
    });
  }).on('error', function(err) {
    if (!!callback) return callback(err);
    logger.error('discovery', { event: 'http.get', options: options, diagnostic: err.message });
  });
};


var pairings = {};

exports.upnp_register = function(deviceType, f) {
  pairings[deviceType] = f;
};


exports.upnp_subscribe = function(tag, baseurl, sid, path, cb) {
  var options = url.parse(baseurl);

  if (!listening) {
    cb(null, 'not listening', { statusCode: 'unknown' });
    return;
  }

  options.agent     = false;
  options.method    = 'SUBSCRIBE';
  options.pathname  = path;
  options.search    = '';
  options.path      = options.pathname;
  options.query     = '';
  options.hash      = '';
  if (sid) {
    options.headers = { SID: sid };
  } else {
    options.headers = { NT: 'upnp:event', NTS: 'upnp:propchange', CALLBACK: '<' + listening + '>' };
  }

  http.request(options, function(response) {
    var content = '';

    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      content += chunk.toString();
    }).on('end', function() {
      if (response.statusCode !== 200) {
          logger[response.statusCode !== 412 ? 'warning' : 'debug']
              (tag, { event: 'subscribe', code: response.statusCode, content: content });
      }
      cb(null, 'end', response);
    }).on('close', function() {
      logger.warning(tag, { event: 'subscribe', diagnostic: 'premature eof' });
      cb(null, 'close', response);
    });
  }).on('error', function(err) {
    logger.error(tag, { event: 'subscribe', options: options, diagnostic: err.message });
    cb(err, 'error', { statusCode: 'unknown' });
  }).end();
};


exports.upnp_roundtrip = function(tag, baseurl, params) {
  var body    = null
    , cb      = null
    , options = url.parse(baseurl);

  if (typeof params !== 'object') params = { pathname: params };
  if (arguments.length == 4) {
    if (typeof arguments[3] === 'function') {
      cb = arguments[3];
    } else {
      body = arguments[3];
    }
  } else if (arguments.length > 4) {
    body = arguments[3];
    cb = arguments[4];
  }

  options.agent    = false;
  options.method   = params.method   || 'GET';
  options.pathname = params.pathname || '/';
  options.search   = params.search   || '';
  options.path     = params.path     || options.pathname;
  options.query    = params.query    || '';
  options.hash     = params.hash     || '';
  options.headers  = params.headers  || {};

  http.request(options, function(response) {
    var content = '';

    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      content += chunk.toString();
    }).on('end', function() {
      var parser = new xml2js.Parser();

      if (response.statusCode !== 200) {
        return logger.warning(tag, { event: 'roundtrip', code: response.statusCode, content: content });
      }

      try { parser.parseString(content, function(err, data) {
        var faults, i, results, s;

        if (err) {
          logger.error(tag, { event: 'parser.parseString', options: options, content: content, diagnostic: err.message });
          data = {};
        } else if (!data) data = {};

        s = (!!data['s:Envelope']) ? data['s:Envelope']['s:Body'] : [];

        faults = [];
        results = [];
        if (util.isArray(s)) {
          for (i = 0; i < s.length; i++) if (!!s[i]['s:Fault']) faults.push(s[i]['s:Fault']); else results.push(s[i]);
        }

        cb(null, 'end', response, { results: results, faults: faults });
      }); } catch(ex) { logger.error(tag, { event: 'UPnP parse', diagnostic: ex.message }); }
    }).on('close', function() {
      logger.warning(tag, { event: 'roundtrip', diagnostic: 'premature eof' });
      cb(null, 'close', response);
    });
  }).on('error', function(err) {
    logger.error(tag, { event: 'roundtrip', options: options, diagnostic: err.message });
    cb(err, 'error', { statusCode: 'unknown' });
  }).end(body);
};


var seen = {};
var waiting = [];

exports.arp = function(ifname, ifaddr, arp) {
  var p;

  if (!client) {
    waiting.push({ ifname: ifname, ifaddr: ifaddr, arp: arp });
    return;
  }

  test(ifname, ifaddr, arp.sender_ha, arp.sender_pa);
  test(ifname, ifaddr, arp.target_ha, arp.target_pa);

  while (waiting.length > 0) {
    p = waiting.pop();
    test(p.ifname, p.ifaddr, p.arp.sender_ha, p.arp.sender_pa);
    test(p.ifname, p.ifaddr, p.arp.target_ha, p.arp.target_pa);
  }
};

var test = function(ifname, ifaddr, macaddr, ipaddr) {
  if (!!seen[macaddr]) return;

  seen[macaddr] = ipaddr;
  if (ifaddr !== ipaddr) client.search('ssdp:all', ipaddr);
};


exports.start = function(portno) {
  SSDP.SSDP_LOGGER = logger;

  steward.forEachAddress(function(addr) {
    listen(addr, portno);
   });
};
