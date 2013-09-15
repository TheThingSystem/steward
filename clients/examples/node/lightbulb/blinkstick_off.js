#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

var http = require("http");
var util = require("util");
var WebSocket = require('ws');

function onRequest(request, response) {	
	var ws;
	
	console.log("Request recieved.");
	response.writeHead(200, {"Content-Type":"text/plain"});
	
	ws = new WebSocket('ws://127.0.0.1:8887/manage');
	console.log("Created websocket.");	
	
	ws.onopen = function(event) {
		console.log("Opened websocket to steward.");
		response.write("Turning blinkstick off.");
		
		var json = JSON.stringify({ path      :'/api/v1/actor/perform/device/lighting/blinkstick', 
	                             	requestID :'1', 
	                             	perform   :'off', 
	                             	parameter :''
	                              })
	    ws.send(json);

  	};

 	ws.onmessage = function(event) {
    	console.log("Socket message: " + event.data);
		ws.close(); 

    };

    ws.onclose = function(event) {
  		console.log("Socket closed: " + event.wasClean );
		response.end();

    };

    ws.onerror = function(event) {
  		console.log("Socket error: " + util.inspect(event, {depth: null}));
	    try { 
			ws.close(); 
			console.log("Closed websocket.");
		} catch (ex) {}
    };

}

var server = http.createServer(onRequest).listen(9999);
console.log("Server started on port 9999.");


