var fs          = require('fs')
  , mime        = require('mime')
  , portfinder  = require('portfinder')
  , url         = require('url')
  , wsServer    = require('ws').Server
  , utility     = require('./utility')
  ;
if ((process.arch !== 'arm') || (process.platform !== 'linux')) {
  var mdns      = require('mdns');
}


var logger = utility.logger('server');

var routes = exports.routes = {};


exports.start = function() {
  portfinder.getPort({ port: 8888 }, function(err, portno) {
    var server;

    var crt     = __dirname + '/../sandbox/startup.crt'
      , httpsT  = 'http'
      , key     = __dirname + '/../db/startup.key'
      , options = { port : portno }
      , wssT  = 'ws'
      ;

    if (fs.existsSync(key)) {
      if (fs.existsSync(crt)) {
        options.key = key;
        options.cert = crt;
        httpsT = 'https';
        wssT = 'wss';
      } else {
        logger.warning('no startup certificate', { cert: crt });
      }
    } else {
      logger.warning('no startup key', { key: key });
    }

    if (err) {
      logger.error('server', { event: 'portfinder.getPort 8888', diagnostic: err.message });
      return;
    }

    server = new wsServer(options).on('connection', function(ws) {
      var request = ws.upgradeReq;
      var pathname = url.parse(request.url).pathname;
      var tag = wssT + ' ' + request.connection.remoteAddress + ' ' + request.connection.remotePort + ' ' + pathname;

      logger.info(tag, { event: 'connection' });

      ws.on('error', function(err) {
        logger.info(tag, { event: 'error', message: err });
      });
      ws.on('close', function(code, message) {
        logger.info(tag, { event: 'close', code: code, message: message });
      });

      if (!routes[pathname]) {
        logger.warning(tag, { event: 'route', transient: false, diagnostic: 'unknown path: ' + pathname });
        ws.close(404, 'not found');
        return;
      }

// TBD: access control based on remoteAddress & token

      (routes[pathname].route)(ws, tag);
    }).on('error', function(err) {
      logger.error('server', { event: 'ws.error', diagnostic: err.message });
    })._server;
    server.removeAllListeners('request');
    server.on('request', function(request, response) {
      var ct;

      var pathname = url.parse(request.url).pathname;
      var tag = httpsT + ' ' + request.connection.remoteAddress + ' ' + request.connection.remotePort + ' ' + pathname;

      logger.info(tag, { event: 'request' });

// TBD: access control based on remoteAddress & token

      if (pathname == '/') pathname= '/index.html';
      if ((pathname.indexOf('/') !== 0) || (pathname.indexOf('..') !== -1)) {
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

    var uuid = require('./steward').uuid;
    if (!!mdns) {
      mdns.createAdvertisement(mdns.tcp(wssT), portno, { name: 'steward', txtRecord: { uuid : uuid } })
          .on('error', function(err) { logger.error('mdns', { event      : 'createAdvertisement steward ' + wssT + ' ' + portno
                                                            , diagnostic : err.message }); })
          .start();
      mdns.createAdvertisement(mdns.tcp(httpsT), portno, { name: 'steward', txtRecord : { uuid: uuid } })
          .on('error', function(err) { logger.error('mdns', { event      : 'createAdvertisement steward ' + httpsT+ ' ' + portno
                                                            , diagnostic : err.message }); })
          .start();
    }

    logger.info('listening on ' + wssT + '://0.0.0.0:' + portno);

    utility.acquire(logger, __dirname + '/../discovery', /^discovery-.*\.js/, 10, -3, ' discovery', portno);
  });

  utility.acquire(logger, __dirname + '/../routes', /^route-.*\.js/, 6, -3, ' route');
};
