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

## Taxonomy
A **key concept** in the steward is that when a thing observes an event,
then another thing performs an task.
(Of course, the observation and performance may involve multiple things.)

### Events
### Tasks
### Groups

* operators: [ 'and', 'or', 'not' ]
* types: [ 'device', 'event', 'task' ]


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
