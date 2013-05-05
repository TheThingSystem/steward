# Activities
An *activity* is a binding between an event and a task.

Both the event and task are often groups of actors.
For events, groups are boolean composed (e.g., "if THIS or THAT"),
whilst for tasks, groups are temporally composed (e.g., "UP then DOWN").


**NOTE THAT TEMPORAL EVALUATION IS NOT YET IMPLEMENTED**

In addition,
each task has an optional guard to disable its performance.
For example, an activity might perform a task to turn all lights to full during an alarm condition;
however, the lights in a nursery might have a guard telling them not to perform during solar night.

## Architecture
An activity consists of:

* A fixed _activityID_ that is assigned by the steward during activity creation,
and is used by any subsequent API call referencing that activity.

* A fixed _activityUID_ that is assigned by the client during activity creation,
and is used to ensure atomicity of activity creation.

* An _activityName_ and _activityComment_ that is assigned by the client during activity creation.
Unlike the _activityID_ and _activityUID_, these are meant to be meaningful to people.

* An _eventType_ (either 'event' or 'group') and _eventID_ that is assigned by the client during activity creation.

* A _taskType_ (either 'task' or 'group') and _taskID_ that is assigned by the client during activity creation.

* A _sortOrder_ to provide an optional hint to programs when sorting activities for display.

## Design Patterns
The first **key concept** in the steward is that when a thing observes an event,
then another thing performs an task.
(Of course, the observation and performance may involve multiple things.)

## Taxonomy
### Events
### Tasks
### Groups

## API calls

    /manage/api/v1/

        /group/create/uuid       parentID, name, comments, type, operator, members
        /group/list[/id]         options.depth: { flat, tree, all }
    TBD /group/modify/id
        /group/perform/id        perform, parameter
        /group/delete/id

        /event/create/uuid       name, comments, actor, observe, parameter
        /event/list[/id]         options.depth: { flat, tree, all }
    TBD /event/modify/id
        /event/delete

        /task/create/uuid        name, comments, actor, perform, parameter
        /task/list[/id]          options.depth: { flat, tree, all }
    TBD /task/modify/id
        /task/perform/id
        /task/delete

        /activity/create/uuid    name, comments, armed, event, task
        /activity/list/          options.depth: { flat, tree, all }
    TBD /activity/modify/id
        /activity/perform/id
        /activity/delete/id

## Dictionary
The second **key concept** in the steward is that there is a _global_ (non-namespace) data dictionary describing the properties
of a thing, to encourage simplicity.



### Properties

* true            - string
* 'percentage'    - [0..100]
* 'degrees'       - [0..360)
* 'mireds'        - [154..500] (philips hue, aka 2000-6500K)
* 'meters/second' - [0..N]
* 'latlng'        - [lat, lng]
* 'meters'        - [0..N]
* 'seconds'       - [0..N]
* 'id'            - [1..N]
* 'u8'            - [0..255]
* 's8'            - [-127..128]
* 'fraction'      - [0..1]
* 'timestamp'     - 2013-03-28T15:52:49.680Z
* [ enum, ... ]
* { enum : { properties }, ... }    
* 'prototype-name'
* 'property-list'

### General Properties

* name: true
* status: [ 'connected', 'waiting', 'reset', 'unknown', 'ready', 'error', 'on', 'off', 'paired', 'unpaired', 'idle', 'motion', 'quiet', 'present', 'absent', 'excellent', 'normal', 'warning', 'attention', 'error' ]

### Lighting Properties
* color.models: [ 'cie1931', 'hue', 'rgb', 'temperature' ]
* color.models.cie1931: { x: 'fraction', y: 'fraction' }
* color.models.hue: { hue: 'degrees', saturation: 'percentage' }
* color.models.rgb: { r: 'u8', g: 'u8', b: 'u8' }
* colors.models.temperature: { temperature: 'mireds' }
* brightness: 'percentage'
* transition: 'seconds'
* interval: [ 'once', 'flash', 'solid' ]
* effect: [ 'non', 'colorloop' ]


### Location Properties

* physical: true
* coordinates: 'latlng'
optional third-element: altitude in meters
* solar: [ ... ]

### Grouping Properties
* operators: [ 'and', 'or', 'not' ]
* types: [ 'device', 'event', 'task' ]

### Logging Properties
* appname: true
* directory: true
* prefix: true
* priority: [ ]

### Presence Properties
* level: [ 'none', 'mild', 'high' ]
* rssi: 's8'

### Sensor Properties
* lastSample: 'timestamp'

### Service Properties
* apikey: true

# _placeholder_
    /device/fixed/ptgz/galileo
      require('./steward').actors.device.orientation.galileo =
          { $info: { type       : '/device/orientation/galileo'
                   , observe    : [ ]
                   , perform    : [ 'orient' ]
                   , properties : { name     : true
                                  , axis     : [ 'pan', 'tilt' ]
                                  , position : [ 'current', 'target'            ]
                                  , velocity : [ 'current', 'target', 'maximum' ]
                                  }
                   }
          };
    
        
    /device/fixed/ptz//swivl
      require('./steward').actors.device.orientation.swivl =
          { $info: { type       : '/device/orientation/swivl'
                   , observe    : [ ]
                   , perform    : [ 'orient ]
                   , properties : { name     : true
                                  , heading  : 'degrees'
                                  , velocity : 'meters/second'
                                  }
                   }
          };
    
        
    /device/motive/2d/romo
      require('./steward').actors.device.motion.romo =
          { $info: { type       : '/device/motion/romo
                   , observe    : [ ]
                   , perform    : [ 'move' ]
                   , properties : { name     : true
                                  , axis     : [ 'pan', 'tilt' ]
                                  , position : [ 'current', 'target'            ]
                                  , velocity : [ 'current', 'target', 'maximum' ]
                                  }
                   }
          };
