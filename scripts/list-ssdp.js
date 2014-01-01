var http        = require('http')
  , url         = require('url')
  , SSDP        = require('../steward/node_modules/node-ssdp')
  , xml2json    = require('../steward/node_modules/xml2json')  
  ;

new SSDP().on('response', function(msg, rinfo) {
  var f, i, info, j, lines;

  lines = msg.toString().split("\r\n");
  info = {};
  for (i = 1; i < lines.length; i++) {
    j = lines[i].indexOf(':');
    if (j <= 0) break;
    info[lines[i].substring(0, j)] = lines[i].substring(j + 1).trim();
  }

  f = function() {
    console.log('');
    console.log(rinfo);
    console.log(info);
  };

  http.request(url.parse(info.LOCATION || info.Location), function(response) {
    var data = '';

    response.on('data', function(chunk) {
      data += chunk.toString();
    }).on('end', function() {
      f();
      console.log(xml2json.toJson(data));
    }).on('close', function() {
      f();
      console.log('socket premature eof');
    }).setEncoding('utf8');
  }).on('error', function(err) {
    f();
    console.log('socket error: ' + err.message);
  }).end();
}).search('ssdp:all');
