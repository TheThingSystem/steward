#Introduction

The home has evolved from one computer in a back room to a network of computing devices all over the house. Many of these are user-facing devices, such as tablets, laptops, and desktops. However increasingly, the home network has a number of special-purpose devices—things—that turns the home network into a network not just for the user, but for their devices; a network of things.

Most of these things are controlled by a special-purpose application. Every thing has its own app, and its rare that one thing will talk to another. The Internet of Things isn't really connected together, not like the other Internet, the digital one. Right now its a series of (mostly proprietary) islands that don't talk to each other.

The Thing System is a set of software components and network protocols that changes that. Our _steward_ software is written in [node.js](http://nodejs.org) making it both portable and easily extensible. It can run on your laptop, or fit onto a small single board computer like the [Raspberry Pi](01_RaspberryPi.md).

The _steward_ is at the heart of the system and connects to [Things](03_Knapsack.md) in your home, whether those things are media players such as the Roku or the Apple TV, your Nest thermostat, your INSTEON home control system, or your Philips Hue lightbulbs–whether your things are connected together via Wi-Fi, Zigbee, Z-Wave, USB or Bluetooth LE. The steward will find them and bring them together so they can talk to one another and perform [magic](02_Magic.md).

##Installation and Getting Started

The first thing you'll need to do, whether you're a user or a developer is [install](User/00_Installation.md) and [start](User/02_Running.md) the _steward_ software.

If you are a _prosumer_ or a developer, then you may find the [Thing Philosophy](01_Philosophy.md) enlightening.

###For Developers

There are three main tracks for developing for the Thing System

* Developing for the [steward](Developer/00_Steward.md).

* Developing [third-party "things"](Developer/Things/00_Introduction.md) which talk to the steward

* Developing [client software](Developer/Clients/00_Introduction.md), and [magic](Developer/Clients/02_Magic.md).

However, before getting started, you should probably read about the [architecture](02_Architecture.md).