#!/bin/sh

cd ../nodewiki || exit 1

path_to_executable=$(which nodewiki)
if [ -x "$path_to_executable" ] ; then
    nodewiki --local --port 8008
else
    nodewiki.js --local --port 8008
fi

