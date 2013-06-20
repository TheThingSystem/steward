# Bootstrapping a Raspberry Pi

Starting from a new board and a blank 4GB (minimum) SD card. You will need a 5V power supply that is capable of supplying at least 750mA. Some USB supplies max out at 500mA and while things will apparently work, it can lead to the unit crashing and behaving oddly. The unit will not function correctly if plugged into a computer's USB socket. It won't supply enough power.

## Installing the OS

Download the [latest version of Raspbian](http://www.raspberrypi.org/downloads). At the time of writing it is "2013-05-25-wheezy-raspbian.img" and unzip the image by double clicking on it.

Insert your SD card into your Macbook. Open up a Terminal window and type *df -h*, remember the device name for your SD Card. In my case it's */dev/disk1*. We'll need to use the raw device, */dev/rdisk1*.

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

###How can I tell if the power supply is inadequate?

Common symptoms of an inadequate power supply are unreliable Ethernet (or keyboard) operation, especially if it's OK at first but not when the GUI is started. SD card errors at start up seems to be another symptom of poor power. If you think you have a problem with your power supply, it is a good idea to check the actual voltage on the Raspberry Pi circuit board. Two test points labelled TP1 and TP2 are provided on the circuit board to facilitate voltage measurements.

Use a multimeter which is set to the range 20 volts DC. You should see a voltage between 4.75 and 5.25 volts. Anything outside this range indicates that you have a problem with your power supply or your power cable, or the input polyfuse F3. Anything inside, but close to the limits, of this range may indicate a problem.

##Connecting to the Pi

When it boots the Pi should bring up a *sshd* server, go to your router and find out the Pi's IP address. If your router is capable you might want to configure it so that the Pi's IP address is fixed in future and that it's got a local name that you can use rather than a raw IP address. 

In any case connect to the Pi with ssh. The username is _"pi"_ and the password is _"raspberry"_. 

_NOTE: The "root" account is disabled by default, access to root-privileges is via sudo only._

_NOTE: YOU SHOULD CHANGE THE DEFAULT PASSWORD THE FIRST TIME YOU LOGIN TO THE PI._

##Expanding the Disk

By default the Wheezy image will create a 2GB root partition, which only leaves around 165MB of free space in the root file system, which isn't enough for us to work in. You can either go ahead and create a separate /home or a data partition, or expand the root partition. I don't see a reason at this point not to just expand the root partition to fill the SD Card. 

When logged into the Pi type the following at the prompt,

    sudo raspi-config

This will open the configuration manager. The first option down is _expand_rootfs_. This will automagically expand the size of the root partition. If you reboot the Pi and log back in, and look at _df_ you'll see that the partition has been resized to fill the card.

###Other configuration

You should use the _raspi-config_ tool to set the local timezone and disable starting the desktop on boot. There isn't much point (right now) booting a graphical user interface to something that we're never going to plug into a monitor.

##Installing Node.js

The default package served by *apt-get* on the current version of Whezzy is Node.js 0.6.19~dfsg1-6. Which is horribly out of date. We're going to have to build from the GitHub repository. 

We'll need Git to check it out from the repository. The easiest way to install that is using _apt-get_, however first of all we'll need to update the list of repositories, before grabbing Git itself,

    sudo apt-get update
    sudo apt-get install git-core build-essential

You'll need to configure your Git identity before checking out the source otherwise things won't go smoothly,

    git config --global user.name "Alasdair Allan"
    git config --global user.email alasdair@babilim.co.uk

Then go ahead and checkout _Node.js_

    git clone https://github.com/joyent/node.git

change directory and switch to v0.10.12 release.

    cd node
    git checkout v0.10.12 -b v0.10.12

Now go ahead and build,

    ./configure
    make

This will take a long time, so go make a coffee or a toasted sandwich.

_Optionally you can now test the executables. You can't use "make test" because the standard timeout is too low, i.e. the Pi is too slow, instead go ahead and run them manually._

    python tools/test.py -t 120 --mode=release simple message

_Some tests may fail because they'll time out, one will fail because IPv6 isn't enabled by default on the Pi. There seems to be at least one "known" bug as well. Some of these may be resolved if we move to a later version of Node._

Now go ahead and install _node_ and _npm_,

    sudo make install

You might want to install _nodewiki_ at this point,

    sudo npm install -g nodewiki

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
    sudo npm install -g node-gyp

this will be needed if we run into problems and need to rebuild any add on modules with code changes.

##Installing Other Dependances

We'll also need some other libraries that aren't installed by default in on the Pi. You should go ahead and install these now,

    sudo apt-get install libpcap-dev
    sudo apt-get install libavahi-client-dev
    sudo apt-get install libavahi-core7
    sudo apt-get install libnss-mdns
    sudo apt-get install avahi-discover
    sudo apt-get install libavahi-compat-libdnssd-dev
    sudo apt-get install libusb-1.0-0-dev
    sudo apt-get install libusbhid-common
    sudo apt-get install libusb-dev
    sudo apt-get install libglib2.0-dev
    sudo apt-get install automake
    sudo apt-get install libudev-dev
    sudo apt-get install libical-dev
    sudo apt-get install libreadline-dev
    sudo apt-get install libdbus-glib-1-dev 
    sudo apt-get install libexpat1-dev
	
_NOTE: As of the latest version of the operating system we no longer have to explicitly install g++ as it comes with the distribution._

##Installing BlueZ

Development of the [noble](https://github.com/sandeepmistry/noble) library on Linux is mainly be done using BlueZ 4.x. However we've mostly tested the steward with BlueZ 5.x. If you want to continue to use/test 5.x you'll need to download the [latest version](https://www.kernel.org/pub/linux/bluetooth/) and unpack it. Then,

    cd bluez-5.x
    ./configure --disable-systemd --enable-library
    make
    sudo make install

This will take a while, although nothing like as long as the node.js installation.

_TO DO: Note that we're disabling systemd integration as the Pi doesn't ship with this by default. This means we'll have to write a configuration script to start the bluetoothd deamon and put it in the /etc/init.d directory with links in the relevant /etc/rc[0-6,S].d directories. For now we'll have to manually start the daemon._

_NOTE: Manual installation of BlueZ leaves a copy of the gatttool in the attrib/ directory. You can run this tool from there, or copy it into /usr/local/bin along with the other BlueZ utilities. It's not clear why it's not installed by default. However the noble library needs to have gatttool in the path at runtime._

###Fixing dbus permissions

There is a possible problem with dbus permissions which cause the bluetoothd daemon to fail to start,

    bluetoothd[18198]: Bluetooth daemon 5.4
    D-Bus setup failed: Connection ":1.12" is not allowed to own the service "org.bluez" due to security policies in the configuration file
    bluetoothd[18198]: Unable to get on D-Bus

If this occurs for you,  the current work around is to edit /etc/dbus-1/system.d/bluetooth.conf and add the following line

        <allow send_type="method_call"></allow>

inside the <policy> ... </policy> block, and restarting dbus,

     sudo /etc/init.d/dbus restart

_NOTE: This has security implications. This fix allows a method call from all console users, even those calls unrelated to Bluetooth. This is a temporary and sub-optimal work-around to this problem. More research needed._

### Alternative BlueZ Installation

The stock BlueZ available on Wheezy is currently BlueZ 4.99. This should be sufficient, so

    sudo apt-get install bluetoothd

_NOTE: If you plug your Bluetooth LE adaptor into your Pi before installing BlueZ 4.x via apt-get it should automatically start Bluetooth services on installation. Otherwise you may have to reboot the Pi before running the steward to start these services._

_NOTE: Current testing is using the [IOGEAR GBU521 Adaptor](http://www.iogear.com/product/GBU521/), however other adaptors have been tested and appear to work._

##Installing the Steward

Check out the steward from its Git repository,

    git clone https://github.com/mrose17/steward.git
    cd steward/steward

Delete the _node_modules_ directory if it exists, as the depending on the last build these may be for OS X, and go ahead and install the libraries,

    rm -rf node_modules
    npm install -l

This will take a while. Go make coffee.

####Manual installation of noble

After building and installing the steward go into the _stewart/node_modules_ subdirectory and delete the _noble_ directory. Then,

    git clone git://github.com/sandeepmistry/noble.git
    cd noble
    npm install -l

to get the latest version which supports Linux and BlueZ 5.x.

### No Bluetooth LE Dongle?

Right now there are still problems with the _noble_ library which will crash the _steward_ on startup with the following error if there is no Bluetooth LE adaptor present,

    /home/pi/steward/node_modules/noble/lib/linux-bindings.js:24
        objectManagerInterface.on('InterfacesAdded', function(object, interfaces) 

For now if you don't have a Bluetooth LE dongle attached to your Pi go ahead and edit _discovery/discovery-ble.js_ to and comment out the require statement for the library,

    noble = require('noble');

the _steward_ should start correctly after these changes without Bluetooth LE support.

##Checking Bluetooth LE status

If you chose to install BlueZ 4.x via apt-get, and so long as your Bluetooth LE USB adaptor was plugged into your Pi when you installed BlueZ, the Pi will be automatically configured to start Bluetooth. Bluetooth should be running, type

   hciconfig

at the prompt and you should see something like this,

    hci0:	Type: BR/EDR  Bus: USB
    	    BD Address: 00:02:72:3F:52:DC  ACL MTU: 1021:8  SCO MTU: 64:1
	    UP RUNNING PSCAN 
	    RX bytes:1289 acl:0 sco:0 events:51 errors:0
	    TX bytes:1194 acl:0 sco:0 commands:51 errors:0

if you don't you don't you have a problem, and may need to bail out to BlueZ 5.x, see the manual instructions above. However before doing this you should attempt to manually start the Bluetooth services as below.

###Manually starting Bluetooth LE

Make sure your Bluetooth 4.0 USB adaptor is plugged into the Pi,  then type

    hciconfig

you should see something like this,

    hci0:	Type: BR/EDR  Bus: USB
    	     BD Address: 00:1A:7D:DA:71:0C  ACL MTU: 310:10  SCO MTU: 64:8
	     DOWN 
	     RX bytes:467 acl:0 sco:0 events:18 errors:0
	     TX bytes:317 acl:0 sco:0 commands:18 errors:0

This shows that the device is in a down state. To bring it up you can issue the following command,

    sudo hciconfig hci0 up

then type

    hciconfig

and you should see something more like this,

    hci0:	Type: BR/EDR  Bus: USB
	    BD Address: 00:1A:7D:DA:71:0C  ACL MTU: 310:10  SCO MTU: 64:8
	    UP RUNNING PSCAN 
	    RX bytes:979 acl:0 sco:0 events:43 errors:0
	    TX bytes:910 acl:0 sco:0 commands:43 errors:0

Just to check things are working correctly type,

    sudo hcitool lescan

and you should see any Bluetooth LE peripherals that are within range, e.g. 

    LE Scan ...
    78:C5:E5:6C:D5:EA (unknown)
    78:C5:E5:6C:D5:EA Hone

Hit ^C to stop the scan. You can now start the _bluetoothd_ daemon by typing,

    sudo /usr/local/libexec/bluetooth/bluetoothd

or if you want to attach the log interface to the current console do this with,

    sudo /usr/local/libexec/bluetooth/bluetoothd -n

## Instructions for starting the Steward

In the _steward_ directory type

    ./run.sh

_NOTE: Unlike most modern Linux distributions /bin/bash and /bin/sh are different things on the Pi. So before starting the steward, you'll need to open up the run.sh script. Edit the #! line at the top to use bash rather than sh_.

###Possible Problems

The steward currently starts up, however there may be problems with Bluetooth LE. If you see the following error,

    warning: [discovery] BLE unable to start scanning diagnostic=Cannot call method 'startScanning' of null

the steward is unable to talk to Bluetooth devices.

###Possible Errors

1) If you get an error saying "function not found" then open the run.sh script 

    ./run.sh: 19: /home/pi/.nvm/nvm.sh: function: not found
    ./run.sh: 25: /home/pi/.nvm/nvm.sh: shopt: not found
    ./run.sh: 27: /home/pi/.nvm/nvm.sh: Syntax error: "}" unexpected

in an editor and make sure you changed the #! line to be #!/bin/bash rather than #!/bin/sh.

2) If you get this error,

    [Error: socket: Operation not permitted]
    hint: $ sudo sh -c "chmod g+r /dev/bpf*; chgrp 1000 /dev/bpf*"

 you need to edit the _run.sh_ script and change the line that starts _node_ to use sudo, i.e.

    sudo node index.js

2) If the steward crashes on startup complaining about a _DNSServiceBrowse_ error related to the Axis Camera,

    /home/pi/steward/steward/node_modules/mdns/lib/browser.js:64
      dns_sd.DNSServiceBrowse(self.serviceRef, flags, ifaceIdx, '' + requested_typ
             ^
    Error: dns service error: unknown
        at new Browser (/home/pi/steward/steward/node_modules/mdns/lib/browser.js:64:10)
        at Object.exports.start (/home/pi/steward/steward/devices/devices-media/media-camera-axis.js:69:11)
        at /home/pi/steward/steward/core/utility.js:108:41
        at Object.oncomplete (fs.js:107:15)

then you need to comment out the driver. In the devices/devices-media/media-camera-axis.js file, insert the following at the top,

     exports.start = function() {};
     return;

and the steward should start normally.

3) If you get an error  saying "Invalid ELF header" it's likely that you have accidentally installed OS X binaries from the Mac installation on to the Pi. Go into the _steward_ directory and

    rm -rf node_modules
    npm install -l

which will rebuild the binaries. You'll have to move the git checkout of the _noble_ library out of the way before you do so because otherwise the _npm_ install will fail.

4) If you don't see the message,

    notice: [server] listening on wss://0.0.0.0:8888

scroll by when the _steward_ startups up and instead see and error talking about permissions problems you need to edit the _run.sh_ script and change the line that starts _node_ to use sudo, i.e.

    sudo node index.js

###What does the run.sh script do?

The _run.sh_ script does three things:

* The script changes the group/permissions for _/dev/bpf*_ and flushes the arp caches. The steward runs libpcap in order to examine arp traffic. On most systems, the Berkeley Packet Filter (bpf) is used by [libpcap](http://www.tcpdump.org) in order to capture network traffic. In turn, _libpcap_ reads from devices named _/dev/bpf*_ - so these files need to be readable by the steward. The _run.sh_ script assumes that the steward is running under group _admin_, so that's what it changes the group to.

* The script reads the _nvm_ initialization script in order to set the environment for _node.js_.

* The script runs the _node_ program on the _index.js_ file and the steward begins.

You will probably want to customize this script for yourself. When the script starts, it will bring a lot of stuff on the console. Over time, the verbosity will decrease, but for now, it should give comfort...

#Appendix - Starting at boot time

If you installed BlueZ 5.x, copy the script _steward_5x.sh_ from the _steward/init.d/_ directory into _/etc/init.d_, 

    sudo cp steward_5x.sh /etc/init.d/steward
    chmod uog+rx /etc/init.d/steward

this script starts both the _bluetoothd_ daemon and the _steward_ on boot.

If you installed BlueZ 4.x via _apt-get_, instead copy the _steward_4x.sh_ from the _steward/init.d/_ directory into _/etc/init.d_, 

    sudo cp steward_4x.sh /etc/init.d/steward
    chmod uog+rx /etc/init.d/steward

this script only starts the steward, as the the package managed BlueZ 4.x takes care of its own startup.

 You then need establish symbolic links to this script in the relevant _etc/rcX.d/_ directories,

    cd /etc/rc0.d/
    sudo ln -s ../init.d/steward K02steward
    cd /etc/rc6.d/
    sudo ln -s ../init.d/steward K02steward

    cd /etc/rc2.d
    sudo ln -s ../init.d/steward S98steward
    cd /etc/rc3.d
    sudo ln -s ../init.d/steward S98steward
    cd /etc/rc5.d
    sudo ln -s ../init.d/steward S98steward

#Appendix - Cloning a Bootable SD Card

There are times when you'll want to clone your Raspberry Pi SD Card. The easiest way to do this is shutdown the Pi, take the card out and insert it into your Macbook.

IOpen up a Terminal window and type *df -h*, remember the device name for your SD Card. In my case it's */dev/disk1*. We'll need to use the raw device, */dev/rdisk1*.

    Filesystem      Size   Used  Avail Capacity  iused    ifree %iused  Mounted on
    /dev/disk0s2   699Gi  367Gi  332Gi    53% 96214802 86992771   53%   /
    devfs          206Ki  206Ki    0Bi   100%      714        0  100%   /dev
    map -hosts       0Bi    0Bi    0Bi   100%        0        0  100%   /net
    map auto_home    0Bi    0Bi    0Bi   100%        0        0  100%   /home
    /dev/disk1s2    59Gi   33Gi   26Gi    57%  8739054  6768902   56%   /Volumes/SD Card

Unmount the card,

    sudo diskutil unmount /dev/disk1s2

rather than ejecting it by dragging it to the trash. Then in the Terminal change directory to your Desktop folder and type

    sudo dd bs=1m if=/dev/rdisk1 of=sdcard.img

if the above command report an error _"dd: bs: illegal numeric value"_, change *bs=1m* to *bs=1M*. 

A disk image will be created on your Desktop. You can use this image as you would a normal install image for the Pi.

_NOTE: The size of the image will be dependent on the size of the SD Card you are using on the Raspberry Pi._

#Appendix - Useful Tools

If you're debugging Bluetooth LE connections and working with _hciconfig_ and _hcitool_ in the console, you might want to install DFeet. It's a DBus debugger.

    sudo apt-get install d-feet

If you want to poke around inside the _steward_'s _database.db_ file then you'll need the SQLite tools,

    sudo apt-get install sqlite3
    sudo ln -s /usr/bin/sqlite3 /usr/bin/sqlite