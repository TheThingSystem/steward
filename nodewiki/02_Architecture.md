# The Thing Architecture

The [Thing Philosophy](01_Philosophy.md) describes the way the curators think about home automation systems.
Whether you agree with this perspective or not,
if you're going to use the Thing System,
then it's useful to appreciate the philosophy.

In terms of ASCII art:

             native clients               browsers               apprentices     

              +-----------+            +-----------+            +-----------+
              |   client  |            |   client  |            |   client  |
         +-----------+    |       +-----------+    |       +-----------+    |
         |   client  |    |       |   client  |    |       |   client  |    |
         |           |----+       |           |----+       |           |----+
    +-----------+    |       +-----------+    |       +-----------+    |
    |           |----+       |           |----+       |           |----+
    |  client   |            |  client   |            |  client   |
    |           |            |           |            |           |
    +-----------+            +-----------+            +-----------+
           /                       /                       /
          /                       /                       /
         / web services          / http/https            / web services
        /                       /                       /
       /                       /                       /
    +-----------------------------------------------------------------------+
    |                                                                       |
    |                                steward                                |
    |                                                                       |
    +-----------------------------------------------------------------------+
       \                       \                       \
        \                       \  simple               \  simple
         \ native protocols      \  thing                \  thing reporting
          \                       \  protocol             \  protocol
           \                       \                       \
    +-----------+            +-----------+            +-----------+
    |           |            |           |            |           |
    |   thing   |            |   thing   |            |   thing   |
    |           |----+       |           |----+       |           |----+
    +-----------+    |       +-----------+    |       +-----------+    |
         |   thing   |            |   thing   |            |   thing   |
         |           |----+       |           |----+       |           |----+
         +-----------+    |       +-----------+    |       +-----------+    |
              |  thing    |            |  thing    |            |  thing    |
              |           |            |           |            |           |
              +-----------+            +-----------+            +-----------+

           consumer equipment          smart devices            small sensors

__Developers: the links in the remainder of this document will take you to the relevant API information!__

The [steward](Developer/00_Steward.md) is the center of the system, monitoring and controlling all sorts of 
[things](Developer/Things/00_Introduction,
according to the directives it receives from various [clients](Developer/Clients/00_Introduction.md).

## Communicating with Things

There are three different _protocols_ that the steward uses to communicate with a thing:

* Most consumer equipment implements some kind of industry- or manufacturer-specific protocol,
which the steward terms a _native protocol_.
Examples of this include Zigbee, Z-Wave, INSTEON, DASH7, and so on.
The steward implements many of these native protocols.
If a particular native protocol isn't supported,
then a developer writes a [device driver](Developer/01_Devices.md).

* Smart devices have a programmable environment.
Examples of this include smart phones, tablets, and the things that attach to them,
such as Motrr's Galileo, Romotive's Romo, the Swivl, and so on.
The steward implements the [Simple Thing Protocol](Developer/Things/01_ThingProtocol.md) to communicate with these things.
The repository contains client libraries for Arduino and iOS to help developers add the Simple Thing Protocol to their
applications for these platforms.

* Finally, some things don't have any networking or programming capabilities whatsoever.
Examples of this are typically small sensors.
In order to "network" things like this,
a _maker_ attaches an expansion board termed a _shield_,
that contains an inexpensive processor, network interface, and sensor plug.
The steward implements the [Simple Thing Reporting Protocol](Developer/Things/01ThingReporting.md) to listen for traffic from
these things.
The repository contains client libraries for Arduino to help developers add the Simple Thing Reporting Protocol to sensors.


## Communicating with Clients

There are three different kinds of clients that the steward interacts with:

* Native clients are platform-specific (e.g., Android, iOS, and so on).
The steward implements a comprehensive set of web services to allow a client to monitor and control
[things](Developer/01_Devices.md),
[actors](Developer/01_Actors.md),
[activities](Developer/01_Activities.md),
and the [steward](Developer/00_Steward.md).

* The steward serves HTML5 files for browsers.
The repository contains various HTML5 clients for different tasks.

* _Apprentices_ differ from the other two kinds of clients in that once configured they operate autonomously from the user.
Each apprentice implements a particular kind of [magic](Developer/Clients/02_Magic.md).
For example,
a "vacation apprentice" might monitor when you turn on (or adjust) the lighting in your home.
When you tell the apprentice that you are going on vacation,
it then emulates that same behavior.

    Typically, an apprentice starts with by asking a couple of questions in order to construct a _prefab_.
A [prefab](Developer/Clients/02_PreFabs.md) is an internal structure used by the apprentice in order to guide future actions.
For example,
a "lighting apprentice" might start by asking you to group the lights in your home into natural units
(such as "living room", "entry way", and so on).

## Communicating with the Cloud

The steward implements the _hidden server_ side of a [rendezvous protocol](https://github.com/mrose17/node-rendezvous).
What that means is that you can have the steward listen for traffic on the Internet while sitting behind your home firewall.
The steward implements a (hopefully) robust [security](Developer/01_Security.md) model,
so clients are required to use either _https_ or _wss_ (secure web sockets) to connect to the steward,
and then authenticate themselves using a time-based OTP system.
Future implementations of the steward are planned to support _ssh_ in addition to _https_ and _wss_.
