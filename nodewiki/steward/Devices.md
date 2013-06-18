# Devices

An *actor* refers to an entity that participates in an activity. Typically, these refer to devices; however, there are two other types of actors: _groups_ which combine actors accordingly to a logical relationship (e.g., 'and' or 'first/next') and _pseudo actors_ which are software-only constructs (e.g., the *place*).

## Architecture
Support for devices is added by creating a module with a path and name that conform to the Device Taxonomy.
This module is detected and loaded by the steward during startup.
**(At present, if you add a module to a running steward, you must restart the steward.)**

When the module is loaded,
the _start()_ function is invoked which does two things:

* It defines an object that is consulted when an instance of the device is discovered.

* It defines how instances of the device are discovered.

### Module Structure

A module consists of several parts.
In reading this section, it is probably useful to also glance at one of the existing modules.
For the examples that follow,
let's say we're going to the define a module for a _macguffin_ presence device manufactured by _Yoyodyne Propulsion Systems_.

The first step is to select the name of the device prototype.
In this case, it's probably going to be:

    /device/presence/yoyodyne/macguffin

The corresponding file name would be:

    devices/device-presence/presence-yoyodyne-macguffin.js

The file should have six parts:

_First_,
is the _require_ section where external modules are loaded.
By convention, system and third-party modules are loaded first, followed by any steward-provided modules, e.g.,

    var util        = require('util')
      , devices     = require('./../../core/device')
      , steward     = require('./../../core/steward')
      , utility     = require('./../../core/utility')
      , presence    = require('./../device-presence')
      ;

_Second_,
is the _logger_ section, which is usually just one line:

    var logger = presence.logger;

Logging is done _syslog-style_, which means these functions are available

    logger.crit
    logger.error
    logger.warning
    logger.notice
    logger.info
    logger.debug

These functions take two arguments: a string and a property-list object, e.g.,

    try {
      ...
    } catch(ex) {
      logger.error('device/' + self.deviceID,
                   { event: 'perform', diagnostic: ex.message });
    }

_Third_,
is the _prototype_ function that is invoked by the steward whenever an instance of this device is (re-)discovered:

_Fourth_,
comes the optional _observe_ section, that implements asynchronous observation of events.

_Fifth_,
comes the optional _perform_ section, that implements the performance of tasks.

_Sixth_,
comes the _start()_ function.

### The Prototype function

    var Macguffin = exports.Device = function(deviceID, deviceUID, info) {
      // begin boilerpate...
      var self = this;
    
      self.whatami = info.deviceType;
      self.deviceID = deviceID.toString();
      self.deviceUID = deviceUID;
      self.name = info.device.name;
    
      self.info = utility.clone(info);
      delete(self.info.id);
      delete(self.info.device);
      delete(self.info.deviceType);
      // end boilerplate...

      self.status = '...';
      self.changed();
    
      // perform initialization here
    
      utility.broker.subscribe('actors', function(request, taskID, actor, observe, parameter) {
        if (request === 'ping') {
          logger.info('device/' + self.deviceID, { status: self.status });
          return;
        }
    
             if (actor !== ('device/' + self.deviceID)) return;
        else if (request === 'observe') self.observer(self, taskID, observe, parameter);
        else if (request === 'perform') self.perform(self, taskID, observe, parameter);
      });
    };
    util.inherits(Macguffin, indicator.Device);

### The Observe section
The prototype function invokes this whenever the _steward_ module publishes a request to the actor asking that a particular
event be monitored:


    Macguffin.prototype.observe = function(self, eventID, observe, parameter) {
      var params;

      try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

      switch (observe) {
        case '...':
          // create a data structure to monitor for this observe/params pair

          // whenever an event occurs, invoke
          //     steward.observed(eventID);

          // now tell the steward that monitoring has started
          steward.report(eventID);
          break;

        default:
          break;
      }
    }


### The Perform section
The prototype function invokes this whenever the _steward_ module publishes a request to the actor asking that a particular
task be performed:

    Macguffin.prototype.perform = function(self, taskID, perform, parameter) {
      var params;

      try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

      if (perform === 'set') {
        if (!!params.name) self.setName(params.name);

        // other state variables may be set here
        if (!!params.whatever) {
          // may wish to range-check params.whatever here...

          self.info.whatever = params.whatever;
          self.setInfo();
        }

        return steward.performed(taskID);
      }

     // any other tasks allowed?
     if (perform === '...') {
     }

     return false;
    };


### The start() function: Linkage

As noted earlier, this function performs two tasks.
The first task is to link the device prototype into the steward:

    exports.start = function() {
      steward.actors.device.presence.yoyodyne =
          steward.actors.device.presence.yoyodyne ||
          { $info     : { type: '/device/presence/yoyodyne' } };
    
      steward.actors.device.presence.yoyodyne.macguffin =
          { $info     : { type       : '/device/presence/yoyodyne/macguffin'
                        , observe    : [ ... ]
                        , perform    : [ ... ]
                        , properties : { name   : true
                                       , status : [ ... ]
                                       ...
                                       }
                        }
          , $observe  : {  observe   : validate_observe }
          , $validate : {  perform   : validate_perform }
          };
      devices.makers['/device/presence/yoyodyne/macguffin'] = MacGuffin;
    ...

The first assignment:

      steward.actors.device.presence.yoyodyne =
          steward.actors.device.presence.yoyodyne ||
          { $info     : { type: '/device/presence/yoyodyne' } };
    
is there simply to make sure the naming tree already has a node for the parent of the device prototype.
(The steward automatically creates naming nodes for the top-level categories).

The next assignment is the tricky one:

      steward.actors.device.presence.yoyodyne.macguffin =
          { $info     : { type       : '/device/presence/yoyodyne/macguffin'
                        , observe    : [ ... ]
                        , perform    : [ ... ]
                        , properties : { name   : true
                                       , status : [ ... ]
                                       ...
                                       }
                        }
          , $list     : function()   { ... }
          , $lookup   : function(id) { ... }
          , $validate : { create     : validate_create
                        , observe    : validate_observe
                        , perform    : validate_perform
                        }
          };

The _$info_ field is mandatory, as are its four sub-fields:

* _type_: the name of the device prototype.

* _observe_: an array of events that the device observe.
The array may be empty.

* _perform_: an array of tasks that the device performs.
At a minimum,
Every device must support a "set" task in order to set the name of the device instance.
The array may be empty (the "set" task does not appear in the array).

* _properties_: a list of property names and syntaxes.
Consult the _Device Taxonomy_ section below for a list of defined properties and corresponding syntaxes.

The _$list_ and _$lookup_ fields are for "special" kinds of actors, and are described later.

The _$validate_ field contains an object, with these sub-fields:

* _create_: present for "special" kinds of actors, described later.

* _observe_: a function that is used to evaluate an event and its associated parameter, to see if "it makes sense."

* _perform_: a function that is used to evaluate a task and its associated parameter, to see if "it makes sense."

#### The start() function: Discovery

The second task performed by the _start()_ function is to register with the appropriate discovery module.
There are presently four modules:

* SSDP: LAN multicast (not necessarily UPnP)

* BLE: Bluetooth Low Energy

* TCP port: TCP port number:

* MAC OUI: MAC prefix

For the first two discovery modules,
the steward will automatically (re-)create device instances as appropriate.
For the others,
the module may need to do some additional processing before it decides that a device instance should (re-)created.
Accordingly, the module calls _device.discovery()_ directly.

Discovery via SSDP occurs when the steward encounters a local host with an SSDP server that advertises a particular
"friendlyName" or "deviceType":

    devices.makers['Yoyodye Propulsion Systems MacGuffin'] = Macguffin;

Discovery via BLE occurs when the steward identifies a BLE device from a particular manufacturer,
and find a matching characteristic value:

    devices.makers['/device/presence/yoyodyne/macguffing'] = Macguffin;
    require('./../../discovery/discovery-ble').register(
      { 'Yoyodyne Propulsion' :
          { '2a24' :
              { 'MacGuffin 1.1' :
                  { type : '/device/presence/yoyodyne/macguffin' }
              }
          }
      });

Discovery via TCP port occurs when the steward is able to connect to a particular TCP port on a local host:

    require('./../../discovery/discovery-portscan').pairing([ 1234 ],
    function(socket, ipaddr, portno, macaddr, tag) {
      var info = { };

      ...
      info.deviceType = '/device/presence/yoyodyne/macguffin';
      info.id = info.device.unit.udn;
      if (devices.devices[info.id]) return socket.destroy();

      utility.logger('discovery').info(tag, { ... });
      devices.discover(info);
    });

Discovery via MAC OUI occurs when the steward encounters a local host with a MAC address whose first 3 octets match a particular
prefix:

    require('./../../discovery/discovery-mac').pairing([ '01:23:45' ],
    function(ipaddr, macaddr, tag) {
      var info = { };

      ...
      info.deviceType = '/device/presence/yoyodyne/macguffin';
      info.id = info.device.unit.udn;
      if (devices.devices[info.id]) return;

      utility.logger('discovery').info(tag, { ... });
      devices.discover(info);
    });


## Design Patterns
There are three design patterns currently in use for device actors.

### Standalone Actor
A standalone actor refers to a device that is discovered by the steward and doesn't discover anything on its own.

Examples of standalone actors include:

* /device/lighting/blinkstick/led

* /device/media/sonos/audio

* /device/presence/fob/inrange

* /device/sensor/wemo/motion


### Gateway and Subordinate Actors
Typically the steward is able to discover a gateway for a particular technology,
and the module for that gateway then discovers "interesting" devices.
Examples of these kinds of actors include things like:

* /device/gateway/insteon/hub and /device/switch/insteon/dimmer, etc.

* /device/gateway/netatmo/cloud and device/climate/netatmo/sensor

When a gateway actor discovers an "interesting" device,
it calls _devices.discover()_ to tell the steward to (re-)create it.

### Creatable Actors
These kind of actors aren't discoverable,
so a client must make a specific API call to the steward in order to create an instance.
Examples of creatable actors include:

* /device/indicator/text/cosm

In general,
these actors refer to software-only constructs:
while it's the steward's job to discovery devices,
only a user can decide whether they want sensor readings uploaded somewhere.

## API calls
Devices are managed by authorized clients using the

    /manage/api/v1/device/

path prefix, e.g.,

    { path      : '/api/v1/actor/list'
    , requestID : '1'
    , options   : { depth: all }
    }

### Create Device
To create a device,
an authorized client sends:

    { path      : '/api/v1/actor/create/UUID'
    , requestID : 'X'
    , name      : 'NAME'
    , whatami   : 'TAXONOMY'
    , info      : { PARAMS }
    , comments  : 'COMMENTS'
    }

where _UUID_ corresponds to an unpredictable string generated by the client,
_X_ is any non-empty string,
_NAME_ is a user-friendly name for this instance,
_INFO_ are any parameters associated with the device,
and _COMMENTS_ (if present) are textual, e.g.,

    { path      : '/api/v1/actor/create/YPI'
    , requestID : '1'
    , name      : 'OO'
    , whatami   : '/device/presence/yoyodune/macguffin'
    , info      : { beep: 'annoying' }
    }

### List Device(s)
To list the properties of a single device,
an authorized client sends:

    { path      : '/api/v1/actor/list/ID'
    , requestID : 'X'
    , options   : { depth: DEPTH }
    }

where _ID_ corresponds to the _deviceID_ of the device to be deleted,
_X_ is any non-empty string,
and _DEPTH_ is either 'flat', 'tree', or 'all'

If the ID is omitted, then all devices are listed, e.g., to find out anything about everything,
an authorized client sends:

    { path      : '/api/v1/actor/list'
    , requestID : '2'
    , options   : { depth: 'all' }
    }

### Perform Task
To have a device perform a task,
an authorized client sends:

    { path      : '/api/v1/actor/perform/ID'
    , requestID : 'X'
    , perform   : 'TASK'
    , parameter : 'PARAM'
    }

where _ID_ corresponds to the _deviceID_ of the device to perform the task,
_X_ is any non-empty string,
_TASK_ identifies a task to be performed,
and _PARAM_ (if present) provides parameters for the task, e.g.,

    { path      : '/api/v1/actor/perform/7'
    , requestID : '3'
    , perform   : 'on'
    , parameter : '{"color":{"model":"cie1931","cie1931":{"x":0.5771,"y":0.3830}},"brightness":50}'
    }

### Delete Device
To define a device,
an authorized client sends:

    { path      : '/api/v1/actor/device/ID'
    , requestID : 'X'
    }

where _ID_ corresponds to the _deviceID_ of the device to be deleted, and _X_ is any non-empty string, e.g.,

    { path      : '/api/v1/actor/device/7'
    , requestID : '4'
    }

## Device Taxonomy
The steward's taxonomy consists of a hierarchical system for device prototypes along with a flat namespace for properties.
Although the naming for device prototypes is hierarchical,
based on primary function,
a given property may appear in any device prototype in which "it makes sense".

Properties are expressed in a consistent set of units:

* _percentage_    - [0 .. 100]
* _degrees_       - [0 .. 360)
* _mireds_        - [154 .. 500] (philips hue, aka 2000-6500K)
* _meters/second_ - [0 .. N]
* _latlng_        - [latitude, longitude] -or- [latitude, longitude, elevation]
* _meters_        - [0 .. N]
* _seconds_       - [0 .. N]
* _id_            - [1 .. N]
* _u8_            - [0 .. 255]
* _s8_            - [-127 .. 128]
* _fraction_      - [0 .. 1]
* _timestamp_     - 2013-03-28T15:52:49.680Z
* _celsius_
* _ppm_
* _decibels_
* _millibars_

or as an entry from a fixed set of keywords.

At a minimum,
three properties must be present in all devices:

* _name_ - a string

* _status_ - a keyword:

    * _waiting_ - indicates that the steward is waiting for the device to communicate

    * _busy_ - indicates that the device is busy "doing something"

    * _ready_ - indicates that all is well between the steward and the device

    * _error_ - indicates something else

    * _reset_ - indicates that the device, sadly, requires intervention

    * _on_ or _off_ - for lighting and switches

    * _motion_ or _quiet_ - for motion sensors

    * _idle_, _playing_, or _paused_ - for media players

    * _present_, _absent_, or _recent_ - for presence and sensors

    * _green_, _blue_, _indigo_, or _red_ - for reporting steward health

* _updated_ - a timestamp

Now let's look at the twelve categories of devices.
**(There's nothing _magical_ about this number, and it will probably drop to ten.)**

### Climate
These are devices that monitor or control the "breathable environment".
The naming pattern is:

    /device/climate/XYZ/control
    /device/climate/XYZ/monitor

depending on whether control functions are available.

At a minimum, two properties must be present:

* _lastSample_ - a timestamp

* _temperature_ - in degrees centigrade (celsius)

In addition, depending on the capabilities of the device, additional properties may be present:

* _coordinates_ - an array containing latitude (degrees), longitude (degrees), and optionally elevation (meters)

* _humidity_ - a percentage

* _co2_ - in parts-per-million

* _noise_ - in decibels

* _pressure_ - in millibars

Please note that the _updated_ and _lastSample_ properties report different things:
_lastSample_ indicates when the climate properties where last measured,
whilst _updated_ indicates the last change in state for the device
(i.e., it is possible for _updated_ to change regardless of whether _lastSample_ changes;
however, whenever _lastSample_ changes to reflect a more recent measurement,
_updated_ will also change to the current time).

### Gateway
These are devices that interface to non-IP devices,
or devices that talk to a cloud-based service to get information about a device in the home.
Accordingly, there are two naming patterns, i.e.,

    /device/gateway/TECHNOLOGY/MODEL
    /device/gateway/TECHNOLOGY/cloud

For example:

    /device/gateway/insteon/hub
    /device/gateway/netatmo/cloud

The _status_ property may be the only property present:

* _status_ - _waiting_, _ready_, _error_, or _reset_

Note that gateways to cloud-based services require authentication information,
which is typically set using either the

    /manage/api/v1/device/create/uuid

or

    /manage/api/v1/device/perform/id

APIs.

### Indicator
These are devices that provide an indication to the user that is related to neither the "lighting environment" or the
"media environment".
The naming pattern is:

    /dev/indicator/MEDIA/XYZ

where MEDIA is usually _text_.

The _status_ property may be the only property present:

* _status_ - _waiting_, _ready_, or _error_

As with gateway devices for cloud-based services,
once initialized,
these devices are almost entirely uninteresting to the user.

### Lighting
These are devices that control the "lighting environment".
The naming pattern is:

    /device/lighting/XYZ/cfl
    /device/lighting/XYZ/led
    /device/lighting/XYZ/fluorescent
    /device/lighting/XYZ/incandescent

Given the range of physical properties,
it is challenging to provide an abstraction which preserves the fidelity of the device-specific color model.

The _status_ property indicates the current state of the bulb:

* _status_ - _waiting_,  _on_, or _off_

At a minimum, two tasks must be available:

* _on_ - turns the light on

* _off_ - turns the light off

Any of these properties may be present, which are set with the _on_ task:

* _color.model_ - defines the model and parameters, any combination of:

    * _color.rgb_ - with parameters _r_, _g_, and _b_, each a integer-value between 0 and 255

    * _color.hue_ - with parameters _hue_ (in degrees) and _saturation_ (as a percentage)

    * _color.temperature_ - with parameter _temperature_ expressed in mireds

    * _color.cie1931_ - with parameters _x_ and _y_ expressed as a real-value between 0 and 1

* _brightness_ - an integer-value percentage of the bulb's possible output

* _transition_ - how many seconds should elapse as the bulb transitions to the new color and/or brightness

* _interval_ - whether the bulb should change and remain (_solid_),
change and return (_once_),
or change back and forth (_flash_)

With respect to the color model,
the list above is presented starting at the least-desirable (_rgb_) to the most-desirable (_cie1931_).
Clueful clients that manage the lighting environment should take note of which models are supported by a device and use the
most desirable.

### Media
These are devices that control the "media environment".
The naming pattern is:

    /device/media/audio/XYZ
    /device/media/video/XYZ

At a minimum, these properties must be present:

* _status_ - one of _idle_, _playing_, _paused_, or _busy_

* _track_ - defines the track information:

    * _title_, _artist_, and _album_ - strings

    * _albumArtURI_ - a URI

* _position_ - an integer-value indicating the number of seconds

* _volume_ - an integer-value percentage of the device's possible output

* _muted_ - either _on_ or _off_

At a minimum, these tasks must be available:

* _play_ - plays the _url_ parameter (or resumes playback if the _url_ isn't present)

* _stop_ - stops playback

* _pause_ - pauses playback

* _seek_ - to the _position_ parameter

* _set_ - set any of these parameters: _position_, _volume_, and/or _muted_

### Motive
These are devices that have some movement capability: either rotational or mobile.
The naming pattern is:

    /device/motive/2d/XYZ
    /device/motive/3d/XYZ
    /device/motive/ptz/XYZ

**TBD**

### Presence
These are devices that report presence.
The naming pattern is:

    /device/presence/fob/XYZ

At a minimum, two properties must be present:

* _status_

    * _present_ - the device is currently detected

    * _absent_ - the device is no longer detected

    * _recent_ - the device was recently detected (to save device power, the steward does not continuously probe the device)

* _rssi_ - an integer-value between -127 and 128 indicating proximity

At a minimum, one task must be present:

* _alert_ - causes the presence device to emit a visual and/or audio signal

    *  _level_ parameter: one of _none_, _mild_, or _high_

### Sensor
These are devices that measure one physical quality (such as motion).
The naming pattern is:

    /device/sensor/XYZ/QUALITY

At a minimum, one property must be present:

* _lastSample_ - a timestamp

### Switch
These are devices that control power either in binary (_onoff_) or contiguously (_dimmer_).
The naming pattern is:

    /device/switch/XYZ/onoff
    /device/switch/XYZ/dimmer

The _status_ property may be the only property present:

* _status_ - _on_, _off_, _busy_, or _waiting_

At a minimum, two tasks must be available:

* _on_ - turns the power on

    * _level_ (_dimmer_ only) - an integer-value percentage of the switch's possible output

* _off_ - turns the power off

### Tricorder
The are devices that measure multiple physical qualities.
Because of their specialized nature,
the naming pattern is

    /device/tricorder/MANUFACTURE/MODEL

In addition to the properties specific to the individual device,
the _lastSample_ property must also be present.

**TBD**

### Wearable
These are devices that are similar to fob devices, but meant to be more personal.
The naming pattern is:

    /device/wearable/watch/XYZ

Please consult the section on _Presence_ devices for further details.
(In the future, it is likely that this device prototype will have additional features.)

## Choosing a technology to integrate
There are a large number of technologies available for integration.
The steward's architecture is agnostic with respect to the choice of communication and application protocols.
However,
many of these technologies compete (in the loose sense of the word).
Here is the algorithm that the steward's developers use to determine whether something should go into the development queue.

* Unless the device is going to solve a pressing problem for you, it really ought to be in _mainstream use_.
One of the reasons that the open source/node.js ecosystem was selected is because it presently is the most accessible for
developers.
Similarly,
it's desirable to integrate things that are going to reduce the pain for lots of people.

* The _mainstream use_ test consists of going to your national _amazon_ site and seeing what, if anything, is for sale.
Usually, the search page will reveal several bits of useful information.

 * Sponsored Links: often these are links to distributors, but sometimes there links to knowledge aggregators.
The first kind link is useful for getting a better sense as to the range of products available,
but the second kind link is usually more useful because it will direct you to places where you can find out more about the
integration possibilities, e.g., community sites, developer forums, and so on.

 * Products for sale: 

 * Frequently Bought Together:

 * Customers Who Bought This Item Also Bought:

* One of the things that is quite perplexing is the lack of technical information on technical products.
Although many developer forums have information,
"code rules".
So the obvious stop is [github](https://github.com) - search for the technology there.
Look at each project:

 * Many projects often include pointers to community, forum, and documentation sources.

 * Some projects contain a documentation directory;
if not, you can usually get a sense of things by looking at the "main" source file.

 * If you are fortunate,
a large part of the integration may already be done in node.js (use "npm search").
If so, check the licensing to see if it is "MIT".
If not, study it carefully to see whether it will work for you.

 * After reviewing the project, go up one level and look at the author's other projects.
Often there are related projects that weren't returned by the first search.

Finally, you may have a choice of devices to integrate with, and you may even have the opportunity to build your own.
If you go the "off-the-shelf" route,
please consider what is going to be easiest for others to connect to:

* If there is an ethernet-connected gateway to a device, then it is best to integrate to that gateway:
others will be able to use the gateway fairly easily, because attaching devices to an ethernet is fairly simple.

* Otherwise, if there is a USB stick that talks to a device, then use that:
although USB sticks should be less expensive than devices with ethernet-connectivity,
they also tend to require more expertise to configure.

* Finally, if there is a serial connector that talks to a device, you can always use that. Good luck!
