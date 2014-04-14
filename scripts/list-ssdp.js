var http        = require('http')
  , url         = require('url')
  , util        = require('util')
  , SSDP        = require('../steward/node_modules/node-ssdp')
  , xml2json    = require('../steward/node_modules/xml2json')  
  ;

var locations = {};

new SSDP().on('response', function(msg, rinfo) {
  var f, fetch, i, info, j, location, lines;

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
        console.log('');
        console.log(path);
        console.log(xml2json.toJson(data));
      }).on('close', function() {
        console.log('');
        console.log(path + ': socket premature eof');
      }).setEncoding('utf8');
    }).on('error', function(err) {
      console.log('');
      console.log(path + ': socket error - ' + err.message);
    }).end();
  };

  location = info.LOCATION || info.Location;
  if (!!locations[location]) return;
  locations[location] = true;

  http.request(url.parse(location), function(response) {
    var data = '';

    response.on('data', function(chunk) {
      data += chunk.toString();
    }).on('end', function() {
      var i, json, s;

      f();
      try { json = JSON.parse(xml2json.toJson(data)); } catch(ex) { return console.log(data); }
      console.log(util.inspect(json, { depth: null }));

      if ((!json.root) || (!json.root.URLBase)
            || (!json.root.device.serviceList) || (!util.isArray(json.root.device.serviceList.service))) return;

      for (i = 0; i < json.root.device.serviceList.service.length; i++) {
        s = json.root.device.serviceList.service[i];

        if (s.SCPDURL) fetch(json.root.URLBase, s.SCPDURL);
        if (s.controlURL) fetch(json.root.URLBase, s.controlURL);
        if (s.eventSubURL) fetch(json.root.URLBase, s.eventSubURL);
      }

    }).on('close', function() {
      f();
      console.log('socket premature eof');
    }).setEncoding('utf8');
  }).on('error', function(err) {
    f();
    console.log('socket error: ' + err.message);
  }).end();
}).search('ssdp:all');
