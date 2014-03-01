var fs          = require('fs')
  , http        = require('http')
  , https       = require('https')
  , net         = require('net')
  , portfinder  = require('portfinder')
  , speakeasy   = require('speakeasy')
  , url         = require('url')
  , util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('gateway');


exports.start = function() {
  steward.actors.device.gateway = { $info: { type: '/device/gateway' }};

  utility.acquire(logger, __dirname + '/devices-gateway', /^gateway-.*\.js$/, 8, -3, ' gateway');
};


var Gateway = exports.Device = function() {
  var self = this;

  self.whatami = '/device/gateway';
};
util.inherits(Gateway, devices.Device);


Gateway.prototype.lookup = function(service, callback, listener) {
  var self = this;

  fs.exists(__dirname + '/../db/' + steward.uuid + '.js', function(existsP) {
    var i, params, options, prefix, portno, x;

    if (!existsP) return;
    params = require(__dirname + '/../db/' + steward.uuid).params;

    prefix = service + '.';
    for (i = 0; i < params.labels.length; i++) if (params.labels[i].indexOf(prefix) === 0) break;
    if (i >= params.labels.length) throw callback(new Error('no label for ' + prefix));

    portno = params.labels[i];
    x = portno.indexOf(':');
    if (x === -1) return callback(Error('invalid params.labels[' + i + ']='+params.labels[i]));
    portno = portno.substring(x + 1);

// pity we have to nest...
    portfinder.getPort({ port: 8890 }, function(err, proxy) {
      if (!!err) return callback(err);

      options = { service: service, params: params, ipaddr: prefix + params.name, portno: portno, proxy: proxy };

      portfinder.getPort({ port: options.proxy + 1 }, function(err, secure) {
        if (!!err) return callback(err);

        options.secure = secure;
        https.createServer({ key  : fs.readFileSync(__dirname + '/../db/server.key')
                           , cert : fs.readFileSync(__dirname + '/../sandbox/server.crt') },
                           listener).listen(options.secure, function() {

          portfinder.getPort({ port: options.secure + 1 }, function(err, plain) {
            if (!!err) return callback(err);

            options.plain = plain;
            http.createServer(listener).listen(options.plain, function() {

              net.createServer(function(socket) {
                socket.once('data', function(data) {
                  var proxy = net.createConnection(data[0] === 22 ? options.secure : options.plain, function() {
                    proxy.write(data);
                    socket.pipe(proxy).pipe(socket);
                  });
                });
              }).listen(options.proxy, function() {
                callback(null, options);

                self.responders = 0;
                self.register(self, options.service, options.params, options.proxy);
              });
            });
          });
        });
      });
    });
  });
};


Gateway.prototype.register = function(self, service, params, portno) {
  var didP, options, u;

  var retry = function(secs) {
    if (didP) return;
    didP = true;

    if (self.responders > 0) self.responders--;
    setTimeout(function() { self.register(self, service, params, portno); }, secs * 1000);
  };

  u = url.parse(params.issuer);
  options = { host    : params.server.hostname
            , port    : params.server.port
            , method  : 'PUT'
            , path    : '/register/' + service + '.' + params.labels[0]
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

      u = url.parse('https://' + content);
      self.rendezvous(self, service, params, portno, u);
      if (self.responders < 2) self.register(self, service, params, portno);
    }).on('close', function() {
      logger.warning('register', { event:'close', diagnostic: 'premature eof', retry: '1 second' });

      retry(1);
    });
  }).on('error', function(err) {
    logger.error('register', { event: 'error', diagnostic: err.message, retry: '10 seconds' });

    retry(10);
  }).end();
  self.responders++;
};

Gateway.prototype.rendezvous = function(self, service, params, portno, u) {
  var didP, remote;

  var retry = function(secs) {
    if (didP) return;
    didP = true;

    if (self.responders > 0) self.responders--;
    setTimeout(function() { self.register(self, service, params, portno); }, secs * 1000);
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
    logger.debug('rendezvous', { event: 'end', server: u.host });

    retry(5);
  }).connect(u.port, u.hostname);
};
