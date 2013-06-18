# d3

This is an interface to the _steward_ using the [D3.js](http://en.wikipedia.org/wiki/D3.js) package.
IT is designed with the iPad [Status Board](http://panic.com/statusboard/) app in mind,
so it should "look good" both on a browser and in status board.

## Limitations
__This is an early implementation.__

The two key limitations are:

* The code reads from a static file, rather than using websockets-based API.

* The code does monitoring, but not control.

Once the steward's security and remote-access frameworks are in place, then these limitations will be removed.
At present, this implementation, instead of talking directly to the steward gets its files from a public Dropbox folder.
This folder not only has HTML and JavaScript files,
but also has JSON files that are created by the steward.
The contents of these files are identical to what the correponsping websockets-based API calls produce.

From the steward's perspective,
it is simply putting files in a directory that you tell it to.

This allows pre-alpha clients to monitor the steward remotely without any proxy.

## Basic Approach
The client periodically makes a WS call to get the current state of the steward, i.e., it connects to the steward's

    /manage

resource, and periodically issues the

    /api/v1/actor/list

call with a _depth_ parameter of "all".
This returns the state of the all the actors in the steward.
The results are then processed into multiple data structures for subsequent display purposes.

### Home Page
The home page shows individual devices, device types, and device groups.

Devices are shown using a textual name above a colorful icon.
The icon's color denotes the state of the device.
For most devices,
the state is green;
however, lighting devices may have a color that approximates what is being emitted.

Device types are shown using a textual name below a monocrhome icon.

Device groups are shown using a textual name.

Clicking on an individual device (or a device type/group containing only one device) brings up the device drill-down page;
otherwise, clicking on a device type/group brings up the multi drill-down page.

### Device Drill-Down
The device drill-down page consists of two parts:

* the "thing" logo in the upper left-hand corner -- click on this to go back to where you were

* a multi-arc'd circle

The left-hand side of the circle identifies the device both by color namd name,
and then contains a number of textual links for tasks to be performed (e.g., "turn the light on").

The right-hand side of the circle shows one or more readings from the device.
The outer most reading, "TIME", indicates the last time that the steward changed the information associated with this device.

### Multi Drill-Down

The multiple drill-down page also consists of two parts;
however, there are two differencds:

* the left-hand side of the circle shows the devices that are being presented (click on any of these to get a device drill-down page)

* the right-hand side of the circle shows the primary reading for each of the devices.
