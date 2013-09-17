var fs          = require('fs')
  , http        = require('http')
  , https       = require('https')
  , mime        = require('mime')
  , net         = require('net')
  , portfinder  = require('portfinder')
  , speakeasy   = require('speakeasy')
//, ssh_keygen  = require('ssh-keygen')
//, tls         = require('tls')
  , url         = require('url')
  , wsServer    = require('ws').Server
  , steward     = require('./steward')
  , utility     = require('./utility')
  ;
if ((process.arch !== 'arm') || (process.platform !== 'linux')) {
  var mdns      = require('mdns');
}


var logger = utility.logger('server');

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

  utility.acquire(logger, __dirname + '/../routes', /^route-.*\.js/, 6, -3, ' route');
};

var start = function(port, secureP) {
  portfinder.getPort({ port: port }, function(err, portno) {
    var server;

    var crt     = __dirname + '/../sandbox/server.crt'
      , httpsT  = 'http'
      , key     = __dirname + '/../db/server.key'
      , options = { port : portno }
      , wssT  = 'ws'
      ;

    if (err) return logger.error('server', { event: 'portfinder.getPort ' + port, diagnostic: err.message });

    if (secureP) {
      if (fs.existsSync(key)) {
        if (fs.existsSync(crt)) {
          options.key = key;
          options.cert = crt;
          httpsT = 'https';
          wssT = 'wss';

          exports.x509 = { key: key, crt: crt };
        } else return logger.error('no startup certificate', { cert: crt });
      } else return logger.error('no startup key', { key: key });
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
      });

      if (!routes[pathname]) {
        logger.warning(tag, { event: 'route', transient: false, diagnostic: 'unknown path: ' + pathname });
        return ws.close(404, 'not found');
      }

// NB: each route is responsible for access control, both at start and per-message
      (routes[pathname].route)(ws, tag);
    }).on('error', function(err) {
      logger.error('server', { event: 'ws.error', diagnostic: err.message });
    })._server;
    server.removeAllListeners('request');
    server.on('request', function(request, response) {
      var ct;

      var pathname = url.parse(request.url).pathname;
      var tag = httpsT + ' ' + request.connection.remoteAddress + ' ' + request.connection.remotePort + ' ' + pathname;
      var meta = steward.clientInfo(request.connection, secureP);

      meta.event = 'request';
      meta.method = request.method;
      logger.info(tag, meta);

      if ((request.method !== 'GET') && (request.method !== 'HEAD')) {
        logger.info(tag, { event: 'invalid method', code: 405, method: request.method });
        response.writeHead(405, { Allow: 'CONNECT' });
        return response.end();
      }

      pathname = { '/'        : '/index.html'
                 , '/client'  : '/client.html'
                 , '/console' : '/console.html' 
                 }[pathname] || pathname;

      if (!places) places = require('./../actors/actor-place');

/* NB: everything "interesting" should be via WebSockets, not HTML...
       if that changes, we can add an exception list here.

      if ((!places.place1.info.insecure) && (!steward.readP(meta))) {
        delete(meta.method);

        meta.event = 'access';
        meta.diagnostic = 'unauthorized';
        meta.resource = pathname;
        logger.warning(tag, meta);

        response.writeHead(403, { 'Content-Type': 'text/plain' });
        return response.end('403 not allowed');
      }
 */

      if ((pathname.indexOf('/') !== 0) || (pathname.indexOf('..') !== -1)) {
        logger.info(tag, { event: 'invalid path', code: 404 });
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        return response.end('404 not found');
      }

      pathname = __dirname + '/../sandbox/' + decodeURI(pathname.slice(1));

      ct = mime.lookup(pathname);

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
        response.writeHead(200, { 'Content-Type': ct, 'Content-Length': data.length });
        response.end(request.method === 'GET' ? data : '');
      });
    });

    if (!!mdns) {
      mdns.createAdvertisement(mdns.tcp(wssT), portno, { name: 'steward', txtRecord: { uuid : steward.uuid } })
          .on('error', function(err) { logger.error('mdns', { event      : 'createAdvertisement steward ' + wssT + ' ' + portno
                                                            , diagnostic : err.message }); })
          .start();
      mdns.createAdvertisement(mdns.tcp(httpsT), portno, { name: 'steward', txtRecord : { uuid: steward.uuid } })
          .on('error', function(err) { logger.error('mdns', { event      : 'createAdvertisement steward ' + httpsT+ ' ' + portno
                                                            , diagnostic : err.message }); })
          .start();
    }

    logger.info('listening on ' + wssT + '://*:' + portno);

    if (secureP) {
      fs.exists(__dirname + '/../db/' + steward.uuid + '.js', function(existsP) {
        if (existsP) register(require(__dirname + '/../db/' + steward.uuid).params, portno);
      });

      return;
    }

    var hack = '0.0.0.0';
    http.createServer(function(request, response) {
      response.writeHead(302, { Location   :  httpsT + '://' + hack + ':' + portno
                              , Connection : 'close'
                              });
      response.end();
    }).on('connection', function(socket) {
      hack = socket.localAddress;
    }).on('listening', function() {
      logger.info('listening on http://*:80');
    }).on('error', function(err) {
      logger.info('unable to listen on http://*:80', { diagnostic: err.message });
    }).listen(80);

    utility.acquire(logger, __dirname + '/../discovery', /^discovery-.*\.js/, 10, -3, ' discovery', portno);
  });
};


exports.vous = null;

var responders = 0;

var register = function(params, portno) {
  var didP, options, u;

  var retry = function(secs) {
    if (didP) return;
    didP = true;

    if (responders > 0) responders--;
    setTimeout(function() { register(params, portno); }, secs * 1000);
  };

  if (!exports.vous) exports.vous = params.name;

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
      if (responders < 5) register(params, portno);
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
    logger.error('rendezvous', { event: 'error', server: u.host, diagnostic: err.message });

    retry(10);
  }).on('end', function() {
    logger.warning('rendezvous', { event: 'end', server: u.host });

    retry(5);
  }).connect(u.port, u.hostname);
};
