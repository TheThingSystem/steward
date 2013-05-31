# Bootstrapping a BeagleBone Black

Starting with a new board the first step is to plug the board into your laptop using the mini-USB cable provided. The BeagleBone has three USB ports, a full sized USB-A port, a micro-USB port and a mini-USB port. The mini port is located on the reverse side of the board near the Ethernet jack.

The board should boot and you should see a solid blue light next to the 5V power jack. When startup is completed, a new mass storage device called _BEAGLEBONE_ should appear on your desktop.

Open up the mass storage device and click on the START.htm file to open it in a browser. You should probably read through this file to familiarise yourself with the BeagleBone's capabilities.

## Installing the Drivers

The BeagleBone Black comes with both Network and Serial drivers for Mac OS X. The first gives you network-over-USB access to your BeagleBone, the second direct serial access. You'll need both sets of drivers. 

### Installing the Network Driver

Go to _Step #2_ in the _START.htm" file and grab the Network (_HoRNDIS-rel4.pkg_) driver file from the BeagleBone's mass storage device.

Install the driver by clicking on the _pkg_ file and following the instructions.

### Installing the FTDI Serial Driver

It's possible that the Serial Driver (_FTDI_Ser.dmg_) file provided with the BeagleBone Black is not up to date or is just broken, however it does not install correctly. 

The solution is [download the latest 2.2.18 drivers](http://www.ftdichip.com/Drivers/VCP/MacOSX/FTDIUSBSerialDriver_v2_2_18.dmg) and install the driver with support for OS X 10.4 - 10.7, and then hand edit a kernel extension configuration file.

Open the /System/Library/Extensions/FTDIUSBSerialDriver.kext/Contents/Info.plist file in an editor, and inside the <IOKitPersonalities> dictionary add the following definitions,

		<key>BeagleBone XDS100v2 JTAG</key>
		<dict>
			<key>CFBundleIdentifier</key>
			<string>com.FTDI.driver.FTDIUSBSerialDriver</string>
			<key>IOClass</key>
			<string>FTDIUSBSerialDriver</string>
			<key>IOProviderClass</key>
			<string>IOUSBInterface</string>
			<key>bConfigurationValue</key>
			<integer>1</integer>
			<key>bInterfaceNumber</key>
			<integer>0</integer>
			<key>idProduct</key>
			<integer>42704</integer>
			<key>idVendor</key>
			<integer>1027</integer>
		</dict>
		<key>BeagleBone XDS100v2 Serial</key>
		<dict>
			<key>CFBundleIdentifier</key>
			<string>com.FTDI.driver.FTDIUSBSerialDriver</string>
			<key>IOClass</key>
			<string>FTDIUSBSerialDriver</string>
			<key>IOProviderClass</key>
			<string>IOUSBInterface</string>
			<key>bConfigurationValue</key>
			<integer>1</integer>
			<key>bInterfaceNumber</key>
			<integer>1</integer>
			<key>idProduct</key>
			<integer>42704</integer>
			<key>idVendor</key>
			<integer>1027</integer>
		</dict>

While it's theoretically possible to go ahead and unload and reload the kernel extension using the following commends,

    sudo kextunload -b com.FTDI.driver.FTDIUSBSerialDriver
    sudo kextload -b com.FTDI.driver.FTDIUSBSerialDriver

it's probably that the system isn't going to let you do that at this point,

    (kernel) Can't unload kext com.FTDI.driver.FTDIUSBSerialDriver; classes have instances:
    (kernel)     Kext com.FTDI.driver.FTDIUSBSerialDriver class FTDIUSBSerialDriver has 2 instances.
    Failed to unload com.FTDI.driver.FTDIUSBSerialDriver - (libkern/kext) kext is in use or retained (cannot unload).

and you'll have to *reboot your Mac* to reload the driver.

## Installing the Operating System

The main difference from the [Raspberry Pi](RaspberryPi.md) for setup is that the BeagleBone ships with the Angstrom Linux distribution and boots from onboard flash memory. That means we don't have to up do an initial OS installation before talking to the board. However, it's advisable to go ahead and update the OS before continuing in any case.

###Downloading the Operating System

Download the [latest image](http://beagleboard.org/latest-images) of the Angstrom Distribution. You want the latest image for the BeagleBone Black, marked as eMMC flasher. 

The image comes as a .xz file. You can install the XZ Utils which will let you unzip the compressed archive by using MacPorts or Homebrew.

    xz -d BBB-eMMC-flasher-2013.05.27.img.xz 

After decompression is should be around 3.4GB. Now go ahead and insert your microSD card in its adaptor into your Macbook. 

Open up a Terminal window and type *df -h*, remember the device name for your micro SD Card. In my case it's */dev/disk1*. We'll need to use the raw device, */dev/rdisk1*.

    Filesystem      Size   Used  Avail Capacity  iused    ifree %iused  Mounted on
    /dev/disk0s2   699Gi  367Gi  332Gi    53% 96214802 86992771   53%   /
    devfs          206Ki  206Ki    0Bi   100%      714        0  100%   /dev
    map -hosts       0Bi    0Bi    0Bi   100%        0        0  100%   /net
    map auto_home    0Bi    0Bi    0Bi   100%        0        0  100%   /home
    /dev/disk1s2    59Gi   33Gi   26Gi    57%  8739054  6768902   56%   /Volumes/SD Card

Unmount the card,

    sudo diskutil unmount /dev/disk1s2

rather than ejecting it by dragging it to the trash. Then in the Terminal change directory to your downloads folder and type

    sudo dd bs=1m if=BBB-eMMC-flasher-2013.05.27.img of=/dev/rdisk1

if the above command report an error _"dd: bs: illegal numeric value"_, change *bs=1m* to *bs=1M*. The card should automatically remount when _dd_ is done.

Eject the card with the command, 

    sudo diskutil eject /dev/rdisk1

###Flashing the BeagleBone Black

Power the BeagleBone Black down and [locate the "User Boot" button](http://learn.adafruit.com/system/assets/assets/000/008/680/medium800/BeagleBoneBlack.jpeg). It's located on the top side of the board, directly above the micro SD card slot which is located on the reverse side along with the mini and micro USB sockets.

Insert the micro SD card in the slot and, whilst holding the "User Boot" button down, plug the board into mini-USB connector. Hold the button down until you see the bank of 4 LEDs light up for a few seconds. You can now release the button.

It will take anywhere from *30 to 45 minutes to flash the image* onto the on-board flash storage. Once done, the bank of 4 LEDs near the Ethernet jack will all light up and stay lit up. Power down the board at this point.

