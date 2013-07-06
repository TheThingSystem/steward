#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

var http = require("http");
var util = require("util");
var WebSocket = require('ws');

function onRequest(request, response) {	
	var ws;
	
	console.log("Request recieved.");
	response.writeHead(200, {"Content-Type":"text/plain"});
	
	ws = new WebSocket('wss://localhost:8888/manage');
	console.log("Created websocket.");	
	
	ws.onopen = function(event) {
		console.log("Opened websocket to steward.");
		response.write("Turning all lights on.");
		
		var json = JSON.stringify({ path      :'/api/v1/actor/perform/device/lighting', 
	                             	requestID :'3', 
	                             	perform   : 'on',
									parameter : JSON.stringify({ 
										          brightness: 100, 
			                                      transition: 2, 
			                                      interval:'once', 
			                                      effect:'none', 
			                                      color: { model: 'rgb', rgb: { r: 255, g: 0, b: 0 }}})
	                              });
	    ws.send(json);
		response.end();

  	};

 	ws.onmessage = function(event) {
    	console.log("Socket message: " + event.data);
		ws.close(); 

    };

    ws.onclose = function(event) {
  		console.log("Socket closed: " + event.wasClean );

    };

    ws.onerror = function(event) {
  		console.log("Socket error: " + util.inspect(event, depth=4));
	    try { 
			ws.close (); 
			console.log("Closed websocket.");
		} catch (ex) {}
    };

}

var server = http.createServer(onRequest).listen(9999);
console.log("Server started on port 9999.");


