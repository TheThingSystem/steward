#!/bin/bash

if [ ! -f db/2f402f80-da50-11e1-9b23-*.js ]; then
  echo "file $A does not exist" 2>&1
  exit 1
fi

for A in db/server2.key sandbox/server2.crt sandbox/server2.sha1; do
  if [ ! -f "$A" ]; then
    echo "file $A does not exist" 2>&1
    echo "you must start your steward and wait for it to create $A"
    exit 1
  fi
done

rm -f                db/server.key
cp    db/server2.key db/server.key

rm -f                     sandbox/server.crt
cp    sandbox/server2.crt sandbox/server.crt

rm -f                      sandbox/server.sha1
cp    sandbox/server2.sha1 sandbox/server.sha1

echo "you may restart your steward"
