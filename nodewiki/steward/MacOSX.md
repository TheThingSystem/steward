# Bootstrapping on Mac OS
Here's how to get the steward running on Mac OS X 10.8 (Mountain Lion).

First, make sure that _/usr/local/bin_ is before _/usr/bin_ in your $PATH.

Second, make sure you have _Xcode_ installed on your system (the _Command Line Tools_ may not prove sufficient).

Second, get [homebrew](http://mxcl.github.io/homebrew/) on the system:

    $ ruby -e "$(curl -fsSL https://raw.github.com/mxcl/homebrew/go)"
    $ brew doctor

If homebrew suggests anything, e.g.,

    brew install git
    brew upgrade git

    ...and so on...

please do so. Keep doing this until you get

    $ brew doctor
    Your system is ready to brew.

Then, put the [node version manager (nvm)](https://github.com/creationix/nvm) on the system:

    git clone git://github.com/creationix/nvm.git ~/.nvm
    echo ". ~/.nvm/nvm.sh" >> ~/.bashrc  
    . ~/.nvm/nvm.sh

Then install the v0.8.20 release of [_node.js_](http://nodejs.org) on the system:

    nvm install v0.8.20
    nvm alias default v0.8.20

(This isn't the most current version, but all the dependencies work with it...)

Then go to the _steward_ directory and install the libraries:

    cd steward/steward
    npm install -l

## Instructions for starting the steward
The _run.sh_ script does three things:

* The script changes the group/permissions for _/dev/bpf*_ and flushes the arp caches.
The steward runs libpcap in order to examine arp traffic.
On most systems, the Berkeley Packet Filter (bpf) is used by [libpcap](http://www.tcpdump.org)
in order to capture network traffic.
In turn, _libpcap_ reads from devices named _/dev/bpf*_ - so these files need to be readable by the steward.
The _run.sh_ script assumes that the steward is running under group _admin_, so that's what it changes the group to.

* The script reads the _nvm_ initialization script in order to set the environment for _node.js_.

* The script runs the _node_ program on the _index.js_ file and the steward begins.

You will probably want to customize this script for yourself.

When the script starts, it will bring a lot of stuff on the console.
Over time, the verbosity will decrease, but for now, it should give comfort...
