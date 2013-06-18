# Actors
An *actor* refers to a prototype of a entity that participates in an activity.

## Device actors
A device is a physical object.
Information about devices is found [here](Devices.md).

## Group actors
A group is a collection (possibly hierarchical) of physical objects.
Information about groups is found [here](Activities.md).

## Pseudo actors
Pseudo actors are software-only constructs.
At present,
there are two types of pseudo-actors: the clipboard and the place.

### Clipboard

**NOTE THAT THE CLIPBOARD ACTOR IS EXPERIMENTAL (IT MAY BE A SOLUTION IN SEARCH OF A PROBLEM) **

### Place
At present, there is one place actor, 'place/1', which refers to the steward's physical location:

* _name_ - a user-friendly name

* _status_ - _green_, _blue_, _indigo_, or _red_ - for reporting steward health

* _solar_ - _dawn_, _morning-twilight_, _sunrise_, _morning_, _daylight_, _evening_, _sunset_, _evening-twilight_,
_dusk_, _night_, _noon_, and _nadir_

* _physical_ - a string

* _coordinates_ - [latitude, longitude] -or- [latitude, longitude, elevation]

### Events
There are two events that may be monitored:

* 'cron' - the associated parameter is a [cron expression](http://en.wikipedia.org/wiki/Cron#CRON_expression)

* 'solar' - the associated parameter is any of the values above (note that _noon_ and _nadir_ are precise moments in time, whilst the others are time ranges)


### Tasks
The 'set' task may be used to update the _name_, _physical_, and _coordinates_ parameters.
Note that changing the _physical_ parameter will not update the _coordinates_ parameter.


## API calls
Actors are managed by authorized clients using the

    /manage/api/v1/actor/

path prefix, e.g.,

    { path      : '/api/v1/actor/list'
    , requestID : '1'
    , options   : { depth: all }
    }

### List Actor(s)
To list the properties of a single actor,
an authorized client sends:

    { path      : '/api/v1/actor/list/ID'
    , requestID : 'X'
    , options   : { depth: DEPTH }
    }

where _ID_ corresponds to the _actorID_ of the actor to be deleted,
_X_ is any non-empty string,
and _DEPTH_ is either 'flat', 'tree', or 'all'

If the ID is omitted, then all actors are listed, e.g., to find out anything about everything,
an authorized client sends:

    { path      : '/api/v1/actor/list'
    , requestID : '2'
    , options   : { depth: 'all' }
    }

### Perform Actor(s)
To have an actor perform a particular task,
an authorized client sends:

    { path      : '/api/v1/actor/PREFIX'
    , requestID : 'X'
    , perform   : 'TASK'
    , parameter : 'PARAMS'
    }

where _PREFIX_ corresponds to a device taxony,
_X_ is any non-empty string,
_TASK_ identifies the particular task,
and _PARAMS_ provides the parameters, e.g.,

    { path      : '/api/v1/actor/perform/device/lighting'
    , requestID : '3'
    , perform   : 'off'
    , parameter : ''
    }

tells all devices to perform the 'off' task.
