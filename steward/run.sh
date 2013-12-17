#!/bin/bash

: sudo sh -c 'chgrp admin /dev/bpf* ; chmod g+r /dev/bpf*; arp -d -a'

if [ ! -f index.js ]; then
  echo "usage: run.sh (from the steward/steward directory)" 1>&2
  exit 1
fi

OS=`uname -s`
REV=`uname -r`
MACH=`uname -m`

GetVersionFromFile()
{
        VERSION=`cat $1 | tr "\n" ' ' | sed s/.*VERSION.*=\ // `
}

if [ "${OS}" = "SunOS" ] ; then
        OS=Solaris
        ARCH=`uname -p`
        OSSTR="Running on ${OS} ${REV}(${ARCH} `uname -v`)"
elif [ "${OS}" = "AIX" ] ; then
        OSSTR="info: running on ${OS} `oslevel` (`oslevel -r`)"
elif [ "${OS}" = "Darwin" ] ; then
		OSSTR="info: running on ${OS} `sw_vers -productName` (`sw_vers -productVersion`) `sw_vers -buildVersion`"
elif [ "${OS}" = "Linux" ] ; then
        KERNEL=`uname -r`
        if [ -f /etc/redhat-release ] ; then
                DIST='RedHat'
                PSUEDONAME=`cat /etc/redhat-release | sed s/.*\(// | sed s/\)//`
                REV=`cat /etc/redhat-release | sed s/.*release\ // | sed s/\ .*//`
        elif [ -f /etc/SuSE-release ] ; then
                DIST=`cat /etc/SuSE-release | tr "\n" ' '| sed s/VERSION.*//`
                REV=`cat /etc/SuSE-release | tr "\n" ' ' | sed s/.*=\ //`
        elif [ -f /etc/mandrake-release ] ; then
                DIST='Mandrake'
                PSUEDONAME=`cat /etc/mandrake-release | sed s/.*\(// | sed s/\)//`
                REV=`cat /etc/mandrake-release | sed s/.*release\ // | sed s/\ .*//`
        elif [ -f /etc/debian_version ] ; then
                DIST="Debian `cat /etc/debian_version`"
                REV=""

        fi
        if [ -f /etc/UnitedLinux-release ] ; then
                DIST="${DIST}[`cat /etc/UnitedLinux-release | tr "\n" ' ' | sed s/VERSION.*//`]"
        fi

        OSSTR="info: running on ${OS} ${DIST} ${REV}(${PSUEDONAME} ${KERNEL} ${MACH})"

fi

if [ "$SUDO_USER" = "pi" ]; then 
   HOME=/home/pi; 
   export HOME; 
fi
if [ "$SUDO_USER" = "debian" ]; then
   HOME=/home/debian;
   export HOME;
fi
if [ ! -f $HOME/.nvm/nvm.sh ]; then
   echo "$$HOME/.nvm/nvm.sh doesn't exist! is $$HOME set correctly?"
fi

. $HOME/.nvm/nvm.sh

echo ${OSSTR}
echo "info: using node `node --version`"

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

  sleep 10
done
