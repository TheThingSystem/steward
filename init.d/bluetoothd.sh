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
NAME=bluetoothd
HCI=/usr/local/bin/hciconfig
DAEMON=/usr/local/libexec/bluetooth/$NAME
DAEMON_ARGS=""
PIDFILE=/var/run/$NAME.pid
SCRIPTNAME=/etc/init.d/$NAME

LOG_FILE="/var/log/bluetoothd.log"

PID=

case "$1" in
start)   echo "Bringing up Bluetooth LE dongle"
   $HCI hci0 up
   echo -n "Start bluetoothd... "
   $DAEMON $DAEMON_ARGS >> $LOG_FILE 2>&1 &
   PID=$!
   echo "pid is $PID"
   echo $PID >> $PIDFILE
   ;;
stop)   echo -n "Stop bluetoothd..."
   echo -n "killing "
   echo `cat $PIDFILE`
   kill `cat $PIDFILE`
   rm $PIDFILE
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