# The Thing Philosophy
_Q: What do you think of home automation systems?_

_A: It would be a good idea._

_Q: Isn't that rather disingenuous?_

_A: Not at all, the market may talk about Home Automation, but, by and large, the offerings are half-measures at best._

_Q: Please explain._

_A: That's the intent of this file._

Most systems today are built around the notion of a person being one of the participants in a conversation with the system.
For example: tap a button and the lights go on.
Although this involves cycles and bandwidth, it isn't _automation_ -- it's remote control.
There's nothing wrong with remote control, particularly if you happen to be in one timezone and your home is in another;
but, it isn't _automation_ in any meaningful sense.

Another example:
when the leak detector measures water in the drip-pan above the threshold,
it sends you an email/tweet/fax/etc.
That's remote notification.
There's nothing wrong with remote notification, but again, it's not really _automation_.

An example of _automation_ would be that the lights know what the solar time is in the house,
and if the motion detector gets a ping, then the lights go on.
Further, if none of the family members' presence indicators (e.g., watches, fobs, and so on) are visible,
then the PTZ cam in the room starts recording, and the home goes into 'attention mode'.

For most homes,
'attention mode' involves one or more lights throughout the house turning a specific color and brightness,
and the audio player rendering a specific sound clip to the effect of
_"Your attention please: the water heater appears to be leaking"_.
(Of course,
more creative home-owners might have the voice-over intoned by any number of fictional characters.)
Placement of the lights might include the master bedroom, the kitchen, and the home office.
Choices of color and brightness might vary based on when 'attention mode' is entered.
For the presence indicators that are visible to the home,
they would probably get an alert signal as well.

Another example of _automation_ would be that when the leak detector triggers an over-threshold event,
that the home goes into 'attention mode'.
However,
if it's solar night, the nursery is exempt from the alert light and sound,
because it's better not to wake the baby at two in the morning,
particularly if there's a leak that you need to deal with.

Why not just use the 'traditional' Internet?
The first reason is basic common sense:
if someone's home and the home detects something,
then being told about something shouldn't involve having a working Internet connection,
a cloud service,
and so on.
There's nothing wrong with using the off-site Internet infrastructure when no one's home,
but the failure modes are much more evident.
Further, thanks to things like the excellent 'Do Not Disturb' feature on many smart phones,
most people simply will not get that email/tweet/fax until after they wake up in the morning...

And this brings us full-circle:
Home Automation (HA) should revolve around rules in which _things observe events_,
and in response other _things perform tasks_.
Of course,
it's up to the home-owner to define the rules.
In the old days,
a 'steward' was a trusted servant who ran the household on behalf of the home-owner.
The home-owner set the rules and the steward was responsible for seeing that they were faithfully implemented.

## The Steward
_Q: Is this a hardware play, a software play, a services play?_

_A: It's whatever makes sense for you._

The steward is a software system implemented in [node.js](http://en.wikipedia.org/wiki/Node.js),
which is server-side JavaScript that runs on just about everything,
including things like the [Raspberry Pi](http://en.wikipedia.org/wiki/Raspberry_pi) (RPi)
and the [Beagle Bone Black](http://beagleboard.org/Products/BeagleBone%20Black) (BBB).

The steward requires an "always on" computer.
If you have one already,
it's likely you can install the steward software directly.
If not, or if you want a turn-key solution,
there is a "steward distribution" for the RPi and BBB platforms.

As to how much the steward makes use of third-party services, that's really up to you,
as the software comes with a number of plugins for third-party services.

### An Important Digression
There are many positive features of _node.js_ that make it ideal as an implementation language.
The steward's curators hope to attract a large number of contributors adding modules to manage more things in the home.
This brings to mind another criticism of the current market situation:
it currently encourages very poor allocation of resources.

Let's say you've built a really nice thing.
For now, let's call it a _macguffin_.
Your passion is to bring the best possible macguffins to market,
so that people everywhere can revel in the macguffiness of it all.
In today's market however,
it's not enough for you to design, manufacture, and market macguffins.
You also have to write a macguffin management app for each of the different smart platforms
(2 or 4, depending on how you count).
You also need to design, provision, and operate a cloud service to allow remote access to the macguffins in the home.
Even after you go sideways on all that,
the macguffins in the home don't interact with anything else in the home.

In brief, as a maker, the market requires you spend a lot of additional resources outside of your core competency in order to 
field a suboptimal solution.

Further, this doesn't serve the consumer very well at all.
The consumer now has to download a separate app for each device in the home,
some apps are available only on certain smart platforms,
and they still don't talk to each other.

Purveyors of HA hardware try to address this issue by having a single app that controls all of the hardware from
the same manufacturer.
Although this is praiseworthy,
a discerning consumer will inevitably like the LED bulbs from one ecosystem,
the smart plugs from another ecosystem,
and the sensors from a third ecosystem.

Purveyors of HA software try to address this issue by having a single app that controls multiple ecosystems.
And now, if you'll scroll back to the top of this page,
you'll see that the current offerings aren't doing HA in any meaningful sense.
The moral of the story is that when the market fails, it fails hard.

## Simplicity over Complexity
_Q: So you claim to fix all this?_

_A: Our goal is to provide a system that let's all these things work together to provide HA._

The steward is architected to make it very easy for third-parties to add "device-specific" drivers that manage things.
The steward is open source,
and it contains dozens of drivers for real-world products both because the steward's curators have them ourselves,
and to provide real-world guides for other implementors (who are free to contribute their work, or not).
The choice of _node.js_ is instructive in that it is "serious", "accessible" and has considerable momentum.
It is "serious" in that you can build reliable systems with it,
and it is "accessible" in that [JavaScript](http://en.wikipedia.org/wiki/JavaScript) is the currently the dominant
programming language of the Internet. (Sorry if that offends).

The steward's prime directive is to provide a curated framework for HA.
What this means is that it defines an activity model (the rules the steward applies),
along with a series of pragmatic interfaces for third-parties.

Because there is a wide spectrum of resources available on devices,
the steward may talk to a device through a controller (often termed a gateway),
using whatever protocol the controller implements.
On the other end of the spectrum,
some devices are peripherals on smart devices,
so the steward implements a _Simple Thing Protocol_ that is also implemented on the smart device and provides a gateway into
the peripheral.

Although the discussion thus far has focused on third-parties as implementors of "device-specific" drivers,
the other kind of third-parties are implementations of clients.
In addition to the internal APIs in the steward,
there are external APIs for client developers.
The two meet in the the steward's taxonomy,
which is a data model and dictionary.
This is the abstraction that allows a developer to write something that defines a lighting "scene" without really caring what
who manufactured the lights or how they're controlled.

Planning for the future is difficult.
You need to have extensibility,
but making things complex never helps.
Never.
Seriously, it never helps.
And yet, many system designers never seem to "get that".
The steward's curators hope that we not only "got that", but that we "got it right" with the taxonomy.

## Minimal Friction
_Q: So are existing systems obsolete, clueless, or evil?_

_A: Of course not:
one of the goals of the steward is to make it easier to use your existing investment more effectively._

The most frustrating aspect of today's 'solutions' is that they add friction rather than reduce friction.
In other words,
they don't result in a net savings of time.

In the ideal situation,
you plug a device into your home network,
and the steward will automatically discover it and you can then define whatever rules you want.

Speaking candidly:
there is an extraordinarily wide range of HA systems in homes,
and most of them can't really be managed until a person configures them for the home environment.

For example:

* Many Wi-Fi devices boot up with their own network name,
and you have to tell one of your own devices (e.g., a smartphone or tablet) to connect to that network,
and then you run a browser,
go to the device,
give it the information on the home Wi-Fi network,
and it restarts on the home network.
At that point, the steward will automatically discover it.

* Other Wi-Fi devices require that you connect it to your computer via a USB cable,
run an application there to get the current firmware and information on the home Wi-Fi network,
and then it restarts on the home network.
At that point, the steward will automatically discover it.

* Some Wi-Fi devices try to hide themselves refusing to talk to anything other than a cloud service.
(Some even going so far as to disconnect from the Wi-Fi network unless they need to upload data.)
In cases like these,
you have to tell the steward about the cloud service,
and it will log-in,
and periodically download information from the service.

* Wireless devices that aren't using Wi-Fi (e.g.,
[Insteon](http://en.wikipedia.org/wiki/Insteon),
[Z-wave](http://en.wikipedia.org/wiki/Z-Wave),
and
[Zigbee](http://en.wikipedia.org/wiki/Zigbee)
often require that you have a controller,
and that you press a pairing button on the controller and device,
in order for the device to associate itself with the controller.
At that point, the steward will automatically discover it (by polling the controller).

* Independently,
some devices require that you press a pairing button the controller before it will be managed by the steward.

* [Bluetooth low energy](http://en.wikipedia.org/wiki/Bluetooth_low_energy) (BLE) devices are typically easy to discover,
but may require some kind of pairing (either standard or ad-hoc) before they will talk to the steward.

In all of these cases,
the steward's job is to reduce friction to the minimum.
Of course,
the steward works in the environment it's given.
For example,
there is a particularly clueful climate sensor that talks only to the cloud.
Consequently,
even though this device is sitting in your home,
unless the steward goes to the cloud,
it can't get any measurements.
Furthermore,
because the sensor uploads measurements at fixed intervals,
that interval limits the granularity of the steward's behavior.
(The steward's curators hope to persuade implementors to be more sensitive to real-world deployments.)

### Privacy
_Q: So are you going to gather all this data and be evil yourselves?_

_A: Of course not:
the steward philosophy is that it's your home, your network, and your data._

All the information that the steward needs to do its job stays on the steward;
however, you may want to export it somewhere, e.g., a cloud service.
The steward philosophy is to make it as simple as possible to do that.

For example:
the steward supports a wide range of various sensors for climate, motion, presence, and so on.
These measurements are captured to a database on the steward.
However, 
perhaps you want to upload a subset of your sensor data to [Xively](http://en.wikipedia.org/wiki/Cosm_(Internet_of_Things).
Although there's a module that does that,
it's up to you to decide whether to turn it on and which sensors to feed to it.

Similarly,
you may not always be home and you may wish to have remote access to your steward.
The steward defines an API for third-party services to use for this purpose.
The steward also comes with a module that talks to [Nodejitsu](http://en.wikipedia.org/wiki/Nodejitsu) so you can run your own
remote access server in the cloud.

The guiding principle here is that the steward focuses on the home and stays in the home.
If you want to let data out, or take allow access in, you decide the "who" and the "how much".

### Security
_Q: So how long until some basement-dwelling ne'er-do-well breaks into my home's steward and starts playing loud disco music
with a synchronized light show?_

_A: In truth, that's really up to you._

The steward's curators eat the same dog food as everyone else.
Each of us runs the steward on a different kind of platform in order to experience the greatest coverage.

Regardless of whether you run the steward on your unpatched Windows XP desktop or using the steward distribution on the BBB
platform,
security is your responsibility.
Of course,
if you run the steward distribution on dedicated hardware,
you are much less likely to have problems.

All client communications to the steward are encrypted,
but you need to use a real passphrase manager,
such as [1Password](https://agilebits.com/onepassword),
with your clients.

**NOTE THAT ENCRYPTION IS NOT YET ENABLED**

The steward will use whatever "security" is available with the device,
but speaking candidly: given the state of today's device security, that's not saying much.

## A System of Systems
_Q: Please re-cap._

_A: That's the intent of this section._

In a nutshell, the steward:

* is hardware-agnostic and device-agnostic

* comes with a large number of drivers for several devices in common use for HA

* provides internal APIs to third-parties may write their own device-specific drivers

* implements a _Simple Thing Protocol_  to manage  peripherals on smart devices

* comes with a web-based UI

* provides external APIs so third-parties may write their own clients

* let's you decide whether any data goes outside the home, and if so, how much

* let's you decide whether remote access is permitted, and if so, by whom

The steward's curators hope that the market will now auto-correct so that thing-makers can focus on making clueful things,
client-makers can focus on making cool clients,
and consumers can define useful rules for HA in their homes.
