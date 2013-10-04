#!/bin/bash

if [ ! -f run.sh ]; then
  echo "usage: pull.sh (from the steward/steward directory)" 1>&2
  exit 1
fi

rm -rf node_modules
npm cache clean
rm -rf ~/.npm/_git-remotes

git pull upstream master
npm install -l
