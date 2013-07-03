#Starting the steward

Welcome to the steward. When the _steward_ starts, it will automatically discover devices via a variety of mechanisms:

* It will look on all attached networks for things via [SSDP](http://en.wikipedia.org/wiki/Simple_Service_Discovery_Protocol),
[TCP port scanning](http://en.wikipedia.org/wiki/Port_scanning#TCP_scanning),
and [MAC address prefixes](http://en.wikipedia.org/wiki/Organizationally_Unique_Identifier).

* It will look for [Bluetooth low energy](http://en.wikipedia.org/wiki/Bluetooth_low_energy) things.

* It will look for USB things.

The steward also needs your help.
When the steward starts from scratch, it doesn't know it's physical location.
In order to calculate solar events such as sunrise, it needs to know it's physical coordinates.

Normally, when the first client does a successful _tap_,
it will ask you for permission to configure the steward with location and other information.
However, the _tap_ isn't implemented yet;
so, you will need to edit a little .html file that creates a "place" actor with this information.

Actually, none of the clients are implemented yet!
So, you have to use .html files to pretty much do everything now.

## Monitoring
When the steward starts, it will be listening for https traffic on port 8888.
Start by visiting

        https://127.0.0.1:8888/

which reports the status of the steward in three parts (activities, devices, and logs).

__If warned about the certificate as being untrusted,
please be sure to "permanently accept" the certificate as valid for 127.0.0.1__


## Configuration

Take a look at the _sandbox/bootstrap.html_ file.
Until the first client is written, this is your new best friend.

The first thing you want to do is look for

    // BEGIN: BOOTSTRAP

    var place_info = { ... };

    var prowl_info = { ... };

    var status_info = { ... };

    ...

    // END: BOOTSTRAP

Edit the file to put the appropriate values in those variables and then visit

    https://127.0.0.1:8888/bootstrap.html

in a browser. This will use the management API to set these variables in the steward.

__If warned about the certificate as being untrusted,
please be sure to "permanently accept" the certificate as valid for 127.0.0.1__

The changes will be reflected when you look at

    https://127.0.0.1:8888/

Congratulations! The steward is now configured and running.
