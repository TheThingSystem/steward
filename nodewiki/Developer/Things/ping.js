var message =
{ path                               : '/api/v1/thing/reporting'
, requestID                          : '1'
, things                             :
  { '/device/climate/arduino/sensor' :
    { prototype                      :
      { device                       :
        { name                       : 'Arduino with DHT-22'
        , maker                      : 'Arduino'
        }
      , name                         : true
      , status                       :
        [ 'present'
        , 'absent'
        , 'recent'
        ]
      , properties                   :
        { temperature                : 'celsius'
        , humidity                   : 'percentage'
        }
      }
    , instances                      :
      [
        { name                       : 'WeatherStation'
        , status                     : 'present'
        , unit                       :
          { serial                   : '90-a2-da-0d-94-d0'
          , udn                      : '195a42b0-ef6b-11e2-99d0-90a2da0d94d0-DHT-22'
          }
        , info:
          { temperature              : 23.60
          , humidity                 : 61.50
          }
        , uptime                     : 5021
        }
      ]
    }
  }
};


require('dgram').createSocket('udp4').bind(22602, function() {
  var data, instances;

  var self = this;

  console.log('bound');
  self.addMembership('224.192.32.19');

  instances = message.things['/device/climate/arduino/sensor'].instances;
  message.things['/device/climate/arduino/sensor'].instances = [];
  data = new Buffer(JSON.stringify(message));
  self.send(data, 0, data.length, 22601, '224.192.32.19', function(err, bytes) {
    if (err) {
      console.log('error: ' + err.message);

      return self.close();
    }
    console.log('wrote ' + bytes + ' octets');
    console.log(data.toString());

    message.things['/device/climate/arduino/sensor'].instances = instances;
    message.things['/device/climate/arduino/sensor'].prototype = {};
    data = new Buffer(JSON.stringify(message));
    self.send(data, 0, data.length, 22601, '224.192.32.19', function(err, bytes) {
      if (err) console.log('error: ' + err.message); else console.log('wrote ' + bytes + ' octets');
      console.log(data.toString());

      self.close();
    });
  });
});
