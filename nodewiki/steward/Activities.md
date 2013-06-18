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

* An _groupType_ (either 'device', 'place', 'event', or 'task') and _actorID_ that is assigned by the client during group creation.

* A _groupOperator_ used by a superior to relate its immediate children:
_and_ (0), _or_ (1), or _not_ (2).

* A _sortOrder_ to provide an optional hint to programs when sorting groups for display.


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
