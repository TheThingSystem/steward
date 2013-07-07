var fs          = require('fs')
  , http        = require('http')
  , https       = require('https')
  , mime        = require('mime')
  , net         = require('net')
  , portfinder  = require('portfinder')
  , speakeasy   = require('speakeasy')
//, ssh_keygen  = require('ssh-keygen')
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

      ws.clientInfo = steward.clientInfo(request.connection);
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
        ws.close(404, 'not found');
        return;
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
      var meta = steward.clientInfo(request.connection);

      meta.event = 'request';
      logger.info(tag, meta);

      if (pathname === '/') pathname= '/index.html';
      if ((!meta.local) || (pathname.indexOf('/') !== 0) || (pathname.indexOf('..') !== -1)) {
        logger.info(tag, { event: 'not-allowed', code: 404 });
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('404 not found');
        return;
      }

      pathname = __dirname + '/../sandbox/' + pathname.slice(1);

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
          response.end(diagnostic);
          return;
        }

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

    logger.info('listening on ' + wssT + '://0.0.0.0:' + portno);

    if (httpsT === 'http') {
      fs.exists(__dirname + '/../db/' + steward.uuid + '.js', function(existsP) {
        if (existsP) rendezvous(require(__dirname + '/../db/' + steward.uuid).params, portno);
      });
    }

    if (!secureP) return;

    var hack = '0.0.0.0';
    http.createServer(function(request, response) {
      response.writeHead(302, { Location   :  httpsT + '://' + hack + ':' + portno
                              , Connection : 'close'
                              });
      response.end();
    }).on('connection', function(socket) {
      hack = socket.localAddress;
    }).on('listening', function() {
      logger.info('listening on http://0.0.0.0:80');
    }).on('error', function(err) {
      logger.info('unable to listen on http://0.0.0.0:80', { diagnostic: err.message });
    }).listen(80);

    utility.acquire(logger, __dirname + '/../discovery', /^discovery-.*\.js/, 10, -3, ' discovery', portno);
  });
};

var rendezvous = function(params, portno) {
  var options;

  options = { hostname : params.server.hostname
            , port     : params.server.port
            , ca       : new Buffer(params.server.ca)
            , path     : 'uuid:' + steward.uuid + '?response=' + speakeasy.totp({ key      : params.base32
                                                                                , length   : 6
                                                                                , encoding : 'base32'
                                                                                , step     : params.step })
            , method   : 'CONNECT'
            , agent    : false
            };

logger.debugX = logger.info;
  https.request(options).on('connect', function(response, cloud, head) {/* jshint unused: false */
    var buffer, didP, endP, local, readyP;

    logger.debugX('cloud', { event: 'connect' });

    cloud.setKeepAlive(true);
    logger.info('connected to https://' + options.hostname + ':' + options.port);

    didP = false;
    var next = function(secs) {
      if (didP) return;
      didP = true;

      setTimeout(function() { rendezvous(params, portno); }, secs * 1000);
    };

    buffer = head.toString();
    endP = readyP = false;
    cloud.on('data', function(data) {
      logger.debugX('cloud', { event: 'data', octets: data.toString().length });

      if (readyP) {
        try { local.write(data); } catch(ex) { logger.error('local', { event: 'write', diagnostic: ex.message }); }
        return;
      }

      buffer += data.toString();
      if (!!local) return;

      local = new net.Socket({ allowHalfOpen: true });
      local.on('connect', function() {
        logger.info('connected to http://127.0.0.1:' + portno);

        try { local.write(buffer); } catch(ex) { logger.error('local', { event: 'write', diagnostic: ex.message }); }

        local.setKeepAlive(true);
        next(0);
        readyP = true;

        if (endP) try { local.end(); } catch(ex) {}
      }).on('data', function(data) {
        logger.debugX('local', { event: 'data', octets: data.toString().length });
        try { cloud.write(data); } catch(ex) { logger.error('cloud', { event: 'write', diagnostic: ex.message }); }
      }).on('error', function(err) {
        logger.error('local', { event: 'error', diagnostic: err.message });
      }).on('end', function() {
        logger.debugX('local', { event: 'end' });

        try { cloud.end(); } catch(ex) {}
      }).on('close', function(errorP) {
        if (errorP) logger.error('local', { event: 'close '}); else logger.debugX('local', { event: 'close '});

        try { cloud.destroy(); } catch(ex) {}
      }).connect(portno, '127.0.0.1');

      next(0);
    }).on('error', function(err) {
      logger.debugX('cloud', { event: 'error', diagnostic: err.message, retry: '5 seconds' });

      if (!readyP) next(5);
    }).on('end', function() {
      logger.debugX('cloud', { event: 'end' });

      if (!readyP) { endP = true;          } else try { local.end();     } catch(ex) {}
    }).on('close', function(errorP) {
      if (errorP) logger.error('cloud', { event: 'close '}); else logger.debugX('cloud', { event: 'close '});

      if (!readyP) { endP = true; next(0); } else try { local.destroy(); } catch(ex) {}
    });
  }).on('error', function(err) {
    logger.error('cloud', { event: 'connect', diagnostic: err.message, retry: '30 seconds' });

    setTimeout(function() { rendezvous(params, portno); }, 30 * 1000);
  }).end();
};
