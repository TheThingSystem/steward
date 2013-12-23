ChangeLog
=======

## Release 1.3 "Rudolf" - December, 23, 2013
## Commit - 62986813b4b6e745ad8d56e3d859f7f30bed4afd

### Steward
- add subscriptions to steward status for /device/presence/mobile/* devices
- fix bugs relating to setting name of things
- better handling of SSDP error from Chromecast
- warn user if $HOME/.nvm/nvm.sh doesn't exit
- fix bugs in TSRP handling of lastSample
- simplify taxonomy
- added version reporting to steward startup
    
### Things
- place/1: new cron event "reboot" which fires 1 minute after startup
- device/climate:
    - koubachi/sensor: added batteryLevel, fixed bug for plant lastSamle
    - nest/smoke: initial support for Nest Protect
- device/gateway:
    - insteon/usb: initial support
    - rfxcom/usb: support RFXtrx433 and better RPi support
- device/lighting:
    - heroic-robotics/* - support colors for individual pixels
    - hue/downlight: added
    - tabu/bulb: added
    - tcpi/*: support Connected by TCPi
    - added templates for gateway and single bulb drivers
- device/presence:
    - mobile/mqtt: better rate limiting
    - reelyactive/fob - better event handling
- presence/* and wearable/*: no longer view alert level as readable

### HTML5/D3 client
- display errors from steward in notification queue
- updated for new things
- fixed numerous bug (keep those reports coming!)
- better handling for unknown deviceTypes
- authentication required for all access via https
- implemented popovers for motivie, presence, and wearable deviceTypes

### Client examples
- WeatherStationXBeeWiFi: added
- all: proper casting for dtostrf()


## Release 1.2 - November 23, 2013
## Commit - 795da048511bde27d998e6bf3432e4b2f7a1f722

### Steward
- numerous "minor clean-up" of some internals, especially:
    - better reporting when underlying modules not present
    - load only modules with filenames that end in '.js'
- initial z-wave support: onoff switches, dimmers, and smart plugs support contributed by Zoran Nakev (@zonak)
    - controller code tested against: Aeotec Zstick-s2 and repeater
    - onoff code tested against: Aeotec Smart Energy Switch, GE Outdoor Module
    - dimmer code tested against: Cooper Aspire RF Dimmer cooper, GE Lamp Dimmer/Plugin Appliance Module
- support MQTT as an upstream reporting protocol
- support for Beaglebone Black running Debian Wheezy

### Things
- support YoctoHub-Wireless hub
- support Yoctopuce-Color (dual) LED
- support reelyActive's micro-presence system (hub, reels, tags)
- support MQTTitude's macro-presense system (iOS, Android)
- initial support for Heroic Robotics' Pixel Pusher (need to add per-LED addressing)

### HTML5/D3 client
- updated for new things
- numerous bug fixes (keep those reports coming!)

### Client examples
- no changes


## Release 1.1 - October 23, 2013
## Commit - 852a955128c192ac87b78763a5ef9537b0ec1d02

### Steward
- 307 redirect HTTP LAN traffic to HTTPS (may be disabled by setting place.strict to 'off')
- lastSample always calculated as appropriate
- correctly report Hue bulbs that didn't report color model
- slightly more robust SSDP parsing
- fix name of TSRP discovery module
- always allow HTTP access to index.xml for SSDP
- fix RPi access over LAN (no localhost)
- more robust TOTP checking
- various robustness fixes
- use latest release of noble for increased BLE robustness
- do not respond to SSDP requests from the steward
- place1.version reports commit SHA
- place1.ipaddrs setting (useful for referring to files on the steward for playback)

### Things
- support Data Sensing Labs' Air Quality Sensor Mote
- support Ecobee's Smart SI Thermostat
- support Yoctopuce's hubs, climate sensors, and power LED
- support for Owl Energy Intuition-c
- less aggressive polling of API for Tesla Motors
- allow nest and ecobee to report absent thermostats
- add return ventilation sensor (air flow, temperature, humidity, and particle concentration)

### HTML5/D3 client
- support remote access via node-rendezvous2 package
- additional popover support
- improvements to CIE1931 and RGB color pickers
- improvements to home page layout
- various robustness fixes
- allow user to change device name in popover
- add alert notifiations from steward
- add ability to login to gain access rights

### Client examples
- HCHO sensor added to Grove AQ sensor array
- small robustness fixes to all Arduino clients


## Release 1.0 - September 23, 2013
## Commit - 881e6ed337365bf5e8a97d9af55a8cf89de23a4a

Released to open source.
