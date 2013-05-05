#!/bin/sh

. ~/.nvm/nvm.sh

node node_modules/rfxcom/test.js
exit
node node_modules/nfc/test.js
node node_modules/koubachi/test.js
node node_modules/noble/dump.js
node node_modules/node-netatmo/test.js
