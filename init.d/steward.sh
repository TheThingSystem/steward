#! /bin/sh
### BEGIN INIT INFO
# Provides:          skeleton
# Required-Start:    $remote_fs $syslog
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Example initscript
# Description:       This file should be used to construct scripts to be
#                    placed in /etc/init.d.
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
STEW_ARGS="/home/pi/steward/steward/server.js"
STEW_FILE="/var/log/steward.log"

PID=

case "$1" in
start) echo "Bringing up Bluetooth LE dongle"
   $HCI hci0 up
   echo -n "Start bluetoothd... "
   $BLUETOOTH >> $BLUE_FILE 2>&1 &
   PID=$!
   echo "pid is $PID"
   echo $PID >> $BLUE_PID

   echo -n "Start steward services... "
   $STEWARD $STEW_ARGS >> $STEW_FILE 2>&1 &
   PID=$!
   echo "pid is $PID"
   echo $PID >> $STEW_PID
   ;;
stop)   echo -n "Stop steward services..."
   echo -n "killing "
   echo -n `cat $STEW_PID`
   kill `cat $STEW_PID`
   rm $STEW_PID
   echo -n " "
   echo `cat $BLUE_PID`
   kill `cat $BLUE_PID`
   rm $BLUE_PID
   echo "Shutting down Bluetooth LE dongle"
   $HCI hci0 down
   ;;
restart)
   $0 stop
   $0 start
        ;;
*)   echo "Usage: $0 start"
        exit 1
        ;;
esac
exit 0
