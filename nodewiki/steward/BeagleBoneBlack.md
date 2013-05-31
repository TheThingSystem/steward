# Bootstrapping a BeagleBone Black

Starting with a new board the first step is to plug the board into your laptop using the mini-USB cable provided. The BeagleBone has three USB ports, a full sized USB-A port, a micro-USB port and a mini-USB port. The mini port is located on the reverse side of the board near the Ethernet jack.

The board should boot and you should see a solid blue light next to the 5V power jack, and flashing blue lights next to the Ethernet jack. A new mass storage device called _BEAGLEBONE_ should appear on your desktop.

Open up the mass storage device and click on the START.htm file to open it in a browser. You should probably read through this file to familiarise yourself with the BeagleBone's capabilities.

The main difference from the Pi for setup is that the BeagleBone ships with the Angstrom Linux distribution and boots from onboard flash memory. That means we don't have to up do an initial OS installation before talking to the board. However, we will have to go ahead and update 

