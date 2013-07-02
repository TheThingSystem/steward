_NOTE: These instructions refer to the BeagleBone Rev.A6 (white) rather than the newer [BeagleBone Black](BeagleBoneBlack.md). Please see the seperate instructions for bootstrapping the newer board._

*Bootstrapping a BeagleBone (White)

Starting with a new board the first step is to plug the board into your laptop using the mini-USB cable provided. The BeagleBone has two USB ports, a full sized USB-A port, and a mini-USB port. The mini port is located on the reverse side of the board near the Ethernet jack.

The board should boot and you should see a solid green light next to the 5V power jack. When startup is completed, a new mass storage device called BEAGLE_BONE should appear on your desktop.

Open up the mass storage device and click on the START.htm file to open it in a browser. You should probably read through this file to familiarise yourself with the BeagleBone's capabilities.

## Installing the Drivers

The BeagleBone Black comes with both Network and Serial drivers for Mac OS X. The first gives you network-over-USB access to your BeagleBone, the second direct serial access. You'll need both sets of drivers. 

### Installing the Network Driver

Go to _Step #2_ in the _START.htm_ file and grab the Network (HoRNDIS-rel4.pkg) driver file from the BeagleBone's mass storage device.

Install the driver on your Mac by clicking on the _pkg_ file and following the instructions. 

After installation you should at this point be able to access the onboard web server of the BeagleBone Black over the USB cable by going to [http://192.168.7.2/](http://192.168.7.2/) in a browser.

_NOTE: Unfortunately we can't necessarily directly access the board using SSH at this point. There seems to be something in the stock image that causes some boards to fail to bring up the SSH server properly._

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

Once you've done so you enter,

    kextstat -l | grep FTDI

in the terminal, you should see something like this,

    125    0 0xffffff7f81b6c000 0x8000     0x8000     com.FTDI.driver.FTDIUSBSerialDriver (2.2.18) <124 33 5 4 3 1>

which indicates that the driver has loaded correctly.

## Installing the Operating System

The main difference from the [Raspberry Pi](RaspberryPi.md) for setup is that the BeagleBone ships with the Angstrom Linux distribution and boots from onboard flash memory. That means we don't have to up do an initial OS installation before talking to the board. However, it's advisable to go ahead and update the OS before continuing in any case.

###Downloading the Operating System

Download the [latest image](http://beagleboard.org/latest-images) of the Angstrom Distribution. You want the latest image for the