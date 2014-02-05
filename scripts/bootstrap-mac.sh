#!/bin/bash

if [ ! -x scripts/bootstrap-mac.sh ]; then
  echo "must run in top-level directory, e.g., 'steward' or 'steward-master'" 1>&2
  exit 1
fi


echo "Step 1. Install/Update homebrew and libraries."

if [ ! -d /Applications/Xcode.app ]; then
  echo "Xcode must be fully installed, not just the command-line tools" 1>&2
  exit 1
fi

if [ ! -d /usr/local/Cellar ]; then
  echo "Please press RETURN if asked to continue"
  echo "If asked to install command line tools, please click 'Not Now' and then RETURN here"

  ruby -e "$(curl -fsSL https://raw.github.com/Homebrew/homebrew/go/install)"

  brew install git
else
  brew update
fi

brew install libusb-compat

brew doctor


echo ""; echo ""; echo "";
echo "Step 2. Install/Update node and version manager."

if [ -d ~/.nvm ]; then
  (cd ~/.nvm; git pull)
else
  git clone git://github.com/creationix/nvm.git ~/.nvm

  echo ". ~/.nvm/nvm.sh" >> ~/.bashrc
fi
. ~/.nvm/nvm.sh

nvm install       v0.10.22
nvm alias default v0.10.22


echo ""; echo ""; echo "";
echo "Step 3. Install/Update packages for steward."

cd steward

rm -rf node_modules

npm install -l
