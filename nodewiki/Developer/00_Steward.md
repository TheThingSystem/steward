# The Steward
In terms of ASCII art:


    +-----------------------------------+------------------------------------+
    |                                   |                                    |
    |              steward              |         server (https/wss)         |
    |                                   |                                    |
    |                                   +------------------------------------+
    |       observe-perform loop        |           API resources            |
    |                                   |                                    |
    |                                   |  console   inspection  management  |
    +-----------------------------------+------------------------------------+
    |                                   |                                    |
    |  device database for persistence  |             discovery              |
    |                                   |                                    |
    |        device-generic driver      |  SSDP    BLE   TCP/port   MAC/OUI  |
    |                                   |                                    |
    +-----------------------------------+------------------------------------+
    |                      category-specific prototypes                      |
    |                                                                        |
    |  sensors:         motives:          indicators:         personal:      |
    |    simple         fixed-position      lighting            presence     |
    |    climate        mobile              media               wearable     |
    |    tricorder                          switches                         |
    |                                       textual                          |
    |  gateways                                                              |
    +------------------------------------------------------------------------+
    |                                                                        |
    |  device-specific drivers, inheriting from the most relevant prototype  |
    |                                                                        |
    |  ...    ...    ...    ...    ...    ...    ...    ...    ...    ...    |
    |  ...    ...    ...    ...    ...    ...    ...    ...    ...    ...    |
    |  ...    ...    ...    ...    ...    ...    ...    ...    ...    ...    |
    +------------------------------------------------------------------------+


## Startup
When _index.js_ runs, it starts three modules: _utility_, _database_, and _steward_.

## Utility module
On startup,
the _utility_ module creates pubsub mailboxes for:

* _beacon-ingress_: the utility module both publishes and subscribes to this mialbox to maintain a history of recent logging
entries and then to republish the latest logging entry to _beacon-egress_.

* _beacon-egress_: the console management API and any indicator actors subscribe to this mailbox to receive logging
entries.

* _actors_: all actors subscribe to this mailbox to receive requests to report current status information, observe events,
and perform tasks.

* _discovery_: all UPnP-based actors subscribe to this mailbox to receive notifications.

* _readings_: any indicator actors subscribe to this mailbox to receive sensor readings.

* _status_: any indicator actors subscribe to this mailbox to receive aggregate state information from the steward.

As with any pubsub service,
these mailboxes are used when it is "inconvenient" for a publisher to enumerate the list of interested subscribers.

The _utility_ module also houses the logging function,
which is a wrapper around [winston](https://github.com/flatiron/winston).
The most important aspect of this is the local variable _logconfigs_ which contains the logging configuration for each module.

Finally,
there are a small number of convenience routines.


## Database module
On startup,
the _database_ module creates, if needed, the file _db/database.db_ and initializes it:

* The _devices_ table persists basic information about actors,
most imporantly the _deviceID_ and _deviceUID_ that are used to uniquely identify a particular actor.

* The _deviceProps_ table persists information about "virtual" actors (e.g., _place/1_) along
device-specific information (e.g., pairing information for the Philips Hue bridge).

* The _groups_ table persists information about the grouping structure,
and the _members_ table persists membership information about each group.

* The _events_, _tasks_, and _activities_ tables are described in [Activities](Activities.md).

Once the database is initialized, the _database_ module_ starts the _device_ module.

## Device module
On startup,
the _device_ module creates an entry for the root of the actor tree ('steward.actors.device'),
which is described in [Actors](Actors.md).

Next,
the category-specific prototypes are loaded by starting all files in the _devices/_ directory with a matching name of
_/^device-.*\.js/_.
In turn,
each of these category-specific files starts all files in an appropriately named subdirectory (e.g., _devices/device-climate/_.

The _device_module implements a device-generic driver:

* children: returns an array of deviceIDs corresponding to the dynamic list of children associated with a drive
(e.g., the Philips Hue driver).
In most cases, this returns a zero-length array.

* proplist: returns the six properties associated with a particular actor:

    * whatami: the prototype identifier, e.g., '/device/lighting/hue'

    * whoami: a pairing of the actor type (typically 'device') and a number, e.g., 'device/1'

    * name: the user-friendly name 

    * status: the prototype-specific status

    * info: prototype-specific state information

    * updated: the time of the last change to any of the preceding three properties

In addition,
there are a small number of utility functions that can be used by device-specific drivers.

## Steward module
On startup,
the _steward_ module examines the list of network interfaces on the system,
ignorning those that are either local (i.e., the loopback interface) or associated with virtual machines.
For each the remaining interfaces,
it starts a packet capture session to examine ARP packets and primes the pump by attemping to connect to TCP port 8888 on five
unpredictably chosen addresses.
__(Note that priming the pump is unnecessary when the steward is able to read the kernel's arp table.)__

The steward then sets up the infrastructure to report aggregate state information and then re-schedules itself.
This is done so the capture sessions can run to determine the MAC address of the machine that the steward is running on.
Once that occurs, the steward computes its own UUID and starts the _server_ module.
It then loads the pseudo actors (e.g., 'place/1') and begins its observer-perform (or 'activity') loop.

### The Observe-Perform Loop
In a sense,
this is the heart of the _steward_.
Once a second, the _scan_ function in the steward module is run.
This looks through the list of all events known to the steward.
There are three possibilities:

* The event is '.condition',
which indicates that the steward should look at the actors' state information to see if the event should be considered observed.

* The event isn't being observed, in which case, the steward publishes a request for the event to be observed.
(When the actor that is supposed to observe the event is able to do so, in response it will call the _report_ function.)

* The event is being observed.

Next,
the _scan_ function looks through the list of armed activities,
and if the event associated with an activity has been observed,
then the associated task is marked for subsequent performance.
The _scan_ function then looks through the list of all non-conditional events known to the steward and resets their "observed"
status.

Then,
the _scan_function then looks through the list of all tasks known to the steward,
and constructs a list of tasks to be performed.
For each task it publishes a request for the task to be performed.

**NOTE THAT THIS ALGORITHM DOES NOT IMPLEMENT TEMPORAL EVALUATION**

## Server module
On startup,
the _server_ module listens for _http:_ and _wss:_ traffic on an unused port.
(If an HTTP connection does not upgrade to WebSockets,
then static files are served from the _sandbox/_ directory.)
The _server_ module then advertises itself using multicast DNS,
loads the discovery modules,
and then loads the routing modules.

## Discovery modules
There are four discovery modules that are started by the _server_ module.

### SSDP discovery
This module creates an SSDP instance,
both to listen for SSDP announcements and to advertise itself as a basic device on each network interface discovered by the
_steward_ module.
In addition to listening on port 1900 for multicast traffic,
it also listens on an unused port for UPnP notifications.
The module also creates a file called _sandbox/index.xml_ that lists the (minimal) UPnP capabilities of the steward.

The _device_ module is informed whenever a new device is discovered via UPnP.

For UPnP-based actors,
the module provides routines for roundtrip'ing UPnP traffic and subscribing to notifications.

### BLE discovery
This module turns on the system's BLE module and starts scanning.
Upon discoverying a device,
it scans the services and characteristics advertised by the device,
then determines the prototype associated with those characteristcs,
and then informs the _device_ module.

The module's _register_ method is used to associate BLE characteristics with a particular device-specific driver.

### TCP port discovery
The module's _pairing_ method is used to associate port numbers (and optionally OUI prefixes) with a callback in a
particular device-specific driver.
This callback determines whether the _device_ module should be informed.

Every five seconds, the module does a port scan of registered port numbers on IP addresses that have not responded to those
port numbers.
If a connection is made, then the device-specific callback is invoked.

### MAC OUI discovery
The module's _pairing_ method is used to associate OUI prefixes with a callback in a particular device-specific driver.
This callback determines whether the _device_ module should be informed.

Whenever the _steward_ module captures an ARP request,
it invokes a method in this module to see if either MAC address has not previously been examined and whether the device-specific
callback should be invoked.

## Routing modules
At present, the _steward_ has three API modules.

## Console API
Authorized clients connect to the

    /console

resource in order to receive logging entries from the _steward_.
When a client first connects to this resource,
most actors in the system will present a brief synopsis.
Thereafter log entries will be sent to the client, e.g.,

    {
      "climate": [
        {
          "date": "2013-06-18T08:12:12.787Z",
          "level": "info",
          "message": "device\/44",
          "meta": {
            "status": "present"
          }
        },
        {
          "date": "2013-06-18T08:12:12.788Z",
          "level": "info",
          "message": "device\/45",
          "meta": {
            "status": "present"
          }
        },
        {
          "date": "2013-06-18T08:12:12.788Z",
          "level": "info",
          "message": "device\/49",
          "meta": {
            "status": "present"
          }
        }
      ]
    }

Finally,
any traffic sent from the client is ignored.


## Inspection API
Authorized client may connect to the

    /

resource in order to inspect available resources and API calls, e.g.,

    {
      "requestID": 0,
      "result": {
        "\/console": {
          
        },
        "\/manage": {
          "\/api\/v1\/activity\/create": {
            "access": "write",
            "required": {
              "uuid": true,
              "name": true,
              "event": "actor",
              "task": "actor"
            },
            "optional": {
              "comments": true,
              "armed": [
                "true",
                "false"
              ]
            },
            "response": {
              
            },
            "comments": [
              "the uuid is specified as the create suffix",
              "the event actor must resolve to an event or a group of events",
              "the task actor must resolve to an event or a group of tasks"
            ]
          },
        },

        ...

        "\/": {
          
        }
      }
    }


## Management API
Authorized clients connect to the

    /manage

resource in order to manage [devices](Devices.md) or [activities, events, tasks, and groups](Activities.md).


## To be implemented
* Temporal Ordering

* Tags

* Access Control

* The _tap_
