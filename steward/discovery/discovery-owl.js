// Owl Intution monitoring

var dgram       = require('dgram')
  , xml         = require('xml2json')
  , trsp        = require('./discovery-tsrp')
  , utility     = require('./../core/utility')
  ;


var logger = utility.logger('discovery');

exports.start = function() {
  var LOCAL_BROADCAST_HOST = '224.192.32.19';
  var LOCAL_BROADCAST_PORT = 22600;
  var bootTime = process.hrtime()[0] * 1000 + process.hrtime()[1] / 1000;
  var requestID = 0;

  dgram.createSocket('udp4').on('message', function(message, rinfo) {
      var report;

      try {
        var json = xml.toJson( message );
        var buff = JSON.parse( json );
        var currTime = process.hrtime()[0] * 1000 + process.hrtime()[1] / 1000;
        requestID = requestID+1;

        if ( buff.electricity ) {
          logger.info('Received OWL electricity packet.');

          var channels = [{}, {}, {}];
          buff.electricity.chan.forEach(function(entry) {
            channels[entry.id] = { 'current': entry.curr.$t, 'daily': entry.day.$t };
          });

// not reporting because we don't know the units: lqi
          report = { "path"                             : "/api/v1/thing/reporting"
                   , "requestID"                        : requestID.toString()
                   , "things":
                     { "/device/sensor/owl/meter"       :
                       { "prototype"                    :
                         { "device"                     :
                           { "name"                     : "OWL Intuition-e"
                           , "maker"                    : "2 Save Energy Ltd"
                           }
                         , "name"                       : true
                         , "status"                     : [ "present", "absent", "recent"]
                         , "properties":
                           { "currentUsage"             : "watts"
                           , "dailyUsage"               : "watt-hours"
                           , "rssi"                     : "s8"
                           , "batteryLevel"             : "percentage"
                           }
                         }
                       , "instances"                    :
                         [ { "name"                     : "OWL Intuition-e"
                           , "status"                   : "present"
                           , "unit"                     :
                             { "serial"                 : buff.electricity.id
                             , "udn"                    : "195a42b0-ef6b-11e2-99d0-UID"+buff.electricity.id+"-owl-electricity"
                             }
                           , "info"                     :
                             { "currentUsage"           : [ channels[0].current, channels[1].current, channels[2].current ]
                             , "dailyUsage"             : [ channels[0].daily,   channels[1].daily,   channels[2].daily   ]
                             , "rssi"                   : buff.electricity.signal.rssi
                             , "batteryLevel"           : parseFloat(buff.electricity.battery.level)
                             }
                           , "uptime"                   : currTime-bootTime
                           }
                         ]
                       }
                     }
                   };

        } else if ( buff.heating ) {
          logger.info('Received OWL heating packet.');

// not reporting because we don't know the units: lqi; or we don't care: until/zone
          report = { "path"                             : "/api/v1/thing/reporting"
                   , "requestID"                        : requestID.toString()
                   , "things":
                     { "/device/climate/owl/monitor"    :
                       { "prototype"                    :
                         { "device"                     :
                           { "name"                     : "OWL Intuition-c"
                           , "maker"                    : "2 Save Energy Ltd"
                           }
                         , "name"                       : true
                         , "status"                     : [ "present", "absent", "recent"]
                         , "properties":
                           { "temperature"              : "celsius"
                           , "goalTemperature"          : "celsius"
                           , "rssi"                     : "s8"
                           , "battery"                  : "volts"
                           }
                         }
                       , "instances"                    :
                         [ { "name"                     : "OWL Intuition-c"
                           , "status"                   : "present"
                           , "unit"                     :
                             { "serial"                 : buff.heating.id
                             , "udn"                    : "195a42b0-ef6b-11e2-99d0-UID"+buff.heating.id+"-owl-thermostat"
                             }
                           , "info"                     :
                             { "temperature"            : buff.heating.temperature.current
                             , "goalTemperature"        : buff.heating.temperature.required
                             , "rssi"                   : buff.heating.signal.rssi
                             , "battery"                : parseFloat(buff.heating.battery.level.toString()) / 1000.0
                             }
                           , "uptime"                   : currTime-bootTime
                           }
                         ]
                       }
                     }
                   };

        } else if ( buff.weather ) {
          logger.info('Received OWL weather packet.');

          report = { "path"                             : "/api/v1/thing/reporting"
                   , "requestID"                        : requestID.toString()
                   , "things":
                     { "/device/climate/owl/meteo"     :
                       { "prototype"                    :
                         { "device"                     :
                           { "name"                     : "Network OWL"
                           , "maker"                    : "2 Save Energy Ltd"
                           }
                         , "name"                       : true
                         , "status"                     : [ "present", "absent", "recent"]
                         , "properties":
                           { "code"                     : true
                           , "temperature"              : "celsius"
                           , "text"                     : true
                           }
                         }
                       , "instances"                    :
                         [ { "name"                     : "Network OWL"
                           , "status"                   : "present"
                           , "unit"                     :
                             { "serial"                 : buff.weather.id
                             , "udn"                    : "195a42b0-ef6b-11e2-99d0-UID"+buff.weather.id+"-owl-weather"
                             }
                           , "info"                     :
                             { "code"                   : buff.weather.code
                             , "temperature"            : buff.weather.temperature
                             , "text"                   : buff.weather.text
                             }
                           , "uptime"                   : currTime-bootTime
                           }
                         ]
                       }
                     }
                   };

        } else if ( buff.solar ) {
          logger.info('Received OWL solar packet.');

          report = { "path"                             : "/api/v1/thing/reporting"
                   , "requestID"                        : requestID.toString()
                   , "things":
                     { "/device/sensor/owl/solarpanels" :
                       { "prototype"                    :
                         { "device"                     :
                           { "name"                     : "OWL Intuition-pv"
                           , "maker"                    : "2 Save Energy Ltd"
                           }
                         , "name"                       : true
                         , "status"                     : [ "present", "absent", "recent"]
                         , "properties":
                           { "generating"               : "watts"
                           , "exporting"                : "watts"
                           }
                         }
                       , "instances"                    :
                         [ { "name"                     : "OWL Intuition-pv"
                           , "status"                   : "present"
                           , "unit"                     :
                             { "serial"                 : buff.solar.id
                             , "udn"                    : "195a42b0-ef6b-11e2-99d0-UID"+buff.solar.id+"-owl-solarpanel"
                             }
                           , "info"                     :
                             { "generating"             : buff.solar.current.generating
                             , "exporting"              : buff.solar.current.exporting
                             }
                           , "uptime"                   : currTime-bootTime
                           }
                         ]
                       }
                     }
                   };

        }

        //console.log(util.inspect(report, false, null));
        trsp.handle(report, rinfo.address, 'udp ' + rinfo.address + ' ' + rinfo.port + ' ' + report.path);
      } catch(ex) { return logger.error('discovery-owl', { event: 'parsing', diagnostic: ex.message }); }
    }).on('listening', function() {
      var address = this.address();

      logger.info('OWL driver listening on multicast udp://' + LOCAL_BROADCAST_HOST + ':' + address.port);
      try { this.addMembership(LOCAL_BROADCAST_HOST); } catch(ex) {
        logger.error('discovery-owl', { event: 'addMembership', diagnostic: ex.message });
      }
    }).on('error', function(err) {
      logger.error('discovery-owl', { event: 'socket', diagnostic: err.message });
    }).bind(LOCAL_BROADCAST_PORT, LOCAL_BROADCAST_HOST);
};
