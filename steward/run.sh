#!/bin/sh

: sudo sh -c 'chgrp admin /dev/bpf* ; chmod g+r /dev/bpf*; arp -d -a'

if [ ! -f index.js ]; then
  echo "usage: run.sh (from the steward/steward directory)" 1>&2
  exit 1
fi

if [ ! -f db/startup.key ]; then
  rm -f sandbox/startup.crt

  T=/tmp/startup.config$$
echo '[ req ]
prompt             = no
distinguished_name = req_distinguished_name

[ req_distinguished_name ]
CN                 = steward' > $T


  if openssl req -x509 -newkey rsa:2048 -keyout db/startup.key -out sandbox/startup.crt -days 720 -nodes \
              -config $T; then
    :
  else
    rm -f db/startup.key sandbox/startup.crt
    echo "unable to create self-signed startup certificate" 1>&2
  fi
  rm -f $T
fi

. ~/.nvm/nvm.sh

node index.js
