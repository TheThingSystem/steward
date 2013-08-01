#Installation

There are a number of different ways to install the _steward_ software. After installation please see the documentation [on how to start the Steward](02_Running.md).

##Installation from source

If you want to install the _steward_ from source you should follow the appropriate instructions for your platform:

* [MacOSX](01_MacOSX.md)

* [RaspberryPi](01_RaspberryPi.md)

## Disk images

There is a raw disk disk image available for the Raspberry Pi based around the latest version of Raspbian. You will need a 4GB SD card.

Go ahead and download the [latest version of our distribution](sdcard_rpi_0.3.img). Insert your SD card into your Macbook. Open up a Terminal window and type *df -h*, remember the device name for your SD Card. In my case it's */dev/disk1*. We'll need to use the raw device, */dev/rdisk1*.

    Filesystem      Size   Used  Avail Capacity  iused    ifree %iused  Mounted on
    /dev/disk0s2   699Gi  367Gi  332Gi    53% 96214802 86992771   53%   /
    devfs          206Ki  206Ki    0Bi   100%      714        0  100%   /dev
    map -hosts       0Bi    0Bi    0Bi   100%        0        0  100%   /net
    map auto_home    0Bi    0Bi    0Bi   100%        0        0  100%   /home
    /dev/disk1s1    59Gi   33Gi   26Gi    57%  8739054  6768902   56%   /Volumes/SD Card

Unmount the card,

    sudo diskutil unmount /dev/disk1s1

rather than ejecting it by dragging it to the trash. Then in the Terminal change directory to your downloads folder and type

    sudo dd bs=1m if=2013-05-25-wheezy-raspbian.img of=/dev/rdisk1

if the above command report an error _"dd: bs: illegal numeric value"_, change *bs=1m* to *bs=1M*. The card should automatically remount when _dd_ is done.

Eject the card with the command, 

    sudo diskutil eject /dev/rdisk1

Insert the card in the Raspberry Pi, plug the Pi into the Ethernet, and then connect the power to start it booting. A red LED will initially come on, however the green ACT LED should start flashing, and the orange FDX and LNK LEDS should light up if the boot works correctly. If you run into problems you can [troubleshoot](http://elinux.org/R-Pi_Troubleshooting#Power_.2F_Start-up).

The _steward_ should automatically start at boot time.

##Other platforms

The _steward_ is currently being tested on the following platforms. Partial instructions for these new platforms exist but aren't guaranteed to work:

* [BeagleBone Black](01_BeagleBoneBlack.md)

* [BeagleBone](01_BeagleBone.md)  Rev.A6 (white)

##Installation using Package Management

At the moment installation of the steward from source, and is a fairly complicated and meant for developers. We intend to simplify this process by providing packages for various flavours of Linux as well as _MacPorts_ for OS X.