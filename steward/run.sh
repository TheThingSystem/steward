#!/bin/bash

: sudo sh -c 'chgrp admin /dev/bpf* ; chmod g+r /dev/bpf*; arp -d -a'

if [ ! -f index.js ]; then
  echo "usage: run.sh (from the steward/steward directory)" 1>&2
  exit 1
fi

if [ "$SUDO_USER" = "pi" ]; then 
   HOME=/home/pi; 
   export HOME; 
fi
. $HOME/.nvm/nvm.sh

if [ ! -f db/server.key ]; then
  rm -f sandbox/server.crt sandbox/server.sha1

  node <<EOF
require('x509-keygen').x509_keygen({ subject  : '/CN=steward'
                                   , keyfile  : 'db/server.key'
                                   , certfile : 'sandbox/server.crt'
                                   , destroy  : false }, function(err, data) {
  if (err) return console.log('keypair generation error: ' + err.message);

  console.log('keypair generated.');
});
EOF

  if [ -f db/server.key ]; then 
    chmod 400 db/server.key
    chmod 444 sandbox/server.crt

    openssl x509 -sha1 -in sandbox/server.crt -noout -fingerprint > sandbox/server.sha1
    chmod 444 sandbox/server.sha1
  else
    rm -f db/server.key sandbox/server.crt
    echo "unable to create self-signed server certificate" 1>&2
  fi
fi

ulimit -n 1024
while true; do
  node index.js
  date

  sleep 10
done
