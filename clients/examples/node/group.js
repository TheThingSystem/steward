#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

var util = require("util");
var WebSocket = require('ws');

var ws = new WebSocket('ws://steward.local:8887/manage');
console.log("Created websocket.");

ws.onopen = function(event) {
	console.log("Opened websocket to steward.");
	var json = JSON.stringify({ path:'/api/v1/group/create/123', 
		                        requestID :'1', 
								name : 'Lights',
		                        members   : [ 'device/1', 'device/6' ] });
	console.log("JSON: " + json);
	ws.send(json);
};

ws.onmessage = function(event) {
	var str = JSON.stringify(JSON.parse(event.data), null, 2);
	console.log("Socket message: " + str);
    ws.close();
};

ws.onclose = function(event) {
	console.log("Socket closed: " + event.wasClean );

};

ws.onerror = function(event) {
	console.log("Socket error: " + util.inspect(event, {depth: null}));
    try { 
		ws.close (); 
		console.log("Closed websocket.");
	} catch (ex) {}
};