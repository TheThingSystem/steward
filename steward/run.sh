#!/bin/sh

: sudo sh -c 'chgrp admin /dev/bpf* ; chmod g+r /dev/bpf*; arp -d -a'

if [ ! -f index.js ]; then
  echo "usage: run.sh (from the steward/steward directory)" 1>&2
  exit 1
fi

if [ ! -f db/server.key ]; then
  rm -f sandbox/server.crt

  T=/tmp/server.config$$
echo '[ req ]
prompt             = no
distinguished_name = req_distinguished_name

[ req_distinguished_name ]
CN                 = steward' > $T

  if openssl req -x509 -newkey rsa:2048 -keyout db/server.key -out sandbox/server.crt -days 3650 -nodes -config $T; then
    chmod 400 db/server.key
    chmod 444 sandbox/server.crt

    openssl x509 -sha1 -in sandbox/server.crt -noout -fingerprint > sandbox/server.sha1
    chmod 444 sandbox/server.sha1
  else
    rm -f db/server.key sandbox/server.crt
    echo "unable to create self-signed server certificate" 1>&2
  fi

  rm -f $T
fi

. ~/.nvm/nvm.sh

node index.js
