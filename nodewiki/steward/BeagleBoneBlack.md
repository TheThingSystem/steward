# Bootstrapping a BeagleBone Black

Starting with a new board the first step is to plug the board into your laptop using the mini-USB cable provided. The BeagleBone has two USB ports, a full sized USB-A port, and a mini-USB port. The mini port is located on the reverse side of the board near the Ethernet jack.

The board should boot and you should see a solid blue light next to the 5V power jack. When startup is completed, a new mass storage device called _BEAGLEBONE_ should appear on your desktop.

Open up the mass storage device and click on the _START.htm_ file to open it in a browser. You should probably read through this file to familiarise yourself with the BeagleBone's capabilities.

_NOTE: The port on the opposite side of the board from the full sized USB-A jack is a mini-HDMI jack, not a micro USB port as it might appear at first glance._

_NOTE: The board uses the same power supply as the previous BeagleBone. 5VDC, 1A, 2.1mm, center positive. The power supply is not supplied with the board. However if you are going to configure the board to use a WiFi adaptor you should use a supply with a 2A rating otherwise you'll get intermittent crashes due to brown outs._

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

Download the [latest image](http://beagleboard.org/latest-images) of the Angstrom Distribution. You want the latest image for the BeagleBone Black, marked as eMMC flasher. 

The image comes as a .xz file. You can install the XZ Utils which will let you unzip the compressed archive by using MacPorts or Homebrew.

    xz -d BBB-eMMC-flasher-2013.05.27.img.xz 

After decompression is should be around 3.4GB, so you will need a micro SD card at least 4GB in size to handle the image. Go ahead and insert the microSD card in its adaptor into your Macbook. 

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


## Connecting to the BeagleBone Black

There are four methods to connect to the board. When you connect to the board the default *root password is blank* so just hit return to login to the board.

### Connecting via USB Serial

Several _/dev/tty.usbmodem*_ devices should be present when the board is plugged in via the mini-USB cable.

Open up [CoolTerm](http://freeware.the-meiers.org/CoolTermMac.zip) or a similar program and you can connect to your board at 115,200 8-N-1 (Local Echo should be off) on one of these ttys offered by the board. Of the three offered by the board,

    crw-rw-rw-  1 root  wheel   18,   8 31 May 20:14 /dev/tty.usbmodem401211
    crw-rw-rw-  1 root  wheel   18,  16 31 May 21:43 /dev/tty.usbmodem401213
    crw-rw-rw-  1 root  wheel   18,  14 31 May 21:43 /dev/tty.usbmodem7

only _/dev/tty.usbmodem401213_ connected for me. Your milage may vary at this point.

### Connecting via FTDI Serial

Alternatively you can use a 3.3V [FTDI-to-USB](https://www.adafruit.com/products/70) cable to connect to the debug (J1) header block. Pin 1 on the cable is the black wire and connects to pin 1 on the board, the pin with the white dot next to it.

Open up [CoolTerm](http://freeware.the-meiers.org/CoolTermMac.zip) again and you can connect to your board at 115,200 8-N-1 (Local Echo should be off) via the _usbserial_ port offered by the cable, e.g.

    crw-rw-rw-  1 root  wheel   18,  12 31 May 20:40 /dev/tty.usbserial-FTE4XVKD

While I've had this method up and working, I've had intermittent luck with it - USB Serial seems to be more reliable once you have the FTDI drivers installed and working on your Mac.

###Connecting via network over USB

Plug the BeagleBone back into the mini-USB cable connected to your Mac, and wait for it to boot back up. When it has finished booting, you should be able to once again reach the onboard webpages at [http://192.168.7.2/](http://192.168.7.2/)  in your browser, but you should also be able to SSH to the board,

     ssh root@192.168.7.2
     root@192.168.7.2's password: 
     root@beaglebone:~# 

###Connecting via the local network

Plug an Ethernet cable into the jack on the board. After a moment the two lights on the jack (green and yellow) should go live and indicate that it is on the network. You can either login to your board via one of the methods above to find out what its IP address is, or check your router.

    root@beaglebone:~# ifconfig
    eth0      Link encap:Ethernet  HWaddr C8:A0:30:AF:C2:18  
              inet addr:192.168.1.90  Bcast:192.168.1.255  Mask:255.255.255.0
              inet6 addr: fe80::caa0:30ff:feaf:c218/64 Scope:Link
              UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
              RX packets:1843 errors:0 dropped:1 overruns:0 frame:0
              TX packets:83 errors:0 dropped:0 overruns:0 carrier:0
              collisions:0 txqueuelen:1000 
              RX bytes:150073 (146.5 KiB)  TX bytes:12398 (12.1 KiB)
              Interrupt:56 
    
    lo        Link encap:Local Loopback  
              inet addr:127.0.0.1  Mask:255.0.0.0
              inet6 addr: ::1/128 Scope:Host
              UP LOOPBACK RUNNING  MTU:65536  Metric:1
              RX packets:4 errors:0 dropped:0 overruns:0 frame:0
              TX packets:4 errors:0 dropped:0 overruns:0 carrier:0
              collisions:0 txqueuelen:0 
              RX bytes:280 (280.0 B)  TX bytes:280 (280.0 B)

    usb0      Link encap:Ethernet  HWaddr 06:74:70:BE:E7:97  
              inet addr:192.168.7.2  Bcast:192.168.7.3  Mask:255.255.255.252
              UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
              RX packets:4688 errors:0 dropped:0 overruns:0 frame:0
              TX packets:4537 errors:0 dropped:0 overruns:0 carrier:0
              collisions:0 txqueuelen:1000 
              RX bytes:316153 (308.7 KiB)  TX bytes:675250 (659.4 KiB)

If your router is capable you might want to configure it so that the BeagleBone's IP address is fixed in future and that it's got a local name that you can use rather than a raw IP address.

##Updating the Operating System

_NOTE: You must be connected using the local network method, otherwise the BeagleBone won't be able to reach the package servers to download new software._

Despite installing the latest image, we should upgrade the installed packages to the latest versions. Login to BeagleBone via the local network and type,

    opkg update

then

    mkdir /home/root/tmp
    opkg -t /home/root/tmp upgrade

This will take some time. You might want to go make a cup of coffee and maybe a grilled cheese sandwich.

##Configuring WiFi

_NOTE: An external power supply is required to use WiFi, due to the power requirements. Flaky behavior, crashes, etc will result if you do not plug in a 5V 2000mA adapter. If you're still having problems, try an external powered USB hub._

_NOTE: These instructions are for the [miniature WiFi (802.11b/g/n module)](http://www.adafruit.com/products/814) sold by Adafruit._



Login to the BeagleBone via 



