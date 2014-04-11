CHANGELOG
=========

## Release 1.7 "Salt Pretzel - TBD
## Commit - TBD

### Steward
### TAAS (Things as a Service)
### TSRP (Thing Simple Reporting Protocol)
### Places
### Things
### HTML5/client
### User policy client
### Developer console
### Utilities

## Release 1.6 "Pecan Waffle" - March 29, 2014
## Commit - df14aeda4c4379fe1122845e24adeb7db6fb7f7e

### Steward
- properly latch event observations
- APIs:
    - all: more robustness
    - groups: replace composite 'status' property with component 'type' and 'operator' properties
    - thing creation: remove race condition
    - client login: indicate that clockskew may be a cause of failure "(check your clock)"
- more device.expand robustness
- refactor metric/customary handling
- redirect port 80 traffic to correct http/https port
- add secondary algorithm for generating UUID (in case ARP scan fails)
- add support for db/configuration.json (experimental, not documented yet)

### TAAS (Things as a Service)
- no changes

### TSRP (Thing Simple Reporting Protocol)
- no changes

### Places
- use replacement interface to YQL, and robustness
- better diagnostics for invalid parameters
- default to metric for displayUnits
- more accurate handling of forecast and current conditions
- add identity (UUID) property

### Things
- all:
    - refactor geocaching code and additional robustness
- mDNS and UPNP: no changes
- device/climate:
    - nest/control: robustness check when setting to home/away
    - samsung/control: NEW, thank you @CloCkWeRX
- device/gateway
    - flower-power/cloud: robustness
    - reelyactive/reel: supress phantom reelceivers and tags
    - yoctopuce/hub: determine measured property based on unit parsing
- device/indicator:
    - cassandra/nosql: NEW
    - grovestreams/sensor: NEW
    - irtoy/infrared: moved to drivers-in-progress area
    - wink/*:
    - wink/gauge:
        - use metric/customary setting
        - supress multiple API connection errors
    - wink/nimbus: supress multiple API connection errors
- device/lighting:
    - all: color model refactoring and robustness
    - heroic-robotics/*: use node-pixelpusher version 0.1.1
    - LIFX/bulb: NEW, thank you @RussNelson
- device/media:
    - camera/axis: moved to drivers-in-progress area
- device/motive:
    - automatic/vehicle:
        - interpret polyline routes
        - add logging hook
        - remove debugging
    - crazyflie/3d: moved to drivers-in-progress area
    - irobot/floor: moved to drivers-in-progress area
    - lockitron/lock: add 'error' status, if operations fail
    - tesla/model-s: limit API calls to no more than six per minute
- device/presence:
    - no changes
- device/sensor:
    - voc now a measured property
    - fix race-condition when reporting multiple measurements "simultaneously"
    - move co2/light/voc sensors from /device/climate
    - nest/smoke: report measurements properly
    - wink/spotter: supress multiple API connection errors
- device/switch:
    - wemo/onoff: do not reply on subscription to refresh
    - wink/strip:
        - typo in property name (was 'outlets', now 'plugs')
	- supress multiple API connection errors

### HTML5/D3 client
- more accurate handling of forecast and current conditions

### User management client (client.html)
- no changes

### Developer clients
- console.html:
    - when displaying entity names, append ID (if different)
    - unlocked doors now reported as orange, not green

### Utilities
- no changes

## Release 1.5 "Ground Hog" - March 1, 2014
## Commit - ddc6a500d20b6065c6e5b19611afb224878e4c66

### Steward
- experimental bootstrap-mac.sh script created
- API
    - add videlicet property (viz.) when reporting a duplicate
    - add bullet-proofing to group membership when modifying a group
    - tighten text in oneshot
- Discovery
    - ignore VirtualBox interfaces, thanks @alexking
    - upgrade to latest arp-a module
- Security
    - more extensive generation of self-signed certificates
    - numerous small fixes to access control

### TAAS (Things as a Service)
- no changes

### TSRP (Thing Simple Reporting Protocol)
- no changes

### Places
- add current and forecast weather

### Things
- all: make "wake" a generic device task (if IP address defined for device instance)
    - if argument is empty to device.expand (the routine that interprets '.[ ... ].'), it also returns null
    - invoke device.expand in the lower-api, not the upper-api (to avoid JSON mangling)
    - setState() on updates was broken, not any more
- mDNS and UPNP:
    - finalize handling of deviceType information
- device/climate:
    - normalize for more code re-use
    - ecobee/control: fix misnamed property ('apikey' v. 'appKey')
    - flower-power/sensor:
        - upgrade to latest node-flower-power-cloud module
        - fix typo ('soil_mosture' v. 'soil_moisture')
    - samsung/control: more preparation for release
- device/gateway
    - all: child device safety checks to avoid spurious crashes
    - nest/cloud: temporarily scan intently on arp traffic
    - reelyactive/hub: attempt to avoid creating bogus reels
- device/indicator:
    - deweetio/sensor: NEW (complete)
    - irtoy/ifrared: disabled until completion
    - mqtt/text:
        - was text/mqtt
        - subscribe to first term of topic + '/#'
    - nma/text: NEW (complete), thanks @torkelsson
    - wink/dial: typo ('spit' v. 'split')
    - xively/sensor: invoke setInfo() when appropriate
- device/lighting:
    - tcpi/bulb:
        - remove heuristic trying to distinguish between bulbs and downlights, it's not deterministic
        - better device naming
        - upgrade to latest node-greenwave-gop module
    - template: more examples
- device/media:
    - normalize for more code re-use
    - chromecast/video: upgrade to latest eureka-dongle module
- device/motive:
    - automatic/vehicle: NEW (mostly complete)
    - lockitron/lock: NEW (complete)
    - tesla/model-s:
        - ignore HTTP response code 408 from server (they are somewhat plentious)
        - upgrade to latest teslams module
        - normalize for more code re-use
    - irobot/floor: disabled until completion
- device/presence:
    - ble/fob: add Chipolo
    - owntracks/mobile:
        - was mqttitude/mobile
        - ignore ZERO_MATCHES error on geocode
- device/switch:
    - wink/onoff: add missing on/off performers

### HTML5/D3 client
- bootstrap screen
- do not allow long device names to scroll past name field
- fixes for 'metric' display
- support 'container' devices (e.g., those that contain plugs or gauges, etc.) with "double drill-down"
- fixes for cursor focus
- various fixes for displaying presence and sensor information
- display map for presence and motive locations
- display current/forecast conditions
- display devices under review

### User management client (client.html)
- prepare allow 'master' role to see QRcodes for clients
- add 'back' link

### Developer clients
- An [iOS library](https://github.com/TheThingSystem/steward-ios-library) to interface with the Things-as-a-service, client-side
- A [node.js module](https://github.com/TheThingSystem/node-thing-client) to interface with TheThingSystem, as a thing
- A [node.js module](https://github.com/TheThingSystem/node-taas-client) to interface with the Things-as-a-service, client-side

### Utilities
- no changes

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
