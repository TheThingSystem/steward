var http        = require('http')
  , url         = require('url')
  , util        = require('util')
  , SSDP        = require('../steward/node_modules/node-ssdp')
  , xml2json    = require('../steward/node_modules/xml2json')
  ;

var locations = {};

new SSDP().on('response', function(msg, rinfo) {
  var f, fetch, i, info, j, location, lines, options;

  lines = msg.toString().split("\r\n");
  info = {};
  for (i = 1; i < lines.length; i++) {
    j = lines[i].indexOf(':');
    if (j <= 0) break;
    info[lines[i].substring(0, j)] = lines[i].substring(j + 1).trim();
  }

  f = function(location, headers, json) {
    console.log('');
    console.log(rinfo);
    console.log(info);
    if (!!location) console.log(location);
    if (!!headers) console.log(util.inspect(headers, { depth: null }));
    if (typeof json === 'string') console.log(json); else console.log(util.inspect(json, { depth: null }));
  };

  fetch = function(baseurl, path) {
    var x;

    x = baseurl.lastIndexOf('/');
    if (x !== -1) baseurl = baseurl.substr(0, x);
    if (path.indexOf('/') === 0) path = baseurl + path;

    http.request(url.parse(path), function(response) {
      var data = '';

      response.on('data', function(chunk) {
        data += chunk.toString();
      }).on('end', function() {
        var json;

        console.log('');
        console.log('>>> ' + path);
        console.log(util.inspect(response.headers, { depth: null }));
        try {
          json = JSON.parse(xml2json.toJson(data));
          console.log(util.inspect(json, { depth: null }));
        } catch(ex) {
          console.log(data);
        }
      }).on('close', function() {
        console.log('');
        console.log('>>> ' + path);
        console.log('socket: premature eof');
      }).setEncoding('utf8');
    }).on('error', function(err) {
      console.log('');
      console.log('>>> ' + path);
      console.log('socket error: ' + err.message);
    }).end();
  };

  location = info.LOCATION || info.Location;
  if (!!locations[location + info.ST]) return;
  locations[location + info.ST] = true;

  if (info.ST !== 'upnp:rootdevice') return f(location, null, 'not a UPnP root device, skipping...');

  options = url.parse(location);
  http.request(options, function(response) {
    var data = '';

    response.on('data', function(chunk) {
      data += chunk.toString();
    }).on('end', function() {
      var i, json, s;

      try {
        json = JSON.parse(xml2json.toJson(data));
        f(location, response.headers, json);
      } catch(ex) {
        return f(location, response.headers, data);
      }

      if ((!!json.root) && (!json.root.URLBase)) json.root.URLBase = options.protocol + '//' + options.host + '/';

      if ((!json.root) || (!json.root.device.serviceList) || (!util.isArray(json.root.device.serviceList.service))) return;

      for (i = 0; i < json.root.device.serviceList.service.length; i++) {
        s = json.root.device.serviceList.service[i];
        if (s.SCPDURL) fetch(json.root.URLBase, s.SCPDURL);
      }
    }).on('close', function() {
      f(location, null, 'socket: premature eof');
    }).setEncoding('utf8');
  }).on('error', function(err) {
    f(location, null, 'socket error: ' + err.message);
  }).end();
}).search('ssdp:all');
