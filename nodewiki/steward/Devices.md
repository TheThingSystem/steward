# Devices

An *actor* refers to a prototype of a entity that participates in an activity. Typically, these refer to devices; however, there are two other types of actors: _groups_ which combine actors accordingly to a logical relationship (e.g., 'and' or 'first/next') and _pseudo actors_ which are software-only constructs (e.g., the *clipboard*).

## Architecture

## Design Patterns
There are three design patterns currently in use for device actors.

#### Standalone Actor
#### Controller Actor and Subordinate Actors
#### Singleton Actor

## Choosing a technology to integrate

If you are a developer, you may find this section interesting.

There are a large number of technologies available for integration.
The steward's architecture is agnostic with respect to the choice of communication and application protocols.
However,
many of these technologies compete (in the loose sense of the word).
Here is the algorithm that the steward's developers use to determine whether something should go into the development queue.

* Unless the device is going to solve a pressing problem for you, it really ought to be in _mainstream use_.
One of the reasons that the open source/node.js ecosystem was selected is because it presently is the most accessible for
developers.
Similarly,
it's desirable to integrate things that are going to reduce the pain for lots of people.

* The _mainstream use_ test consists of going to your national _amazon_ site and seeing what, if anything, is for sale.
Usually, the search page will reveal several bits of useful information.

 * Sponsored Links: often these are links to distributors, but sometimes there links to knowledge aggregators.
The first kind link is useful for getting a better sense as to the range of products available,
but the second kind link is usually more useful because it will direct you to places where you can find out more about the
integration possibilities, e.g., community sites, developer forums, and so on.

 * Products for sale: 

 * Frequently Bought Together:

 * Customers Who Bouth This Item Also Bought:

* One of the things that is quite perplexing is the lack of technical information on technical products.
Although many developer forums have information,
"code rules".
So the obvious stop is [github](https://github.com) - search for the technology there.
Look at each project:

 * Many projects often include pointers to community, forum, and documentation sources.

 * Some projects contain a documentation directory;
if not, you can usually get a sense of things by looking at the "main" source file.

 * If you are fortunate,
a large part of the integration may already be done in node.js.
If so, check the licensing to see if it is "MIT".
If not, study it carefully to see whether it will work for you.

 * After reviewing the project, go up one level and look at the author's other projects.
Often there are related projects that weren't returned by the first search.

Finally, you may have a choice of devices to integrate with, and you may even have the opportunity to build your own.
If you go the "off-the-shelf" route,
please consider what is going to be easiest for others to connect to:

* If there is an ethernet-connected gateway to a device, then it is best to integrate to that gateway:
others will be able to buy use the gateway fairly easily, because attaching devices to an ethernet is fairly simple.

* Otherwise, if there is a USB stick that talks to a device, then use that:
although USB sticks should be less expensive than devices with ethernet-connectivity,
they also tend to require more expertise to configure.

* Finally, if there is a serial connector that talks to a device, you can always use that. Good luck!

## Access Methods


## API calls

    /manage/api/v1/
    
        /device/create/uuid      name, comments, whatami, info
        /device/list[/id]        options.depth: { flat, tree, all }
        /device/perform/id       perform, parameter
    TBD /device/delete/id
