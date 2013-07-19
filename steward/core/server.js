var fs          = require('fs')
  , http        = require('http')
//, https       = require('https')
  , mime        = require('mime')
  , net         = require('net')
  , portfinder  = require('portfinder')
  , speakeasy   = require('speakeasy')
//, ssh_keygen  = require('ssh-keygen')
  , tls         = require('tls')
  , url         = require('url')
  , wsServer    = require('ws').Server
  , steward     = require('./steward')
  , utility     = require('./utility')
  ;
if ((process.arch !== 'arm') || (process.platform !== 'linux')) {
  var mdns      = require('mdns');
}


var logger = utility.logger('server');

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
        var meta = ws.clientInfo;

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

      if (request.method !== 'GET') {
        logger.info(tag, { event: 'not-allowed', code: 405 });
        response.writehead(405, { Allow: 'CONNECT' });
        return response.end();
      }

      if (pathname === '/') pathname= '/index.html';
// TBD: uncomment this later on
      if (/* (!meta.local) || */ (pathname.indexOf('/') !== 0) || (pathname.indexOf('..') !== -1)) {
        logger.info(tag, { event: 'not-allowed', code: 404 });
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        return response.end('404 not found');
      }

      if (pathname === '/uuid.js') {
        ct = 'var uuid = "' + steward.uuid + '";\n';

        logger.info(tag, { code: 200, octets: ct.length });
        response.writeHead(200, { 'Content-Type': 'application/javascript' });
        return response.end(ct);
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

        if (ct === 'text/html') data = data.toString().replace(/%%UUID%%/g, '?rendezvous=' + steward.uuid);

        logger.info(tag, { code: 200, octets: data.length });
        response.writeHead(200, { 'Content-Type': ct });
        response.end(data);
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

    if (!secureP) {
      fs.exists(__dirname + '/../db/' + steward.uuid + '.js', function(existsP) {
        if (existsP) rendezvous0(require(__dirname + '/../db/' + steward.uuid).params, portno);
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


/*
 * i have a theory:
 *
 *     https.request(...).on('connect', ...)
 *
 * is broken because the socket passed does ciphertext not plaintext.
 */

var rendezvous0 = function(params, port) {
  portfinder.getPort({ port: 8881 }, function(err, portno) {
    if (err) return logger.error('server', { event: 'portfinder.getPort 8881', diagnostic: err.message });

    http.createServer(function(request, response) {
      response.writehead(405, { Allow: 'CONNECT' });
      response.end();
    }).on('connect', function(request, socket, head) {
      var cleartext;

      cleartext = tls.connect({ host : params.server.hostname
                              , port : params.server.port
                              , ca   : new Buffer(params.server.ca)
                              }, function() {
        var h, hello, parts;

        logger.info('tls ' + params.server.hostname + ' ' + params.server.port);

        if (!cleartext.authorized) {
          logger.error('tlsproxy', { event: 'connect', diagnostic: cleartext.authorizationError });

          socket.write('HTTP/1.1 500 + \r\n\r\n');
          socket.end();
          return setTimeout(function() { try { socket.destroy(); } catch(ex) {} }, 1 * 1000);
        }

        parts = url.parse(request.url);
        hello = request.method + ' ' + parts.href + ' HTTP/' + request.httpVersion + '\r\n';
        for (h in request.headers) if (request.headers.hasOwnProperty(h)) hello += h + ': ' + request.headers[h] + '\r\n';
        hello += '\r\n';

        cleartext.write(hello);
        cleartext.write(head);
        socket.pipe(cleartext).pipe(socket);
      }).on('error', function(err) {
        logger.error('tlsproxy', { event: 'error', diagnostic: err.message });

        socket.write('HTTP/1.1 500 + \r\n\r\n');
        socket.end();
        setTimeout(function() { try { socket.destroy(); } catch(ex) {} }, 1 * 1000);
      });

    }).on('listening', function() {
      logger.info('tlsproxy listening on http://127.0.0.1:' + portno);

      rendezvous('127.0.0.1', portno, params, port);
    }).on('error', function(err) {
      logger.error('tlsproxy unable to listen on http://127.0.0.0:' + portno, { diagnostic: err.message });
    }).listen(portno, '127.0.0.1');
  });
};

var rendezvous = function(hostname, port, params, portno) {
  var didP, options;

  var retry = function(secs) {
    if (didP) return;
    didP = true;

    setTimeout(function() { rendezvous(hostname, port, params, portno); }, secs * 1000);
  };

  options = { hostname : hostname
            , port     : port
            , path     : 'uuid:' + steward.uuid + '?response=' + speakeasy.totp({ key      : params.base32
                                                                                , length   : 6
                                                                                , encoding : 'base32'
                                                                                , step     : params.step })
            , method   : 'CONNECT'
            , agent    : false
            };

  didP = false;
  http.request(options).on('connect', function(response, cloud, head) {/* jshint unused: false */
    var local;

    logger.info('cloud ' + options.hostname + ' ' + options.port);

    if (response.statusCode !== 200) {
      logger.error('proxy', { event: 'response', code: response.statusCode, retry: '15 seconds' });

      try { cloud.destroy(); } catch(ex) {}
      return retry(15);
    }

    cloud.setNoDelay(true);
    cloud.setKeepAlive(true);

    cloud.on('data', function(data) {
      head = Buffer.concat([ head, data]);
      if (!!local) return;

      local = new net.Socket({ allowHalfOpen: true });
      local.on('connect', function() {
        logger.debug('proxy', { event: 'connect' });

        local.setNoDelay(true);
        local.setKeepAlive(true);

        local.write(head);
        cloud.pipe(local).pipe(cloud);
      }).on('error', function(err) {
        logger.error('proxy', { event: 'error', diagnostic: err.message });
      }).connect(portno, '127.0.0.1');

      retry(0);
    }).on('error', function(err) {
      logger.error('cloud', { event: 'error', diagnostic: err.message, retry: '5 seconds' });

      retry(5);
    }).on('close', function(errorP) {
      if (errorP) logger.error('cloud', { event: 'close' }); else logger.debug('cloud', { event: 'close' });

      retry(1);
    });
  }).on('error', function(err) {
    logger.error('cloud', { event: 'connect', diagnostic: err.message, retry: '10 seconds' });

    retry(10);
  }).end();
};
