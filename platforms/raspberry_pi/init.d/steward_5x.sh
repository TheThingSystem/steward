#! /bin/sh
### BEGIN INIT INFO
# Provides:          steward
# Required-Start:    $all
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Manages the Things System, Inc., steward daemon
# Description:       Manages the Things System, Inc., steward daemon
### END INIT INFO

# Author: Alasdair Allan <alasdair@babilim.co.uk>
#
# Please remove the "Author" lines above and replace them
# with your own name if you copy and modify this script.

# Do NOT "set -e"

# PATH should only include /usr/* if it runs after the mountnfs.sh script
PATH=/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin

HCI=/usr/local/bin/hciconfig
BLUETOOTH=/usr/local/libexec/bluetooth/bluetoothd
BLUE_PID=/var/run/bluetoothd.pid
BLUE_FILE="/var/log/bluetoothd.log"

STEWARD=/usr/local/bin/node
STEW_PID=/var/run/steward.pid
STEW_ARGS="/home/pi/steward/platforms/raspberry_pi/server.js"
STEW_FILE="/var/log/steward.log"
PID=

BLUETOOTH_ENABLE=true
if [ -r /etc/default/steward ]; then
    . /etc/default/steward
fi

case "$1" in
start)
   if [ "$BLUETOOTH_ENABLE" = "true" ]; then
       echo "Bringing up Bluetooth LE dongle"
       $HCI hci0 up
       echo -n "Start bluetoothd... "
       $BLUETOOTH >> $BLUE_FILE 2>&1 &
       PID=$!
       echo "pid is $PID"
       echo $PID >> $BLUE_PID
    fi
   
   if [ ! -f /home/pi/steward/steward/db/server.key ]; then
	 echo -n "Creating server key..."
     rm -f /home/pi/steward/steward/sandbox/server.crt /home/pi/steward/steward/sandbox/server.sha1

     export NODE_PATH="/home/pi/steward/steward/"
     /usr/local/bin/node <<EOF
require('x509-keygen').x509_keygen({ subject  : '/CN=steward'
                                   , keyfile  : '/home/pi/steward/steward/db/server.key'
                                   , certfile : '/home/pi/steward/steward/sandbox/server.crt'
                                   , destroy  : false }, function(err, data) {
  if (err) return console.log('keypair generation error: ' + err.message);

  console.log('keypair generated.');
});
EOF

    if [ -f /home/pi/steward/steward/db/server.key ]; then 
      chmod 400 /home/pi/steward/steward/db/server.key
      chmod 444 /home/pi/steward/steward/sandbox/server.crt

      openssl x509 -sha1 -in /home/pi/steward/steward/sandbox/server.crt -noout -fingerprint > /home/pi/steward/steward/sandbox/server.sha1
      chmod 444 /home/pi/steward/steward/sandbox/server.sha1
    else
      rm -f /home/pi/steward/steward/db/server.key /home/pi/steward/steward/sandbox/server.crt
      echo "unable to create self-signed server certificate" 1>&2
    fi
  fi

   sleep 5
   echo -n "Start steward services... "
   $STEWARD $STEW_ARGS >> $STEW_FILE 2>&1 &
   PID=$!
   echo "pid is $PID"
   echo $PID >> $STEW_PID
   ;;
stop)
   echo -n "Stop steward services..."
   if [ -e $STEW_PID ]; then
       echo -n "killing "
       echo `cat $STEW_PID`
       kill `cat $STEW_PID`
       rm $STEW_PID
   else
       echo "steward was not running"
   fi
   if [ -e $BLUE_PID ]; then
       echo -n "Stop Bluetooth..."
       echo -n "killing "
       echo `cat $BLUE_PID`
       kill `cat $BLUE_PID`
       rm $BLUE_PID
       echo "Shutting down Bluetooth LE dongle"
       $HCI hci0 down
   fi
   ;;
restart)
   $0 stop
   $0 start
        ;;
*)   echo "Usage: $0 (start|stop)"
        exit 1
        ;;
esac
exit 0
