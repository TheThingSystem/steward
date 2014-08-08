#!/bin/bash

# this script is based on http://thethingsystem.com/dev/Bootstrapping-the-Raspberry-Pi.html
# you have to "pay attention" because no error checking is performed

echo "Step 1. Update packages."

sudo apt-get update
sudo apt-get upgrade
sudo apt-get install git-core build-essential


echo ""; echo ""; echo "";
echo "Step 2. Fetch/Install node and version manager."

git config --global user.name "Alasdair Allan"
git config --global user.email alasdair@babilim.co.uk

git clone https://github.com/joyent/node.git
(cd node; git checkout v0.10.22 -b v0.10.22; ./configure; make; sudo make install)

if false; then
    git clone git://github.com/creationix/nvm.git ~/.nvm
    echo ". ~/.nvm/nvm.sh" >> ~/.bashrc  
    . ~/.nvm/nvm.sh

    nvm alias default v0.10.22
fi

echo ""; echo ""; echo "";
echo "Step 3. Install/Update libraries for steward."

sudo apt-get install libpcap-dev \
                     libavahi-client-dev \
                     libavahi-core7 \
                     libnss-mdns \
                     avahi-discover \
                     libavahi-compat-libdnssd-dev \
                     libusb-1.0-0-dev \
                     libusbhid-common \
                     libusb-dev \
                     libglib2.0-dev \
                     automake \
                     libudev-dev \
                     libical-dev \
                     libreadline-dev \
                     libdbus-glib-1-dev \
                     libexpat1-dev

wget https://www.kernel.org/pub/linux/bluetooth/bluez-4.101.tar.xz
tar -xvf bluez-4.101.tar.xz
(cd bluez-4.101; ./configure; make; sudo make install)


echo ""; echo ""; echo "";
echo "Step 4. Fetch/Install packages for steward."

git clone https://github.com/TooTallNate/node-gyp.git
(cd node-gyp; sudo npm install -g node-gyp)

git clone https://github.com/TheThingSystem/steward.git
(cd steward/steward; rm -rf node_modules; npm install -l)

sudo cp steward/platforms/raspberry_pi/init.d/steward_4x.sh /etc/init.d/steward
sudo chmod uog+rx /etc/init.d/steward

sudo update-rc.d steward defaults


echo ""; echo ""; echo "";
echo "Step 5. Verify Bluetooth installation"

hciconfig
sudo hciconfig hci0 up
hciconfig

echo "type CTRL-C to stop scan, then run sudo /etc/init.d/steward start"
sudo hcitool lescan
