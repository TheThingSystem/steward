// KumoApp monitoring

var KumoAppTSRP = require('kumoapp-tsrp')
  , http        = require('http')
  , trsp        = require('./discovery-tsrp')
  , utility     = require('./../core/utility')
  ;


var logger = utility.logger('discovery');

exports.start = function() {
  var kumoapp, portno, rinfo, tag;

  kumoapp = new KumoAppTSRP({ logger: logger });

// TBD: bind rinfo/tag as a part of toTSRP()...

  kumoapp.on('message', function(message) {
    trsp.handle(message, rinfo.address, tag);
  });

  portno = 8885;
  http.createServer(function(request, response) {
    var body = '';

    var done = function(code, s, ct) {
      if (code === 405) {
        response.writeHead(405, { Allow: 'PUT' });
        return response.end();
      }

      if (!s) return response.end();

      response.writeHead(code, { 'Content-Type': ct || 'application/json' });
      response.end(s);
    };

    var loser = function(err) {
      logger.warning('discovery-kumoapp', { event: 'loser', diagnostic: err.message });
      return done(200, JSON.stringify({ error: err }));
    };

    if (request.method !== 'PUT') return done(405);

    request.on('data', function(data) {
      body += data.toString();
    }).on('close', function() {
      logger.warning('discovery-kumoapp', { event: 'http', diagnostic: 'premature close' });
    }).on('end', function() {
      var message;

      try { message = kumoapp.toTSRP(JSON.parse(body)); } catch(ex) { return loser(ex); }
      if (!message) return done(200);

      rinfo = { address: request.socket.remoteAddress, port: request.socket.remotePort };
      tag = 'tcp ' + rinfo.address + ' ' + rinfo.port;

      trsp.handle(message, rinfo.address, tag);

      done(200);
    });
  }).on('listening', function() {
    logger.info('listening on http://*:' + portno);
  }).on('error', function(err) {
    logger.error('discovery-kumoapp', { event: 'http', diagnostic: err.message });
  }).listen(portno);
};
