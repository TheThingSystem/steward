# Simple Thing Reporting Protocol
For those things that are essentially "sensors with shields",
the _Simple Thing Reporting_ protocol provides a mechanism for adding steward monitoring.

## Operations

The basics:

* All transmissions are uni-directional, from the thing to the steward.

* All transmissions are via UDP to port 22601 on multicast address '224.192.32.19'.

* All messages are in JSON.

* All messages have a _requestID_ parameter, which is a non-empty string.
For design cleanliness,
each _requestID_ value should be distinct from the previous one.

* All messages have a _path_ parameter, which is always '/api/v1/thing/reporting'.

Here is an example:

    { path               : '/api/v1/thing/reporting'
    , requestID          : '1'
    , things             :
      { '/device/A/B/C'  :
        { prototype      :
          { device       :
            { name       : '...'
            , maker      : '...'
            , model      :
              { name     : '...'
              , descr    : '...'
              , number   : '...'
              }
            }
          , name         : true
          , status       : [ 'present', 'absent', 'recent' ]
          , properties   :
            {
            // other properties go here...
            }
          }
        , instances      :
          [ { name       : '...'
            , status     : '...'
            , unit       :
              { serial   : '...'
              , udn      : 'UID'
              }
            , info       :
              {
                // other property values go here...
              }
            , uptime     : milliseconds
            }
          ]
        }

        // other prototype/instance definitions go here...
      }
    }

In most cases,
there will be a single prototype/instance defined.
However,
for those cases where a device is acting as a concentrator for multiple things,
they may be grouped according to make/model (the prototype) and then the values may be sent as an array (the instances).
As a practical matter,
a single message should be no greater than 1472 octets in length.

Finally, note that there are no security 'enhancements' for this protocol.
If you can do 'real' security with the thing in question,
then you ought to be doing 'real' security using the [Simple Thing Protocol](01_ThingProtocol.md) instead of using the Reporting
protocol.

## Please Read This Carefully!

Observant readers will note that the message format above is a _mashup_ of the _prototype_, _register_, and _update_ messages
from the Simple Thing Protocol.

Accordingly before deciding how to construct a reporting message,
you __MUST__ read the section on _Taxonomy_ in [Devices](../01_Devices.md).
It is also worthwhile to restate a cauthion from the documentation on the Simple Thing Protocol:
__It is imperative that the choice of the _udn_ parameter be both globally-unique and specific to the thing being registered.
For example,
if the thing is a CO sensor with an [Arduino shield](http://en.wikipedia.org/wiki/Arduino#Shields),
the _udn_ parameter must uniquely identify the CO sensor,
regardless of whatever shield is providing the network connectivity.__
(Think of the _udn_ parameter as the serial number of the sensor, and not the MAC or IP address of the shield:
the IP or MAC address of a thing may change, but its serial number never will.)
