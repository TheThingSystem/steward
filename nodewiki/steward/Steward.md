# The Steward

## Startup
### Utility

### Database

    Create database, if needed
    Load devices
      define /device actor
      load device drivers (i.e., /^device-.*\.js/)
        define generic device type
        load specific device types (e.g., /^lighting-.*\.js/)
          define specific device type

### Steward

      listen for http:/wss: on unused port
      serve static http files from sandbox area
      advertise steward using mDNS
      load discovery modules (/^discovery-.*\.js/)
      load wss: routes (/^route-.*\.js/)

    Load information on all non-internal/non-VM interfaces
    Monitor interface traffic to build ARP tables
    Assign UUID: '2f402f80-da50-11e1-9b23-' + MAC address
    Start server

    Load pseudo actors (/^actor-.*\.js/)
    Activity scan 

## Steward, per se
_TODO:_ support temporal ordering, access control, and the _tap_

## Database


## Utility