// Thing Sensor Reporting Protocol

var dgram       = require('dgram')
  , util        = require('util')
  , xml         = require('xml2json')
  , trsp		= require('./discovery-tsrp')
  , devices     = require('./../core/device')
  , things      = require('./../api/api-manage-thing')
  , utility     = require('./../core/utility')
  ;


var logger = utility.logger('discovery');

exports.start = function() {
 	var LOCAL_BROADCAST_HOST = '224.192.32.19';
	var LOCAL_BROADCAST_PORT = 22600;
	var bootTime = process.hrtime()[0] * 1000 + process.hrtime()[1] / 1000;
	var requestID = 0;
	
	var socket = dgram.createSocket('udp4');
	socket.bind(LOCAL_BROADCAST_PORT, function() {
		socket.addMembership(LOCAL_BROADCAST_HOST);
	});
	
	socket.on('message', function(message, rinfo) {
    	var report;

    	try { 
			var json = xml.toJson( message );
			var buff = JSON.parse( json );
			var currTime = process.hrtime()[0] * 1000 + process.hrtime()[1] / 1000;
			requestID = requestID+1;
			
			if ( buff.electricity ) {			
				logger.info('Recieved OWL electricity packet.');
				var battery = buff.electricity.battery.level.substring(0, buff.electricity.battery.level.length - 1);
			
				var channel0, channel1, channel2 = null;
				buff.electricity.chan.forEach(function(entry) {
				    if( entry.id === 0 ) {
						channel0 = [{'current':entry.curr.$t,'units':entry.curr.units},
									{'day':entry.day.$t,'units':entry.day.units}];
					}
					if( entry.id === 1 ) {
						channel1 = [{'current':entry.curr.$t,'units':entry.curr.units},
									{'day':entry.day.$t,'units':entry.day.units}];
					}
					if( entry.id === 2 ) {
						channel2 = [{'current':entry.curr.$t,'units':entry.curr.units},
									{'day':entry.day.$t,'units':entry.day.units}];
					}
				});
				
				report = {"path":"/api/v1/thing/reporting",
 		  		          "requestID":requestID.toString(),
				   		  "things":{
				      		"/device/sensor/owl/electricity":{
				         		"prototype":{
				            		"device":{
				               			"name":"OWL Intuition-e",
				               			"maker":"2 Save Energy Ltd"
				            		},
				            		"name":true,
				            		"status":[ "present", "absent", "recent"],
				            		"properties":{ "rssi":"dB", "lqi":"", "battery":"%", "currentUsage":"W", "dailyUsage":"Wh" }
				         		},
				         		"instances":[{
				               		"name":"OWL Intuition-e",
				               		"status":"present",
				               		"unit":{
				                  		"serial":buff.electricity.id,
				                  		"udn":"195a42b0-ef6b-11e2-99d0-UID"+buff.electricity.id+"-owl-electricity-monitor"
				               		},
				               		"info":{
				                  		"rssi":buff.electricity.signal.rssi,
										"lqi":buff.electricity.signal.lqi,
										"battery":battery,
				                  		"currentUsage":channel0[0].current,
				                  		"dailyUsage":channel0[1].day
				               		},
				               		"uptime":currTime-bootTime
				            	}]
							}
				   		}
						};			
			
			} else if ( buff.heating ) {
				logger.info('Recieved OWL heating packet.');
				var battery = buff.heating.battery.level.substring(0, buff.heating.battery.level.length - 2);
				report = {"path":"/api/v1/thing/reporting",
 		  		  		  "requestID":requestID.toString(),
				   		  "things":{
				      		"/device/climate/owl/control":{
				         		"prototype":{
				            		"device":{
				               			"name":"OWL Intuition-c",
				               			"maker":"2 Save Energy Ltd"
				            		},
				            		"name":true,
				            		"status":[ "present", "absent", "recent"],
				            		"properties":{ "rssi":"dB", "lqi":"", "battery":"mV", "temperature":"celsius", "goalTemperature":"celsius",
				                                   "until":"","zone":"" }
				         		},
				         		"instances":[{
				               		"name":"OWL Intuition-c",
				               		"status":"present",
				               		"unit":{
				                  		"serial":buff.heating.id,
				                  		"udn":"195a42b0-ef6b-11e2-99d0-UID"+buff.heating.id+"-owl-thermostat"
				               		},
				               		"info":{
				                  		"rssi":buff.heating.signal.rssi,
										"lqi":buff.heating.signal.lqi,
										"battery":battery,
				                  		"temperature":buff.heating.temperature.current,
				                  		"goalTemperature":buff.heating.temperature.required,
										"until":buff.heating.temperature.until,
										"zone":buff.heating.temperature.zone.toString()
				               		},
				               		"uptime":currTime-bootTime
				            	}]
							}
				   		}
						};
		
		 	} else if ( buff.weather ) {
				logger.info('Recieved OWL weather packet.');
				report = {"path":"/api/v1/thing/reporting",
		   		  		  "requestID":requestID.toString(),
				   		  "things":{
				      		"/device/climate/owl/sensor":{
				         		"prototype":{
				            		"device":{
				               			"name":"Network OWL",
				               			"maker":"2 Save Energy Ltd"
				            		},
				            		"name":true,
				            		"status":[ "present", "absent", "recent"],
				            		"properties":{ "code":"", "temperature":"celsius", "text":"" }
				         		},
				         		"instances":[{
				               		"name":"OWL Weather",
				               		"status":"present",
				               		"unit":{
				                  		"serial":buff.weather.id,
				                  		"udn":"195a42b0-ef6b-11e2-99d0-UID"+buff.weather.id+"-owl-weather"
				               		},
				               		"info":{
				                  		"code":buff.weather.code,
				                  		"temperature":buff.weather.temperature,
				                  		"text":buff.weather.text
				               		},
				               		"uptime":currTime-bootTime
				            	}]
							}
				   		}
						};
		
			} else if ( buff.solar ) {
				logger.info('Recieved OWL solar packet.');
				report = {"path":"/api/v1/thing/reporting",
				  		  "requestID":requestID.toString(),
				   		  "things":{
				      		"/device/sensor/owl/solarpanels":{
				         		"prototype":{
				            		"device":{
				               			"name":"OWL Intuition-pv",
				               			"maker":"2 Save Energy Ltd"
				            		},
				            		"name":true,
				            		"status":[ "present", "absent", "recent"],
				            		"properties":{ "generating":"W", "exporting":"W" }
				         		},
				         		"instances":[{
				               		"name":"OWL Intuition-pv",
				               		"status":"present",
				               		"unit":{
				                  		"serial":buff.solar.id,
				                  		"udn":"195a42b0-ef6b-11e2-99d0-UID"+buff.solar.id+"-owl-solarpanel"
				               		},
				               		"info":{
				                  		"generating":buff.solar.current.generating,
				                  		"exporting":buff.solar.current.exporting
				               		},
				               		"uptime":currTime-bootTime
				            	}]
							}
				   		}
						};		
			}
			
			//console.log(util.inspect(report, false, null));
			trsp.handle(report, rinfo.address, 'udp ' + rinfo.address + ' ' + rinfo.port + ' ' + report.path);
	    } catch(ex) {
		    logger.error('reporting', { event: 'parsing', diagnostic: ex.message });
      		return;
    	}
  	});

  	socket.on('listening', function() {
    	var address = this.address();
		logger.info('OWL driver listening on udp://*:' + address.port);
  	});

	socket.on('error', function(err) {
    	logger.error('reporting', { event: 'socket', diagnostic: err.message });
  	})

	
};
