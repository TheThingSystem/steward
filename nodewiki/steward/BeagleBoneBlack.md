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

##Enabling NTP

_NOTE: You must be connected using the local network method, otherwise the BeagleBone won't be able to reach the Internet to download new software._

The BeagleBone ships with no _ntp_ installed, and no battery backed up clock. That means that the date is set on boot to Jan 1 2000. This causes all sort of problems, including making SSL certificates invalid.

We want to install _ntp_,

    okpg install ntp

Next, find a NTP server that is close to your location. We need to do this as it is not a good idea to use a NTP root server. Go to [http://www.pool.ntp.org](http://www.pool.ntp.org) and find servers in your zone. I'm [in the United Kingdom](http://www.pool.ntp.org/zone/uk) so I want to use,

    server 0.uk.pool.ntp.org
    server 1.uk.pool.ntp.org
    server 2.uk.pool.ntp.org
    server 3.uk.pool.ntp.org

Replace the default _/etc/ntp.conf_ file with the following,

    #ntp configuration file
    
    # The driftfile must remain in a place specific to this machine
    driftfile /etc/ntp.drift
    logfile /var/log/ntpd.log
    
    # NTP Servers for United Kingdom from www.pool.ntp.org
    server 0.uk.pool.ntp.org
    server 1.uk.pool.ntp.org
    server 2.uk.pool.ntp.org
    server 3.uk.pool.ntp.org
    
    # Using local hardware clock as fallback
    # Disable this when using ntpd -q -g -x as ntpdate or it will sync to itself
    # server 127.127.1.0 
    # fudge 127.127.1.0 stratum 14
         
    # Defining a default security setting
    restrict 192.168.1.0 mask 255.255.255.0 nomodify notrap

Next you need to set your local time, again mine is in the United Kingdom. By default the BeagleBone is in UTC, so

    rm /etc/localtime
    ln -s /usr/share/zoneinfo/Europe/London /etc/localtime

If you're not in the United Kingdom drill down into the _/usr/share/zoneinfo/_ directory structure to find your local time file.

Now go ahead and setup the _ntp_ service,

    systemctl enable ntpdate.service
    systemctl enable ntpd.service

You now need to go ahead and edit the _/lib/systemd/system/ntpdate.service_ file, changing the line

    ExecStart=/usr/bin/ntpdate-sync silent

to read

    ExecStart=/usr/bin/ntpd -q -g -x

since the BeagleBone doesn't have a time-of-year (TOY) chip to maintain the time during periods when the power is off, and if we don't do this _ntp_ would assume something is terribly wrong and shuts itself down.

You now need to _reboot your BeagleBone_ to get _ntp_ working.

##Fixing Git

_NOTE: You must be connected using the local network method, otherwise the BeagleBone won't be able to reach the Internet to download new software._

You'll need to configure your Git identity before checking out the source otherwise things won't go smoothly,

    git config --global user.name "Alasdair Allan"
    git config --global user.email alasdair@babilim.co.uk

however there is also a problem with SSL connections and certificates for Git. Go ahead and set the following options,

    git config --global http.sslVerify true
    git config --global http.sslCAinfo /etc/ssl/certs/ca-certificates.crt
    git config --global http.sslCApath /etc/ssl/certs/ca-certificates.crt

which should fix things and allow us to clone from _https_ repositories.

_NOTE: This fix doesn't always seem to work depending on the state (updates/upgrades) of the OS at the time. It's possible that Git is using gnutls rather than openssl which is more fussy about the state of order of chained certificates in the certificates file, and I'm still poking around to see if I can get it in better order. If this doesn't work for you I'd recommend turing sslVerify off for now._

##Installing the Python Compiler

The BeagleBone doesn't come with the Python compiler, which is need for Node to build, so

    opkg install python-compiler

before continuing.

##Installing Node.js

Go ahead and checkout Node.js

    git clone https://github.com/joyent/node.git

change directory and switch to v0.10.12 release.

    cd node
    git checkout v0.10.12 -b v0.10.12

Now go ahead and build,

    ./configure
    make

This will take a long time, so go make a coffee or a toasted sandwich.

Now go ahead and install node and npm,

    make install

You might want to install nodewiki at this point,

    npm install -g nodewiki

##Installing Node Version Manager

Go ahead and install the [node version manager (nvm)](https://github.com/creationix/nvm),

    git clone git://github.com/creationix/nvm.git ~/.nvm
    echo ". ~/.nvm/nvm.sh" >> ~/.bashrc  
    . ~/.nvm/nvm.sh

make our version of Node the default

    nvm alias default v0.10.12

##Installing node-gyp

We might also need node-gyp the Node.js native addon build tool

    git clone https://github.com/TooTallNate/node-gyp.git
    cd node-gyp
    npm install -g node-gyp

this will be needed if we run into problems and need to rebuild any add on modules with code changes.





#Appendix - Updating the Operating System

_NOTE: You must be connected using the local network method, otherwise the BeagleBone won't be able to reach the package servers to download new software._

_NOTE: This will generate a lot of errors. About one time in four the board will be unbootable after the update. I would therefore hold off doing this update at this point until more work has been done on the OS distribution._

Despite installing the latest image, we should upgrade the installed packages to the latest versions. Login to BeagleBone via the local network and type,

    opkg update

then

    mkdir /home/root/tmp
    opkg -t /home/root/tmp upgrade

This will take some time. You might want to go make a cup of coffee and maybe a grilled cheese sandwich.

#Appendix - Configuring WiFi

_NOTE: An external power supply is required to use WiFi, due to the power requirements. Flaky behavior, crashes, etc will result if you do not plug in a 5V 2000mA adapter. If you're still having problems, try an external powered USB hub._

_NOTE: These instructions are for the [miniature WiFi (802.11b/g/n module)](http://www.adafruit.com/products/814) sold by Adafruit._

_NOTE: These instructions are not guaranteed to work. At this point unless you really need it, I'd avoid trying to configure WiFi of the BeagleBone until more work is done on the OS distribution side._

Login to the BeagleBone via the local network grab the latest drivers from the Realtek site,

    wget ftp://WebUser:r3iZ6vJI@95.130.192.218/cn/wlan/RTL8192xC_USB_linux_v3.4.4_4749.20121105.zip
    unzip RTL8192xC_USB_linux_v3.4.4_4749.20121105.zip 
    cd RTL8188C_8192C_USB_linux_v3.4.4_4749.20121105/driver
    tar -zxvf rtl8188C_8192C_usb_linux_v3.4.4_4749.20121105.tar.gz
    cd rtl8188C_8192C_usb_linux_v3.4.4_4749.20121105

Edit the makefile,

     vi rtl8188C_8192C_usb_linux_v3.4.4_4749.20121105/Makefile

changing line 39 to read, 

     CONFIG_PLATFORM_I386_PC = n

and adding  this somewhere around line 64,

    CONFIG_PLATFORM_ARM_BEAGLE = y

add the following linestowards the end of the other platform configs (at line 455),

    ifeq ($(CONFIG_PLATFORM_ARM_BEAGLE), y)
    EXTRA_CFLAGS += -DCONFIG_LITTLE_ENDIAN
    ARCH := arm
    CROSS_COMPILE := /usr/bin/arm-angstrom-linux-gnueabi-
    KSRC := /usr/src/kernel
    KVER  := $(shell uname -r)
    MODDESTDIR := /lib/modules/$(KVER)/kernel/drivers/net/wireless/
    MODULE_NAME := rtl8192cu
   endif

save and exit. We need to build the kernel module, so we need the kernel development packages

    opkg install kernel-headers  
    opkg install kernel-dev

Make the helper scripts,

    cd /usr/src/kernel

edit the Makefile to remove the line which will turn warning on implicit declarations into errors, look for the -Werror, and then,

    make scripts

Compile and install the driver,

    cd /home/root/RTL8188C_8192C_USB_linux_v3.4.4_4749.20121105/driver
    cd rtl8188C_8192C_usb_linux_v3.4.4_4749.20121105
    make
    make install

Plug your Wifi adapter in the USB socket if it isn't already and reboot the BeagleBone. After rebooting the board, log back in and check dmesg. 

_NOTE: Due to the way the connection manager works, you (probably?) can't have Ethernet and WiFi up simultaneously. So disconnect your Ethernet cable, which was previously plugged in for downloading updates, and connect back to the board using one of the Serial methods._

You should see something like this,

    [   12.513570] rtl8192cu 1-1:1.0: usb_probe_interface
    [   12.513602] rtl8192cu 1-1:1.0: usb_probe_interface - got id
    [   12.514698] rtl8192cu: Chip version 0x10
    [   12.836885] rtl8192cu: MAC address: 00:e0:4c:09:3e:5e
    [   12.836920] rtl8192cu: Board Type 0
    [   12.837036] rtlwifi: rx_max_size 15360, rx_urb_num 8, in_ep 1
    [   12.837219] rtl8192cu: Loading firmware rtlwifi/rtl8192cufw.bin
    [   12.841138] usbcore: registered new interface driver rtl8192cu
    [   13.294573] ieee80211 phy0: Selected rate control algorithm 'rtl_rc'
    [   13.296188] rtlwifi: wireless switch is on
    [   16.804823] rtl8192cu: MAC auto ON okay!
    [   16.892552] rtl8192cu: Tx queue select: 0x05
    [   17.433002] IPv6: ADDRCONF(NETDEV_UP): wlan0: link is not ready

and if you type 

    ifconfig wlan0

you should see something like this,

    wlan0     Link encap:Ethernet  HWaddr 00:E0:4C:09:3E:5E  
              UP BROADCAST MULTICAST  MTU:1500  Metric:1
              RX packets:0 errors:0 dropped:0 overruns:0 frame:0
              TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
              collisions:0 txqueuelen:1000 
              RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

there's a link, but no connection as yet. We need to set that up in the connection manager. Go ahead and open the _/var/lib/connman/settings_ file in an editor, and ensure that WiFi is enabled,

    [global]
    OfflineMode=false
    
    [Wired]
    Enable=true
    
    [WiFi]
    Enable=true

    [Bluetooth]
    Enable=false

Create a file _/var/lib/connman/wifi.config_ with your WiFi settings, e.g.

    [service_home]
    Type = wifi
    Name = Babilim
    Security = wpa
    Passphrase = PASSPHRASE_GOES_HERE

and reboot the board, or restart _connman_ to get it to update to use the new settings,

    systemctl restart connman.service

After a few seconds, or on reboot after you've logged back into the board, you should see something like this when you type _ifconfig wlan0_,

