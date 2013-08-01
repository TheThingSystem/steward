var message =
    { path               : '/api/v1/thing/reporting'
    , requestID          : '1'
    , things             :
      { '/device/presence/mobile/laptop' :
        { prototype      :
          { device       :
            { name       : '42" Ultra Pro'
            , maker      : 'Ultra'
            , model      :
              { name     : 'Ultra Pro'
              , descr    : 'Super-Retina, Mid 2012'
              , number   : 'UltraPro10,1'
              }
            }
          , name         : true
          , status       : [ 'present', 'absent', 'recent' ]
          , properties   :
            {
            }
          }
        , instances      :
          [ { name       : 'penultimate'
            , status     : 'present'
            , unit       :  
              { serial   : 'F23C91AEC05F'
              , udn      : '195a42b0-ef6b-11e2-99d0-f23c91aec05f'
              }
            , info       :
              {
              }
            , uptime     : require('os').uptime() * 1000
            }
          ]
        }

        // other prototype/instance definitions go here...
      }
    };

require('dgram').createSocket('udp4').bind(22602, function() {
  var data = new Buffer(JSON.stringify(message))
    , self = this;

  console.log('bound');
  self.addMembership('224.192.32.19');
  self.send(data, 0, data.length, 22601, '224.192.32.19', function(err, bytes) {
    if (err) console.log('error: ' + err.message); else console.log('wrote ' + bytes + ' octets');
    self.close();
  });
});
