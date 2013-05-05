#!/bin/sh

: sudo sh -c 'chgrp admin /dev/bpf* ; chmod g+r /dev/bpf*; arp -d -a'

. ~/.nvm/nvm.sh

node index.js
