# Devices

An *actor* refers to a prototype of a entity that participates in an activity. Typically, these refer to devices; however, there are two other types of actors: _groups_ which combine actors accordingly to a logical relationship (e.g., 'and' or 'first/next') and _pseudo actors_ which are software-only constructs (e.g., the *clipboard*).

## Architecture

## Design Patterns
There are three design patterns currently in use for device actors.

#### Standalone Actor
#### Controller Actor and Subordinate Actors
#### Singleton Actor

## Choosing a technology to integrate

If you are a developer, you may find this section interesting.

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

 * Customers Who Bouth This Item Also Bought:

* One of the things that is quite perplexing is the lack of technical information on technical products.
Although many developer forums have information,
"code rules".
So the obvious stop is [github](https://github.com) - search for the technology there.
Look at each project:

 * Many projects often include pointers to community, forum, and documentation sources.

 * Some projects contain a documentation directory;
if not, you can usually get a sense of things by looking at the "main" source file.

 * If you are fortunate,
a large part of the integration may already be done in node.js.
If so, check the licensing to see if it is "MIT".
If not, study it carefully to see whether it will work for you.

 * After reviewing the project, go up one level and look at the author's other projects.
Often there are related projects that weren't returned by the first search.

Finally, you may have a choice of devices to integrate with, and you may even have the opportunity to build your own.
If you go the "off-the-shelf" route,
please consider what is going to be easiest for others to connect to:

* If there is an ethernet-connected gateway to a device, then it is best to integrate to that gateway:
others will be able to buy use the gateway fairly easily, because attaching devices to an ethernet is fairly simple.

* Otherwise, if there is a USB stick that talks to a device, then use that:
although USB sticks should be less expensive than devices with ethernet-connectivity,
they also tend to require more expertise to configure.

* Finally, if there is a serial connector that talks to a device, you can always use that. Good luck!

## Access Methods


## API calls

    /manage/api/v1/
    
        /device/create/uuid      name, comments, whatami, info
        /device/list[/id]        options.depth: { flat, tree, all }
        /device/perform/id       perform, parameter
    TBD /device/delete/id


## Device Taxonomy
The steward's taxonomy consists of a hierarchical system for device-types along with a flat namespace for properties.
Although the naming for device types is hierarchical,
based on primary function,
a given property may appear in any device type in which "it makes sense".

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

    * _reset_ - indicates that the device has lost state and, sadly, requires intervention

    * _on_ or _off_ - for lighting and switches

    * _motion_ or _quiet_ - for motion sensors

    * _idle_, _playing_, or _paused_ - for media players

    * _present_, _absent_, or _recent_ - for presence and sensors

    * _green_, _blue_, _indigo_, or _red_ - for reporting steward health

* _lastUpdated_ - a timestamp

### Climate
These are devices that monitor or control the "breathable environment".
The naming pattern is:

    /device/climate/XYZ/control
    /device/climate/XYZ/monitor

depending on whether or not control functions are available.

At a minimum, two properties must be present:

* _lastSample_ - a timestamp

* _temperature_ - in degrees centigrade (celsius)

In addition, depending on the capabilities of the device, additional properties may be present:

* _coordinates_ - an array containing latitude (degrees), longitude (degrees), and optionally elevation (meters)

* _humidity_ - a percentage

* _co2_ - in parts-per-million

* _noise_ - in decibels

* _pressure_ - in millibars

Please note that the _lastUpdated_ and _lastSample_ properties report different things:
_lastSample_ indicates when the climate properties where last measured,
whilst _lastUpdated_ indicates the last change in state for the device
(i.e., it is possible for _lastUpdated_ to change regardless of whether _lastSample_ changes;
however, whenever _lastSample_ changes to reflect a more recent measurement,
_lastUpdated_ will also change to the current time).

### Fixed
These are devices that are fixed position, but rotatable in some sense.
The naming pattern is:

    /device/fixed/XYZ/ptz

**TBD**

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

Given the range of lighting properties and color models,
it is challenging to provide an abstract model for these devices.

The _status_ property indicates the current state of the bulb:

* _status_ -_waiting_,  _on_, or _off_

At a minimum, two tasks must be available:

* _on_ - turns the light on

    * _level_ (_dimmer_ only) - an integer-value percentage of the switch's possible output

* _off_ - turns the light off

Any of these properties may be present, which are set with the _on_ task:

* _color.model_ - defines the model and parameters, any combination of:

    * _color.rgb_ - with parameters _r_, _g_, and _b_, each a integer-value between 0 and 255

    * _color.hue_ - with parameters _hue_ (in degrees) and _saturation_ (as a percentage)

    * _color.temperature_ - with parameter _temperature_ expressed in mireds

    * _color.cie1931_ - with parameters _x_ and _y_ expressed as a real-value between 0 and 1

* _brightness_ - an integer-value percentage of the bulb's possible output

With respect to the color model,
the list above is presented starting at the least-desirable (_rgb_) to the most-desirable (_cie1931_).
Clueful clients that manage the lighting environment should take note of which models are supported by a device and use the
most desirable.

In addition, depending on the capabilities of the device, additional properties may be present:

* _transition_ - how many seconds should elapse as the bulb transitions to the new color and/or brightness

* _interval_ - whether the bulb should change and remain (_solid_),
change and return (_once_),
or change back and forth (_flash_)

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
These are devices that are mobile.
The naming pattern is:

    /device/motive/2d/XYZ
    /device/motive/3d/XYZ

**TBD**

### Presence
These are devices that report presence.
The naming pattern is:

    /device/presence/fob/XYZ

At a minimum, two properties must be present:

* _status_

    * _present_ - the device is currenty detected

    * _absent_ - the device is no longer detected

    * _recent_ - the device was recently detected (to save device power, the steward does not continously probe the device)

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
(In the future, it is likely that this device type will have additional features.)
