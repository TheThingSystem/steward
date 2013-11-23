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

STEWARD=/usr/local/bin/node
STEW_PID=/var/run/steward.pid
STEW_ARGS="/home/debian/steward/platforms/beaglebone/server.js"
STEW_FILE="/var/log/steward.log"
PID=

case "$1" in
start) if [ ! -f /home/debian/steward/steward/db/server.key ]; then
	 echo -n "Creating server key..."
     rm -f /home/debian/steward/steward/sandbox/server.crt /home/debian/steward/steward/sandbox/server.sha1

     export NODE_PATH="/home/debian/steward/steward/node_modules"
     /usr/local/bin/node <<EOF
require('x509-keygen').x509_keygen({ subject  : '/CN=steward'
                                   , keyfile  : '/home/debian/steward/steward/db/server.key'
                                   , certfile : '/home/debian/steward/steward/sandbox/server.crt'
                                   , destroy  : false }, function(err, data) {
  if (err) return console.log('keypair generation error: ' + err.message);

  console.log('keypair generated.');
});
EOF

    if [ -f /home/debian/steward/steward/db/server.key ]; then 
      chmod 400 /home/debian/steward/steward/db/server.key
      chmod 444 /home/debian/steward/steward/sandbox/server.crt

      openssl x509 -sha1 -in /home/debian/steward/steward/sandbox/server.crt -noout -fingerprint > /home/debian/steward/steward/sandbox/server.sha1
      chmod 444 /home/debian/steward/steward/sandbox/server.sha1
    else
      rm -f /home/debian/steward/steward/db/server.key /home/debian/steward/steward/sandbox/server.crt
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
stop)   echo -n "Stop steward services..."
   echo -n "killing "
   echo `cat $STEW_PID`
   kill `cat $STEW_PID`
   rm $STEW_PID
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
