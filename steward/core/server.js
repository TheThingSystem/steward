var fs          = require('fs')
  , http        = require('http')
  , https       = require('https')
//, mime        = require('mime')
  , mqtt        = require('mqtt')
  , net         = require('net')
  , os          = require('os')
  , portfinder  = require('portfinder')
  , speakeasy   = require('speakeasy')
//, ssh_keygen  = require('ssh-keygen')
  , static      = require('node-static')
//, tls         = require('tls')
  , url         = require('url')
  , util        = require('util')
  , x509keygen  = require('x509-keygen')
  , winston     = require('winston')
  , wsServer    = require('ws').Server
  , steward     = require('./steward')
  , utility     = require('./utility')
  , broker      = utility.broker
  ;


var logger = utility.logger('server');

if ((process.arch !== 'arm') || (process.platform !== 'linux')) {
  var mdns      = require('mdns');
} else {
  try {
    var avahi     = require('avahi_pub');

    if (!avahi.isSupported()) {
      logger.info('failing Avahi publisher (continuing)');
      avahi = null;
    }
  } catch(ex) {}
}


var places = null;
var routes = exports.routes = {};


exports.start = function() {
  start(8888, true);
  start(8887, false);

/* TBD: once ssh server module is ready!

  portfinder.getPort({ port: 8889 }, function(err, portno) {
    var key = __dirname + '/../db/server_rsa'
      , pub = __dirname + '/../sandbox/server_rsa.pub'
      ;

    if (err) return logger.error('server', { event: 'portfinder.getPort 8889', diagnostic: err.message });

    fs.exists(key, function(exists) {
      if (exists) {
        exports.ssh = { key: key, pub: pub };
        return logger.info('TBD: listening on ssh -p ' + portno);
      }

      ssh_keygen({ location : key
                 , force    : false
                 , destroy  : false
                 , log      : logger
                 , quiet    : true
                 }, function(err, sshkey) {
        if (err) return logger.error('server', { event: 'ssh_keygen', diagnostic: err.message });

        fs.chmod(key, 0400, function(err) {
          if (err) logger.error('server', { event: 'chmod', file: key, mode: '0400', diagnostic: err.message });
        });

        fs.rename(key + '.pub', pub, function(err) {
          if (err) logger.error('server', { event: 'rename', src: key + '.pub', dst: pub, diagnostic: err.message });
          else sshkey.pubKey = pub;

          fs.chmod(sshkey.pubKey, 0444, function(err) {
            if (err) logger.error('server', { event: 'chmod', file: sshkey.pubKey, mode: '0444', diagnostic: err.message });
          });

          exports.sshkey = { key: sshkey.key, pub: sshkey.pubKey };
          return logger.info('TBD: listening on ssh -p ' + portno);
        });
      });
    });
  });
 */

  utility.acquire(logger, __dirname + '/../routes', /^route-.*\.js$/, 6, -3, ' route');
};

var securePort = 0;

var logins = exports.logins = {};

var httpsT = 'http'
  , wssT   = 'ws'
  , wssP   = null
  ;

var start = function(port, secureP) {
  portfinder.getPort({ port: port }, function(err, portno) {
    var server;

    var crt     = __dirname + '/../sandbox/server.crt'
      , key     = __dirname + '/../db/server.key'
      , options = { port : portno }
      , stasis  = new static.Server(__dirname + '/../sandbox')
      ;

    if (err) return logger.error('server', { event: 'portfinder.getPort ' + port, diagnostic: err.message });

    if (secureP) {
      if (fs.existsSync(key)) {
        if (fs.existsSync(crt)) {
          options.key = key;
          options.cert = crt;
          httpsT = 'https';
          wssT = 'wss';
          wssP = portno;

          exports.x509 = { key: key, crt: crt };
        } else return logger.error('no startup certificate', { cert: crt });
      } else return logger.error('no startup key', { key: key });

      securePort = portno;
    }

    server = new wsServer(options).on('connection', function(ws) {
      var request = ws.upgradeReq;
      var pathname = url.parse(request.url).pathname;
      var tag = wssT + ' ' + request.connection.remoteAddress + ' ' + request.connection.remotePort + ' ' + pathname;
      var meta;

      ws.clientInfo = steward.clientInfo(request.connection, secureP);
      meta = ws.clientInfo;
      meta.event = 'connection';
      logger.info(tag, meta);

      ws.on('error', function(err) {
        logger.info(tag, { event: 'error', message: err });
      });
      ws.on('close', function(code, message) {
        var meta = utility.clone(ws.clientInfo);

        meta.event = 'close';
        meta.code = code;
        meta.message = message;
        logger.info(tag, meta);

        broker.publish('actors', 'logout', ws.clientInfo.clientSerialNo);
        delete(logins[tag]);
      });

      if (!routes[pathname]) {
        logger.warning(tag, { event: 'route', transient: false, diagnostic: 'unknown path: ' + pathname });
        return ws.close(1008, 'not found');
      }

// NB: each route is responsible for access control, both at start and per-message
      (routes[pathname].route)(ws, tag);
    }).on('error', function(err) {
      logger.error('server', { event: 'ws.error', diagnostic: err.message });
    })._server;
    server.removeAllListeners('request');
    server.on('request', function(request, response) {
      var u = url.parse(request.url);
      var pathname = u.pathname;
      var tag = httpsT + ' ' + request.connection.remoteAddress + ' ' + request.connection.remotePort + ' ' + pathname;
      var meta = steward.clientInfo(request.connection, secureP);

      meta.event = 'request';
      meta.method = request.method;
      logger.info(tag, meta);

      if (!places) places = require('./../actors/actor-place');

// strict must be OFF and the request must either come from the LAN or localhost
      if ((places.place1.info.strict === 'off') && ((request.connection.localAddress !== '127.0.0.1') || !secureP)) {
        if ((pathname === '/oneshot') && (require('./../routes/route-oneshot').process(request, response, tag))) return;
      }

      if ((request.method !== 'GET') && (request.method !== 'HEAD')) {
        logger.info(tag, { event: 'invalid method', code: 405, method: request.method });
        response.writeHead(405, { Allow: 'CONNECT' });
        return response.end();
      }

      pathname = { '/'        : '/index.html'
                 , '/client'  : '/client.html'
                 , '/console' : '/console.html'
                 }[pathname] || pathname;

/* NB: everything "interesting" should be via WebSockets, not HTML...
       if that changes, we can add an exception list here.

      if (!steward.readP(meta)) {
        delete(meta.method);

        meta.event = 'access';
        meta.diagnostic = 'unauthorized';
        meta.resource = pathname;
        logger.warning(tag, meta);

        response.writeHead(403, { 'Content-Type': 'text/plain' });
        return response.end('403 not allowed');
      }
 */
      if ((places.place1.info.strict !== 'off')
              && (!secureP)
              && (securePort !== 0)
              && (pathname !== '/index.xml')
              && (request.connection.localAddress !== '127.0.0.1')) {
        var location = 'https://' + request.connection.localAddress + ':' + securePort;

        if (!!u.pathname) location += u.pathname;
        if (!!u.hash)     location += u.hash;

        logger.info(tag, { event: 'request', code: 307, location: location });
        response.writeHead(307, { location: location, 'content-length' : 0 });
        return response.end();
      }

      if ((pathname.indexOf('/') !== 0) || (pathname.indexOf('..') !== -1)) {
        logger.info(tag, { event: 'invalid path', code: 404 });
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        return response.end('404 not found');
      }

      u.pathname = pathname;
      request.url = url.format(u);
      stasis.serve(request, response, function(err, result) {
        if (!!err) {
          response.writeHead(err.status, err.headers);
          response.end();
          return logger.warning(tag, { code: err.status, message: err.message });
        }

        logger.info(tag,
                    { code: result.status, type: result.headers['Content-Type'], octets: result.headers['Content-Length'] });
      });

/*
      pathname = __dirname + '/../sandbox/' + decodeURI(pathname.slice(1));

      var ct = mime.lookup(pathname);

      fs.readFile(pathname, function(err, data) {
        var code, diagnostic;

        if (err) {
          if (err.code === 'ENOENT') {
            code = 404;
            diagnostic = '404 not found';
          } else {
            code = 404;
            diagnostic = err.message + '\n';
          }
          logger.info(tag, { code: code, diagnostic: err.message });
          response.writeHead(code, { 'Content-Type': 'text/plain' });
          return response.end(diagnostic);
        }

        logger.info(tag, { code: 200, type: ct, octets: data.length });
        response.writeHead(200, { 'Content-Type'   : ct
                                , 'Content-Length' : data.length
                                , 'Cache-Control'  : 'max-age=86400, public'
                                });
        response.end(request.method === 'GET' ? data : '');
      });
*/
    });

    if (!wssP) wssP = portno;
    advertise();

    logger.info('listening on ' + wssT + '://*:' + portno);

    var hack = '0.0.0.0';
    http.createServer(function(request, response) {
      response.writeHead(302, { Location   :  httpsT + '://' + hack + ':' + portno
                              , Connection : 'close'
                              });
      response.end();
    }).on('connection', function(socket) {
      hack = socket.localAddress;
    }).on('listening', function() {
      logger.info('redirecting from http://*:80 to ' + httpsT + '://*:' + portno);
    }).on('error', function(err) {
      logger.info('unable to listen on http://*:80', { diagnostic: err.message });
    }).listen(80);

    if (secureP) {
      fs.exists(__dirname + '/../db/' + steward.uuid + '.js', function(existsP) {
        var crt2, params;

        if (!existsP) return;
        params = require(__dirname + '/../db/' + steward.uuid).params;

        crt2 = __dirname + '/../sandbox/cloud.crt';
        fs.unlink(crt2, function(err) {
          if ((!!err) && (err.code !== 'ENOENT')) logger.error('cloud', { event: 'fs.unlink', diagnostic: err.message });
          fs.writeFile(crt2, new Buffer(params.server.ca), { mode: 0444 }, function(err) {
            if (!!err) logger.error('cloud', { event: 'fs.writeFile', diagnostic: err.message });
          });
        });
        keycheck(params);
        register(params, portno);
        subscribe(params);
      });

      return;
    }

    utility.acquire(logger, __dirname + '/../discovery', /^discovery-.*\.js$/, 10, -3, ' discovery', portno);
  });
};

var wssA
  , httpsA
  ;

var advertise = exports.advertise = function() {
  var name, txt;

  if (!wssP) return;

  if (!places) places = require('./../actors/actor-place');
  if (!!places.place1) name = places.place1.name;
  if (!!exports.vous) name = exports.vous;

  txt = { uuid: steward.uuid };
  if (!!name) txt.name = name;

  if (!!mdns) {
    if (!!wssA) wssA.stop();
    wssA = mdns.createAdvertisement(mdns.tcp(wssT), wssP, { name: 'steward', txtRecord: txt })
        .on('error', function(err) { logger.error('mdns', { event      : 'createAdvertisement steward ' + wssT   + ' ' + wssP
                                                          , diagnostic : err.message }); });
    wssA.start();

    if (!!httpsA) httpsA.stop();
    httpsA = mdns.createAdvertisement(mdns.tcp(httpsT), wssP, { name: 'steward', txtRecord : txt })
        .on('error', function(err) { logger.error('mdns', { event      : 'createAdvertisement steward ' + httpsT + ' ' + wssP
                                                          , diagnostic : err.message }); });
    httpsA.start();
    return;
  }

  if (!!avahi) {
    txt = 'uuid ' + steward.uuid;
    if (!!name) txt += ' name ' + name;

    if (!!wssA) wssA.remove();
    wssA = avahi.publish({   name: 'steward', type: '_' + wssT + '._tcp',   port: wssP, data: txt });

    if (!!httpsA) httpsA.remove();
    httpsA = avahi.publish({ name: 'steward', type: '_' + httpsT + '._tcp', port: wssP, data: txt });
  }
};


exports.vous = null;
exports.suffix = null;

var keycheck = function (params) {
  var addresses, i, ifaddr, ifaddrs, ifname;

  var crt  = __dirname + '/../sandbox/server2.crt'
    , key  = __dirname + '/../db/server2.key'
    , sha1 = __dirname + '/../sandbox/server2.sha1'
    ;

  if (!exports.vous) exports.vous = params.name;
  if (!!exports.vous) {
    advertise();

    addresses = [];
    for (ifname in steward.ifaces) if (steward.ifaces.hasOwnProperty(ifname)) {
      ifaddrs = steward.ifaces[ifname].addresses;
      for (i = 0; i < ifaddrs.length; i++) {
        ifaddr = ifaddrs[i];
        if ((!ifaddr.internal) && (ifaddr.family === 'IPv4')) addresses.push(ifaddr.address);
      }
    }
    exports.suffix = '%26hostName='           + encodeURIComponent(os.hostname())
                          + '%26name='        + encodeURIComponent('steward')
                          + '%26ipAddresses=' + encodeURIComponent(addresses)
                          + '%26port='        + encodeURIComponent(wssP);
  }

  fs.exists(key, function(existsP) {
    var alternates, i, label, x;

    if (existsP) return;

    alternates = [ 'DNS:' + params.name
                 , 'DNS:steward.local'
                 , 'DNS:' + os.hostname()
                 , 'IP:'  + params.server.hostname
                 ];
    steward.forEachAddress(function(address) { alternates.push('IP:' + address); });
    for (i = 0; i < params.labels.length; i++) {
      label = params.labels[i];
      x = label.lastIndexOf('.');
      if (x !== -1) alternates.push('DNS:' + label.substring(0, x + 1) + params.name);
    }

    x509keygen.x509_keygen({ subject    : '/CN=' + params.name
                           , certfile   : crt
                           , keyfile    : key
                           , sha1file   : sha1
                           , alternates : alternates
                           , destroy    : false
                           , logger     : logger
                           }, function(err, data) {/* jshint unused: false */
      if (!!err) return logger.error('register', { event: 'x509keygen', diagnostic: err.message });

      fs.chmod(key, 0400, function(err) {
        if (!!err) logger.error('registrar', { event: 'fs.chmod', diagnostic: err.message });
      });
      fs.chmod(crt, 0444, function(err) {
        if (!!err) logger.error('registrar', { event: 'fs.chmod', diagnostic: err.message });
      });
      fs.chmod(sha1, 0444, function(err) {
        if (!!err) logger.error('registrar', { event: 'fs.chmod', diagnostic: err.message });
      });
    });
  });
};

var responders = 0;

var register = function(params, portno) {
  var didP, options, u;

  var retry = function(secs) {
    if (didP) return;
    didP = true;

    if (responders > 0) responders--;
    setTimeout(function() { register(params, portno); }, secs * 1000);
  };

  u = url.parse(params.issuer);
  options = { host    : params.server.hostname
            , port    : params.server.port
            , method  : 'PUT'
            , path    : '/register/' + params.labels[0]
            , headers : { authorization : 'TOTP '
                                        + 'username="' + params.uuid[0] + '", '
                                        + 'response="' + speakeasy.totp({ key      : params.base32
                                                                        , length   : 6
                                                                        , encoding : 'base32'
                                                                        , step     : params.step }) + '"'
                        , host          : u.hostname + ':' + params.server.port
                        }
            , agent   : false
            , ca      : [ new Buffer(params.server.ca) ]
            };
  didP = false;
  https.request(options, function(response) {
    var content = '';

    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      content += chunk.toString();
    }).on('end', function() {
      if (response.statusCode !== 200) {
        logger.error('register', { event: 'response', code: response.statusCode, retry: '15 seconds' });

        return retry(15);
      }

      u = url.parse('http://' + content);
      rendezvous(params, portno, u);
      if (responders < 15) register(params, portno);
    }).on('close', function() {
      logger.warning('register', { event:'close', diagnostic: 'premature eof', retry: '1 second' });

      retry(1);
    });
  }).on('error', function(err) {
    logger.error('register', { event: 'error', diagnostic: err.message, retry: '10 seconds' });

    retry(10);
  }).end();
  responders++;
};

var rendezvous = function(params, portno, u) {
  var didP, remote;

  var retry = function(secs) {
    if (didP) return;
    didP = true;

    if (responders > 0) responders--;
    setTimeout(function() { register(params, portno); }, secs * 1000);
  };

  didP = false;
  remote = new net.Socket({ allowHalfOpen: true });
  remote.on('connect', function() {
    var head, local;

    logger.debug('rendezvous', { event: 'connect', server: u.host });

    remote.setNoDelay(true);
    remote.setKeepAlive(true);

    head = null;
    local = null;
    remote.on('data', function(data) {
      head = (!!head) ? Buffer.concat([ head, data ]) : data;
      if (!!local) return;

      local = new net.Socket({ allowHalfOpen: true });
      local.on('connect', function() {
        logger.debug('rendezvous', { event: 'connect', server: '127.0.0.1:' + portno });

        local.setNoDelay(true);
        local.setKeepAlive(true);

        local.write(head);
        remote.pipe(local).pipe(remote);
      }).on('error', function(err) {
        logger.info('rendezvous', { event: 'error', server: '127.0.0.1:' + portno, diagnostic: err.message });

        try { remote.destroy(); } catch(ex) {}
      }).connect(portno, '127.0.0.1');

      retry(0);
    });
  }).on('close', function(errorP) {
    if (errorP) logger.error('rendezvous', { event: 'close', server: u.host });
    else        logger.debug('rendezvous', { event: 'close', server: u.host });

    retry(1);
  }).on('error', function(err) {
    if (err.errno === 'EMFILE') {
      logger.alert('rendezvous', { event: 'error', server: u.host, diagnostic: err.message });
      return process.exit(2);
    }
    logger.error('rendezvous', { event: 'error', server: u.host, diagnostic: err.message });

    retry(10);
  }).on('end', function() {
    logger.debug('rendezvous', { event: 'end', server: u.host });

    retry(5);
  }).connect(u.port, u.hostname);
};


var devices;

var subscribe = function(params) {
  var client, place, previous, priority, settings;

  place = params.labels[0] || params.name.split('.')[0];
  settings = { protocolId      : 'MQIsdp'
             , protocolVersion : 3
             , clientId        : place + '/steward'
             , username        : params.uuid[0]
             , password        : speakeasy.totp({ key      : params.base32
                                                , length   : 6
                                                , encoding : 'base32'
                                                , step     : params.step })
             , clean           : false
             , reconnectPeriod : 0
             };

  client = mqtt.createSecureClient(8883, params.server.hostname, settings).on('message', mqtt_onmessage).on('error',
  function(err) {
    logger.error('mqtt', { event: 'error', diagnostic: err.message });

    this.end();
    setTimeout(function() { subscribe(params); }, 600 * 1000);
  });
  client.subscribe('+/' + place + '/#', { qos: 1 });

  previous = {};
  priority = winston.config.syslog.levels.notice;
  broker.subscribe('beacon-egress', function(category, data) {
    var datum, device, deviceUID, i, now;

    if (!util.isArray(data)) data = [ data ];
    for (i = 0; i < data.length; i++) {
      datum = data[i];

      if ((!winston.config.syslog.levels[datum.level]) || (winston.config.syslog.levels[datum.level] < priority)) continue;

      if (!previous[datum.level]) previous[datum.level] = {};
      now = new Date(datum.date).getTime();
      if ((!!previous[datum.level][datum.message]) && (previous[datum.level][datum.message] > now)) continue;
      previous[datum.level][datum.message] = now + (60 * 1000);

      datum.category = category;

      client.publish('logs/' + place + '/steward', JSON.stringify(datum), { retain: true });

      if (!devices) devices = require('./device');
      for (deviceUID in devices.devices) {
        if ((!devices.devices.hasOwnProperty(deviceUID)) || (deviceUID.indexOf('mqtt:') !== 0)) continue;
        device = devices.devices[deviceUID].device;
        if ((!device) || (!device.priority) || (winston.config.syslog.levels[datum.level] < device.priority)) continue;

        client.publish(deviceUID.substring(5) + '/message', JSON.stringify(datum), { retain: true });
      }
    }
  });
};

var mqtt_onmessage = exports.mqtt_onmessage = function(topic, message, packet) {/* jshint unused: false */
    var device, entry, info, params, parts, status, udn;

    parts = topic.split('/');
    if (parts[0] === 'mqttitude') parts[0] = 'owntracks'; else if (parts[0] !== 'owntracks') return;

    try { entry = JSON.parse(message); } catch(ex) { return console.log(ex); }

    if ((!entry._type) || (!entry.tst)) return;

    status = entry._type === 'location' ? 'present' : 'recent';
    params = { lastSample: entry.tst * 1000 };
    if (entry._type === 'location') {
      params.location = [ entry.lat, entry.lon ];
      if (!!entry.alt) params.location.push(entry.alt);
      if (!!entry.acc) params.accuracy = parseFloat(entry.acc);
      if (!!entry.batt) params.batteryLevel = parseFloat(entry.batt);
    }

    if (!devices) devices = require('./device');
    udn = 'mqtt:' + parts.slice(0, 3).join('/');
    if (!!devices.devices[udn]) {
      device = devices.devices[udn].device;
      if (!device) return;    // not ready yet, drop it
      if (parts.length !== 3) return device.detail(device, entry);
      return device.update(device, params, status);
    }
    if (parts.length !== 3) return;

    info =  { source: 'mqtt', params: params };
    info.device = { url                          : null
                  , name                         : parts[2]
                  , manufacturer                 : ''
                  , model        : { name        : ''
                                   , description : ''
                                   , number      : ''
                                   }
                  , unit         : { serial      : topic
                                   , udn         : udn
                                   }
                  };

    info.url = info.device.url;
    info.deviceType = '/device/presence/' + parts[0] + '/mobile';
    info.id = info.device.unit.udn;

    logger.info('mqtt', { name: info.device.name, id: info.device.unit.serial,  params: info.params });
    devices.discover(info);
};
