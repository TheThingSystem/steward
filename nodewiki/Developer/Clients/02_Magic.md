#Implementing Magic

If you've read our [philosophy](../../01_Philosophy.md) and [magic](../../02_Magic.md) documents 

##The Magic Architecture

separate stand alone tasks that talks to the steward at the API level, so uses the same APIs as everyone else. It monitors the steward, and presumably gets event alerts from the steward (we were planning on some sort of "registering for an event" thing, weren't we? If not, we probably should) and then acts on them. The beauty of this idea is that;

* If the internal rule engine gets locked up, it doesn't affect core functionality

* If they crash, it doesn't affect core functionality

* It'll force us to eat our own dog-food a build a useable API

* Clean separation between magic and core functionality.

* Since it's clean individual bits of magic can be separate processes than can be spun up and down at will

* They'll be really nice API usage examples for other developers, if we publish the source…

* …but we're not obliged to publish source for them if we don't want to for any reason. (not advocating, just saying)

* Doesn't have to run in the same place as the steward.

So for instance think about light bulbs. You have, say, 40 light Hue bulbs in your house. You have a "magic agent" sitting waiting for a "bulb added" event. It gets it, it knows that there was a recent "bulb removed" event. It figures that this is the replacement bulb and configures it as the previous bulb (talking to the steward via the network API like any other bit of client software). Magic happens.

The above scenario means that we can write as much, or as little, magic as we like. We can add magic at any time without affecting the core system, and the magic can be turned off and on without affecting the core system. It can also spectacularly crash and so long as the steward is still up, then the user doesn't seem a difference in controlling their hardware directly. Interestingly, it can also be anywhere… in the cloud, on a different server, on the user's phone. It doesn't have to run on the same machine as the steward (if can, but it doesn't have to).