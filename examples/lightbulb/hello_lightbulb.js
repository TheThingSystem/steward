#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

var http = require("http");
var util = require("util");
var url = require("url");
var WebSocket = require('ws');

function onRequest(request, response) {	
	var ws;
	
	console.log("Request recieved.");
    var pathname = url.parse(request.url).pathname;
	response.writeHead(200, {"Content-Type":"text/html"});
	
	ws = new WebSocket('wss://localhost:8888/manage');
	console.log("Created websocket.");	
	
	ws.onopen = function(event) {
		console.log("Opened websocket to steward.");
		if ( pathname == "/on") {
			var json = JSON.stringify({ path      :'/api/v1/actor/perform/device/lighting', 
		                             requestID :'1', 
		                             perform   :'on', 
		                             parameter :JSON.stringify({ brightness: 100, 
			                                      transition: 2, 
			                                      interval:'once', 
			                                      effect:'none', 
			                                      color: { model: 'rgb', rgb: { r: 255, g: 255, b: 255 }}})
		                            });
		    ws.send(json);	
			
		} else if ( pathname == "/off") {
			var json = JSON.stringify({ path      :'/api/v1/actor/perform/device/lighting', 
		                             requestID :'2', 
		                             perform   :'off', 
		                             parameter :''
		                           });			
		    ws.send(json);
			
		} else {
			response.write("<h2>Unrecognised request</h2>");
			ws.close(); 
			response.end();
		}
  	};

 	ws.onmessage = function(event) {
    	console.log("Socket message: " + util.inspect(event.data));
        response.write( "<h2>Turning lightbulb '" + pathname +"'</h2>" + util.inspect(event.data, {depth: null}));
		ws.close(); 
		response.end();

    };

    ws.onclose = function(event) {
  		console.log("Socket closed: " + util.inspect(event.wasClean));

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
