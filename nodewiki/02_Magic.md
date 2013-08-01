#Magic

If you've read our [philosophy](01_Philosophy.md) document you'll know that what we're about is reducing friction for the user. Things should work like magic. The more buttons, switches, dials and other interface elements that stand between the user and their thing doing what they expect it to do, when they expect it to, makes the thing harder to use-it increases the friction between the user and their thing.

There is very little point automating your home if you end up with a home that's harder to use afterwards than it was before. If your lights are harder to use, or you have to think about what state they're in before flipping a wall switch you've not made your life simpler, you've made it just a little bit harder.

You don't want to have to think about that, you want it all to work like magic. That's our goal

##How to think about magic

The difference between magic, and simple clients is that in general magic doesn't have a user facing interface. Magic is essentially a (number of) expert systems which have solutions to problems, e.g. the CO2 measureed by the netatmo is too high in this room, ask the Nest thermostat to turn on the fan.

The magic monitors the steward and the user looking for patterns

The magic  monitor the steward and keep track of conditions. If they see something occurring regularly that shouldn’t happen, say the the level of CO2 rises consistently overnight in the bedroom. It knows how to solve this problem.  

It then implements a solution, in this case turn on the fan on the Nest, at an appropriate time every day to alleviate the condition without the user having to explicitly instruct the steward to do it. 

The steward is being pro-actively doing things for the user that they’d otherwise have to do themselves. 

Another example would be that a magic client could be built to learn the pattern of lights going on and off in the house. If the user is “away from home” and the Sun sets then the agent would instruct the steward on how to automatically replicate the user’s normal pattern of behavior to deter burglars.

##Developing magic

[developing magic](Developer/Clients/Magic.md)