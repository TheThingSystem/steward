var message =
{ path                               : '/api/v1/thing/reporting'
, requestID                          : '1'
, things                             :
  { '/device/sensor/arduino/mat' :
    { prototype                      :
      { device                       :
        { name                       : 'Arduino with 902-PR'
        , maker                      : 'Arduino'
        }
      , name                         : true
      , status                       :
        [ 'present'
        , 'absent'
        , 'recent'
        ]
      , properties                   :
        { contact                    : [ 'on', 'off' ]
        }
      }
    , instances                      :
      [
        { name                       : 'Pressure Mat'
        , status                     : 'present'
        , unit                       :
          { serial                   : '90-a2-da-0d-94-d0'
          , udn                      : '195a42b0-ef6b-11e2-99d0-90a2da0d94d0-902-PR'
          }
        , info:
          { contact                  : 'off'
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
  self.addMembership('224.192.32.20');

  instances = message.things['/device/sensor/arduino/mat'].instances;
  message.things['/device/sensor/arduino/mat'].instances = [];
  data = new Buffer(JSON.stringify(message));
  self.send(data, 0, data.length, 22601, '224.192.32.20', function(err, bytes) {
    if (err) {
      console.log('error: ' + err.message);

      return self.close();
    }
    console.log('wrote ' + bytes + ' octets');
    console.log(data.toString());

    message.things['/device/sensor/arduino/mat'].instances = instances;
    message.things['/device/sensor/arduino/mat'].prototype = {};
    data = new Buffer(JSON.stringify(message));
    self.send(data, 0, data.length, 22601, '224.192.32.20', function(err, bytes) {
      if (err) console.log('error: ' + err.message); else console.log('wrote ' + bytes + ' octets');
      console.log(data.toString());

      self.close();
    });
  });
});
