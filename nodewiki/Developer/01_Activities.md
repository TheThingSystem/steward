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
An _activity_ consists of:

* A fixed _activityID_ that is assigned by the steward during activity creation,
and is used by any subsequent API call referencing that activity.

* A fixed _activityUID_ that is assigned by the client during activity creation,
and is used to ensure atomicity of activity creation.

* An _activityName_ and _activityComments_ that is assigned by the client during activity creation.
Unlike the _activityID_ and _activityUID_, these are meant to be meaningful to people.

* An _eventType_ (either 'event' or 'group') and _eventID_ that is assigned by the client during activity creation.

* A _taskType_ (either 'task' or 'group') and _taskID_ that is assigned by the client during activity creation.

* A _sortOrder_ to provide an optional hint to programs when sorting activities for display.

### An Example

Let's say we want to turn on a lightbulb at solar sunrise.
Logically, this is an activity:

* binding an event:

    * actor: place/1

    * observes: solar

    * parameter: sunrise

* to a task: where

    * actor: device/1

    * performs: on

    * parameter: { color: { model: rgb, rgb: { r: 255, g: 255, b: 255 } }, brightness: 100 }

Things like 'place/1' and 'device/1' are called _actors_ -- their job is to observe events or perform tasks.
The possible events that can be observed, or tasks that can be performed, depend on the type of actor.
The _Device Taxonomy_ defines these possibilities along with how the parameters are interpreted.

In this case,
hopefully, the light is not close to someone sleeping, as they may not appreciate a light going white at full brightness!

Of course,
real-world activities tend to be more complex in the sense that we might want multiple lights to go on at once.
So, the steward supports _groups_ (discussed later on).

## Taxonomy
A **key concept** in the steward is that when a thing observes an event,
then another thing performs an task.
Events and tasks either refer to a single actor (e.g., a particular device),
or may refer to a group of actors combined by either boolean (event) or temporal (task) logic.

### Events
An _event_ consists of:

* A fixed _eventID_ that is assigned by the steward during event creation,
and is used by any subsequent API call referencing that event.

* A fixed _eventUID_ that is assigned by the client during event creation,
and is used to ensure atomicity of event creation.

* An _eventName_ and _eventComments_ that is assigned by the client during event creation,
Unlike the _eventID_ and _eventUID_, these are meant t be meaningful to people.

* An _actorType_ (either 'device', 'place', or 'group') and _actorID_ that is assigned by the client during event creation.

* An _observe_ verb and _parameter_ value specific to the actor that is assigned by the client during event creation.

* A _sortOrder_ to provide an optional hint to programs when sorting events for display.

If the _observe_ verb is the value '.condition',
then the associated actor may NOT refer to a group,
and the _parameter_ value is an expression that is evaluated against the _info_ property of the actor
(termed the actor's state information).
For example, 

    { operator : "any-of"
    , operand1 : ".solar"
    , operand2": ["morning", "daylight", "evening"]
    }

says to look at the actor's 'info.solar' property, and if the value is equal to any of the strings in the list,
then this evaluates to true.

The parameter consists of three parts:

* _operator_: one of "equals", "not-equals", "less-than", "less-than-or-equals", "greater-than", "greater-than-or-equals",
"any-of", "none-of", "present", "not" "and", "or"

* _operand1_: either a number, a string beginning with "." (referring to a state variable), or a literal string.

* _operand2_: as _operand1_, but optional, depending on the operator

Typically conditional events are long-lived and are grouped with some other event that is observed to trigger an activity.
For example,
the condition above refers to daylight hours.
It is likely that this is used with something an observed event (e.g., a motion sensor detecting motion) to perform a particular
task.
Alternatively,
this might be used as a task _guard_ so to limit the performance of a particular task to daylight hours.

### Tasks
An _task_ consists of:

* A fixed _taskID_ that is assigned by the steward during task creation,
and is used by any subsequent API call referencing that task.

* A fixed _taskUID_ that is assigned by the client during task creation,
and is used to ensure atomicity of task creation.

* An _taskName_ and _taskComments_ that is assigned by the client during task creation,
Unlike the _taskID_ and _taskUID_, these are meant t be meaningful to people.

* An _actorType_ (either 'device', 'place', or 'group') and _actorID_ that is assigned by the client during task creation.

* A _perform_ verb and _parameter_ value specific to the actor that is assigned by the client during task creation.

* A _guard_, if present, identifies a conditional event that must be true in order for the task to be performed.

* A _sortOrder_ to provide an optional hint to programs when sorting tasks for display.

### Groups
An _group_ consists of:

* A fixed _groupID_ that is assigned by the steward during group creation,
and is used by any subsequent API call referencing that group.

* A fixed _groupUID_ that is assigned by the client during group creation,
and is used to ensure atomicity of group creation.

* A fixed _parentID_ that refers to the superior entry for the group.

* An _groupName_ and _groupComments_ that is assigned by the client during group creation,
Unlike the _groupID_ and _groupUID_, these are meant t be meaningful to people.

* An _groupType_ (either 'device', 'event', or 'task') and _actorID_ that is assigned by the client during group creation.

* A _groupOperator_ used by a superior to relate its immediate children:
_and_ (0), _or_ (1), or _not_ (2).

* A _sortOrder_ to provide an optional hint to programs when sorting groups for display.


## API calls

### Events
Events are managed by authorized clients using the

    /manage/api/v1/event/

path prefix, e.g.,

    { path      : '/api/v1/event/list'
    , requestID : '1'
    , options   : { depth: all }
    }

#### Create Event
To create a event,
an authorized client sends:

    { path      : '/api/v1/event/create/UUID'
    , requestID : 'X'
    , name      : 'NAME'
    , actor     : 'TYPE/ID'
    , observe   : 'EVENT'
    , parameter : 'PARAMS'
    , comments  : 'COMMENTS'
    }

where _UUID_ corresponds to an unpredictable string generated by the client,
_X_ is any non-empty string,
_NAME_ is a user-friendly name for this instance,
_TYPE/ID_ identifies the actor that observes the event,
_TASK_ identifies the particular event,
_PARAMS_ provides the parameters,
and _COMMENTS_ (if present) are textual, e.g.,

    { path      : '/api/v1/event/create/0123456789abcdef'
    , requestID : '1'
    , name      : 'hello sunrise'
    , actor     : 'place/1'
    , observe   : 'solar'
    , parameter : 'sunrise'
    }

#### List Event(s)
To list the properties of a single event,
an authorized client sends:

    { path      : '/api/v1/event/list/ID'
    , requestID : 'X'
    , options   : { depth: DEPTH }
    }

where _ID_ corresponds to the _eventID_ of the event to be deleted,
_X_ is any non-empty string,
and _DEPTH_ is either 'flat', 'tree', or 'all'

If the ID is omitted, then all events are listed, e.g., to find out anything about everything,
an authorized client sends:

    { path      : '/api/v1/event/list'
    , requestID : '2'
    , options   : { depth: 'all' }
    }

#### Delete Event
To define a event,
an authorized client sends:

    { path      : '/api/v1/event/delete/ID'
    , requestID : 'X'
    }

where _ID_ corresponds to the _eventID_ of the event to be deleted, and _X_ is any non-empty string, e.g.,

    { path      : '/api/v1/event/delete/6'
    , requestID : '3'
    }


### Tasks
Tasks are managed by authorized clients using the

    /manage/api/v1/task/

path prefix, e.g.,

    { path      : '/api/v1/task/list'
    , requestID : '1'
    , options   : { depth: all }
    }

#### Create Task
To create a task,
an authorized client sends:

    { path      : '/api/v1/task/create/UUID'
    , requestID : 'X'
    , name      : 'NAME'
    , actor     : 'TYPE/ID'
    , perform   : 'TASK'
    , parameter : 'PARAMS'
    , guard     : 'event/ID'
    , comments  : 'COMMENTS'
    }

where _UUID_ corresponds to an unpredictable string generated by the client,
_X_ is any non-empty string,
_NAME_ is a user-friendly name for this instance,
_TYPE/ID_ identifies the actor that performs the task,
_TASK_ identifies the particular task,
_PARAMS_ provides the parameters,
_event/ID_ (if present) the guard event associated with this task,
and _COMMENTS_ (if present) are textual, e.g.,

    { path      : '/api/v1/task/create/0123456789abcdef'
    , requestID : '1'
    , name      : 'wakeup light'
    , actor     : 'device/1'
    , perform   : 'on'
    , parameter : '{"color":{"model":"rgb","rgb":{"r":255,"g":255,"b": 255}},"brightness":100 }'
    }

#### List Task(s)
To list the properties of a single task,
an authorized client sends:

    { path      : '/api/v1/task/list/ID'
    , requestID : 'X'
    , options   : { depth: DEPTH }
    }

where _ID_ corresponds to the _taskID_ of the task to be deleted,
_X_ is any non-empty string,
and _DEPTH_ is either 'flat', 'tree', or 'all'

If the ID is omitted, then all tasks are listed, e.g., to find out anything about everything,
an authorized client sends:

    { path      : '/api/v1/task/list'
    , requestID : '2'
    , options   : { depth: 'all' }
    }

#### Perform Task
To perform a task,
an authorized client sends:

    { path      : '/api/v1/task/perform/ID'
    , requestID : 'X'
    }

where _ID_ corresponds to the _taskID_ of the task to be performed,
_X_ is any non-empty string, e.g.,

    { path      : '/api/v1/task/perform/7'
    , requestID : '3'
    }

#### Delete Task
To define a task,
an authorized client sends:

    { path      : '/api/v1/task/delete/ID'
    , requestID : 'X'
    }

where _ID_ corresponds to the _taskID_ of the task to be deleted, and _X_ is any non-empty string, e.g.,

    { path      : '/api/v1/task/delete/7'
    , requestID : '4'
    }


### Activities
Activities are managed by authorized clients using the

    /manage/api/v1/activity/

path prefix, e.g.,

    { path      : '/api/v1/activity/list'
    , requestID : '1'
    , options   : { depth: all }
    }

#### Create Activity
To create a activity,
an authorized client sends:

    { path      : '/api/v1/activity/create/UUID'
    , requestID : 'X'
    , name      : 'NAME'
    , armed     : BOOLEAN
    , event     : 'EVENT/ID'
    , task      : 'TASK/ID'
    , comments  : 'COMMENTS'
    }

where _UUID_ corresponds to an unpredictable string generated by the client,
_X_ is any non-empty string,
_NAME_ is a user-friendly name for this instance,
_ARMED_ indicates whether this activity should be evaluated,
_EVENT/ID_ identifies the event,
_TASK/ID_ identifies the task,
and _COMMENTS_ (if present) are textual, e.g.,

    { path      : '/api/v1/activity/create/0123456789abcdef'
    , requestID : '1'
    , armed     : true
    , event     : 'event/6'
    , task      : 'task/7'
    }

#### List Activity(s)
To list the properties of a single activity,
an authorized client sends:

    { path      : '/api/v1/activity/list/ID'
    , requestID : 'X'
    , options   : { depth: DEPTH }
    }

where _ID_ corresponds to the _activityID_ of the activity to be deleted,
_X_ is any non-empty string,
and _DEPTH_ is either 'flat', 'tree', or 'all'

If the ID is omitted, then all activities are listed, e.g., to find out anything about everything,
an authorized client sends:

    { path      : '/api/v1/activity/list'
    , requestID : '2'
    , options   : { depth: 'all' }
    }

#### Perform Activity
To perform a activity,
an authorized client sends:

    { path      : '/api/v1/activity/perform/ID'
    , requestID : 'X'
    }

where _ID_ corresponds to the _activityID_ of the activity to be performed,
_X_ is any non-empty string, e.g.,

    { path      : '/api/v1/activity/perform/8'
    , requestID : '3'
    }

#### Delete Activity
To define a activity,
an authorized client sends:

    { path      : '/api/v1/activity/delete/ID'
    , requestID : 'X'
    }

where _ID_ corresponds to the _activityID_ of the activity to be deleted, and _X_ is any non-empty string, e.g.,

    { path      : '/api/v1/activity/delete/8'
    , requestID : '4'
    }


### Groups
Groups are managed by authorized clients using the

    /manage/api/v1/group/

path prefix, e.g.,

    { path      : '/api/v1/group/list'
    , requestID : '1'
    , options   : { depth: all }
    }

#### Create Group
To create a group,
an authorized client sends:

    { path      : '/api/v1/group/create/UUID'
    , requestID : 'X'
    , parentID  : 'Y'
    , name      : 'NAME'
    , type      : 'device' (default) | 'event' | 'task'
    , operator  : 'and' (default) | 'or' | 'not'
    , members   : [ 'TYPE/ID, ... ]
    , comments  : 'COMMENTS'
    }

where _UUID_ corresponds to an unpredictable string generated by the client,
_X_ is any non-empty string,
_Y_ (if present) refers to an existing group to be the superior,
_NAME_ is a user-friendly name for this instance,
each _TASK/ID_ identifies the actors associated with this group,
and _COMMENTS_ (if present) are textual, e.g.,

    { path      : '/api/v1/group/create/0123456789abcdef'
    , requestID : '1'
    , members   : [ 'device/1', 'device/2' ]
    }

#### List Group(s)
To list the properties of a single group,
an authorized client sends:

    { path      : '/api/v1/group/list/ID'
    , requestID : 'X'
    , options   : { depth: DEPTH }
    }

where _ID_ corresponds to the _groupID_ of the group to be deleted,
_X_ is any non-empty string,
and _DEPTH_ is either 'flat', 'tree', or 'all'

If the ID is omitted, then all groups are listed, e.g., to find out anything about everything,
an authorized client sends:

    { path      : '/api/v1/group/list'
    , requestID : '2'
    , options   : { depth: 'all' }
    }

#### Perform Group
To perform the tasks associated with a group,
an authorized client sends:

    { path      : '/api/v1/group/perform/ID'
    , requestID : 'X'
    }

where _ID_ corresponds to the _groupID_ of the group having tasks to be performed,
_X_ is any non-empty string, e.g.,

    { path      : '/api/v1/group/perform/9'
    , requestID : '3'
    }

#### Delete Group
To define a group,
an authorized client sends:

    { path      : '/api/v1/group/delete/ID'
    , requestID : 'X'
    }

where _ID_ corresponds to the _groupID_ of the group to be deleted, and _X_ is any non-empty string, e.g.,

    { path      : '/api/v1/group/delete/9'
    , requestID : '4'
    }

