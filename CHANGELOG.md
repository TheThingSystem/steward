ChangeLog
=======

## Release 1.5 "TBD" - TBD
## Commit - TBD

### Steward

### TAAS (Things as a Service)

### TSRP (Thing Simple Reporting Protocol)

### Places

### Things

### HTML5/D3 client

### User management client (client.html)

### Developer clients

### Utilities

## Release 1.4 "Resolutions" - January 24, 2014
## Commit - 9ca2c07b2d7b8e470b5cfe94d697449b5579af8f

### Steward
- add HTTP/HTTPS /oneshot path for simplified debugging of the steward
- have 'parameter' parameter default to {} rather than '' (a better default in nearly all cases)
- additional results on a successful authentication to allow clients to better inform user
- improved algorithm when scanning ARP traffic
- improved algorithm when listening for SSDP traffic
- fixed perform operation on task-type groups
- more consistent logging tags
- begin refactoring of USB scanning (perhaps a fool's errand)
- remember logged-in users
- mDNS:
    - use a different mDNS publishing package for linux, so it now works
    - include steward name in mDNS advertisements
- new authorized role: monitor (read-only access)
- numerous security tweaks found through edge-testing
- steward now listens for 15 simultaenous cloud connections
  (needed to avoid overruns when HTML5/D3 client starts asking for icons)

### TAAS (Things as a Service)
- new taas-server implementation
- better steward certificates when registered with a TAAS cloud
- added node-taas-client, a node.js API for TAAS (and local access)

### TSRP (Thing Simple Reporting Protocol)
- use "official" multicast address: 224.0.9.1

### Places
- add displayUnits to allow clients to determine whether to display in metric or customary units

### Things
- all: normalize all validate_observe/observe/perform functions
- some: rename some files to better reflect taxonomy hierarchy
- some: support wake-on-LAN if IP/LAN-based
- UPnP:
    - all: fix assignment of deviceTypes
    - WeMo: better handling of the 412 error
- device/climate:
    - */control: immediately refresh state after a perform
    - flower-power/*: support Parrot Flower Power (via cloud)
    - nest/control: fix incorrect use of setting fan duration
    - wink/spotter: support Quirky Spotter sensor
- device/gateway:
    - */cloud: remove extraneous alerts when discovering non-configured things
    - flower-power/cloud: support Parrot Flower Power cloud service
    - insteon/9761: use 'setNoDelay' on sockets
    - reelyactive/hublet: support serialport access (in addition to UDP)
    - wink/cloud: support Quirky Wink cloud service
- device/indicator:
    - wink/*: support Quirky Nimbus dials
- device/lighting:
    - heroric-robotics/*: add 'program' task
    - hue/*: allow user to override configuration name for bulbs
- device/media:
    - appletv/video: do not recognize XBMC "masquerading" as an AppleTV
- device/motive:
    - tesla/model-s:
        - add 'physical' property (refreshed at most once every 30 seconds)
        - add 'distance' property (should be calculated by UI, but very useful)
- device/presence:
    - mqtt/mobile:
        - remove 'staticmap' property (used for initial testing)
        - add 'distance' property (should be calculated by UI, but very useful)
- device/sensor:
    - nest/smoke:
        - moved from device/climate
        - status now reflects safe/unsafe state
    - yoctopuce/*: initial support for Yocto-4-20mA-Rx
- device/switch:
    - wemo/meter: support Belkin Insight Switch
    - wink/*: support Quirky Pivot Power Strip

### HTML5/D3 client
- fix issue #112 - thanks @JoeWagner
- simpler algorithm when choosing an icon for a thing
- fix on/off control for switches
- better handling of login dropdown and reporting of permissions
- fix bug where CIE1931 lighting popover was not showing the color map on non-Mac systems
- support for all the new things
- various small fixes

### User management client (client.html)
- indicate whether the user needs to be logged in order to manage (necessary after the initial bootstrap)

### Developer clients
- various small fixes for /console
- rename bootstrap.html to testing.html

### Utilities
- add list-arp.js to mimic steward's algorithm for scanning ARP traffic
- add list-ssdp.js and list-notify.js to mimic steward's algorithm for listening for SSDP responses
- run.sh reminds developers that the steward will restart in 10 seconds after failure
- include developers' .jshintrc in repository

## Release 1.3 "Rudolf" - December 23, 2013
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
