**THIS IS FOR REVIEW, NOT YET IMPLEMENTATED (BUT SOON)**

# The _Native Thing_ Protocol
For those things that are third-party programmable but lack an effective interface for steward management,
the _Native Thing_ protocol provides a mechanism for adding steward management.

## Operations

The basics:

* All exchanges are via WebSockets.

* All messages are in JSON.

* All messages have a _requestID_ parameter, which is a non-empty string.
  Within a message flow from one to peer to the other,
  a _requestID_ value may not be reused until a completion response is received.

* All requests have a _path_ parameter.

* There are four kinds of responses:

  1. _Intermediate_ responses (containing only a _requestID_ parameter) indicating that the peer has received the message,
      but that processing may take a while.
  **(Note that version 1 of the _Native Thing_ protocol does not use intermediate responses.)**

  2. _Error_ responses (containing a _requestID_ and _error_ parameter) indicating whether the failure is permanent and
     containing a textual diagnostic.

  3. _Simple result_ responses (containing a _requestID_ and _result_ parameter) indicating success and optionally containing
     additional information.

  4. _Detailed result_ responses (containing a _requestID_ parameter and one of a _things_, _events_, or _tasks_ parameter,
     indicating the success or failure of each action in the request.


Here are some examples. A request:

    { path              : '/api/v1/pair'
    , requestID         : 1

      // other parameters, if any, go here...
    }

An intermediate response:

    { requestID         : 1
    }

An error response:

    { requestID         : 1
    , error             :
      { permanent       : false
      , diagnostic      : '...'
      }
    }

A simple result:

    { requestID         : 1
    , result            :
      { status          : 'success'

      // other parameters, if any, go here...
      }
    }

A detailed result:

    { requestID         : 10
    , tasks             :
      { 'taskID1'       :
        { 'status'      : 'success'
        }
      , 'taskID2'       :
        { error         :
          { permanent   : true
          , diagnostic  : 'invalid parameter value for task performance'
          }
        }
      }
    }

## Session Establishment

When an implementation detects a steward advertisement via multicast DNS,
it establishes a WebSockets connection to the steward:

    wss://IP:PORT/native

After verifying the signature,
the implementation sends a _pair_ or _hello_ message,
depending on whether it has paired with the steward before.

### Pair implementation to steward

The _pair_ message is sent when the implementation has not paired with the steward before:

    { path              : '/api/v1/pair'
    , requestID         : 1
    , uuid              : '01234567-89ab-cdef-0123-4567890abcde'
    }

When the steward receives the _pair_ message,
then it sends a simple result containing a passcode:

    { requestID         : 1
    , result            :
      { status          : 'success'
      , passCode        : '...'
      }
    }

The _uuid_ and _passCode_ parameters must be retained by the implementation.

The implementation must now issue the _hello_ message using that passcode.

### Implementation authenticates with steward

When the implementation has a _uuid/passCode__ pairing,
the _hello_ message is sent to the steward:

    { path              : '/api/v1/hello'
    , requestID         : 2
    , uuid              : '01234567-89ab-cdef-0123-4567890abcde'
    , passcode          : 'XXXXXX'
    }

When the steward receives the _hello_ message,
a simple result indicates that authentication is successful:

    { requestID         : 2
    , result            :
      { status          : 'success'
      }
    }

Otherwise,
an error response is returned:

    { requestID         : 2
    , error             :
      { permanent       : true
      , diagnostic      : 'authentication failed'
      }
    }

## Session Exchanges
When the implementation is successfully authenticated,
it exchanges zero or more messages with the steward.
__Note that requests may be originated both by the implementation and the steward.__

State is maintained over the duration of a session.
If the underlying connection is broken,
then any mappings of _thingIDs_, _eventIDs_, and _taskIDs_ should be deleted by both peers.
**(Note that in version 1 of the _Native Thing Protocol__,
_taskID_ values have no significance outside of a single message exchange.)**

### Define Prototypes

In order to understand the properties which are used to describe the state of a thing,
you __MUST__ read the section on the steward _Dictionary_ in [Activities](Activities.md).

The _prototype_ message is sent by the implementation to the steward to define one or more thing prototypes:

    { path              : '/api/v1/prototype'
    , requestID         : 3
    , things            :
      { '/device/A/B/C' :
        { observe       : [ 'o1', 'o2', ..., 'oN' ]
        , perform       : [ 'p1', 'p2', ..., 'pN' ]
        , properties    :
          { name        : true
            status      : [ 's1', 's2', ..., 'sN' ]

            // other properties go here...
          }
        , validate      :
          { observe     : true
          , perform     : true
          }
        }

        // other prototype definitions, if any, go here...
      }
    }

When the steward receives the _prototype_ message,
either a detailed result or error response is returned:

    { requestID         : 3
    , things            :
      { '/device/A/B/C' :
        { status        : 'success'
        }
      }
    }

or

    { requestID         : 3
    , things            :
      { '/device/A/B/C' :
        { error         :
          { permanent   : true
          , diagnostic  : 'missing properties parameter'
          }
        }
      }
    }

### Define Instances

The _register_ message is sent by the implementation to the steward to register one or more things corresponding to a prototype:

    { path              : '/api/v1/register'
    , requestID         : 4
    , things            :
      { 'UDN1'          :
        { prototype     : '/device/A/B/C' :
        , name          : '...'
        , status        : '...'
        , device        :
          { name        : '...'
          , maker       : '...'
          , model       :
            { name      : '...'
            , descr     : '...'
            , number    : '...'
            }
          , unit        :
            { serial    : '...'
              udn       : 'UDN1'
            }
          }
        , updated       : timestamp
        , info          :
          {
          // per-instance properties go here...
          }
        }

        // other thing registrations, if any, go here...
      }
    }

When the steward receives the _register_ message,
either a detailed result or error response is returned.
If a result response is returned, it contains a _thingID_ value for each thing,
e.g.,

    { requestID         : 4
    , things            :
      { 'UDN1'          :
        { 'status'      : 'success'
          'thingID'     : 'thingID1'
        }
      }
    }

or

    { requestID         : 4
    , things            :
      { 'UDN1'          :
        { error         :
          { permanent   : true
          , diagnostic  : 'UDN is already registered'
          }
        }
      }
    }

The _thingID_ value is used by both the steward and implementation when referring to the thing for the duration of the session.

### Update Properties
The _update_ message is sent by the implementation to the steward to update the state of a thing:

    { path              : '/api/v1/update'
    , requestID         : 5
    , things            :
      { 'thingID2'      :
        { name          : '...'
        , status        : '...'
        , updated       : timestamp
        , info          :
          {
          // the entire list of properties goes here...
          }
        }

        // updates for other things, if any, go here...
      }
    }

When the steward receives the _update_ message,
either a detailed result or error response is returned:

    { requestID         : 5
    , things            :
      { 'thingID2'      :
        { 'status'      : 'success'
        }
      }
    }

or

    { requestID         : 5
    , things            :
      { 'thingID2'      :
        { error         :
          { permanent   : true
          , diagnostic  : 'no such thingID'
          }
        }
      }
    }

### Observe and Report Events
The _observe_ message is sent by the steward to the ipmlementation to ask it to observe one or more events:

    { path              : '/api/v1/observe'
    , requestID         : 6
    , events            :
      { 'eventID1'      :
        { 'thing'       : 'thingID1'
        , 'observe'     : '...'
        , 'parameter'   : '...'
        , 'testOnly'    : false
        }

        // observation requests for other events, if any, go here...
      }
    }

When the implementation receives the _observe_ message,
if the _testOnly_ parameter is true,
then the implementation evaluates the observation parameters, and
either a detailed result or error response is returned:

    { requestID         : 6
    , events            :
      { 'eventID1'      :
        { 'status'      : 'success'
        }
      }
    }

or

    { requestID         : 6
    , events            :
      { 'eventID1'      :
        { error         :
          { permanent   : true
          , diagnostic  : 'invalid parameter value for event observation'
          }
        }
      }
    }

If the _testOnly_ parameter is false,
then the implementation immediately returns a detailed result or error response,
and
the _eventID_ value is used by both the steward and implementation when referring to the thing for the duration of the session.

Whenever any of the events occur in the future, will send an _report_ message to the steward:

    { path              : '/api/v1/report'
    , requestID         : 7
    , events            :
      { 'eventID1'      :
        { reason        : 'observe'
        }

        // observations reports for other events, if any, go here...
      }
    }

and the steward responds with either a detailed result or error response:

    { requestID         : 7
    , events            :
      { 'eventID1'      :
        { status        : 'success'
        }
      }
    }

or

    { requestID         : 7
    , events            :
      { 'eventID1'      :
        { error         :
          { permanent   : true
          , diagnostic  : 'invalid eventID'
          }
        }
      }
    }

#### Report Event Observation Failure
If the implementation is no longer able to observe an event:

    { path              : '/api/v1/report'
    , requestID         : 8
    , events            :
      { 'eventID1'      :
        { reason        : 'failure'
          permanent     : true
          diagnostic    : '...'
        }
      }
    }

and the steward responds with either a result response:

    { requestID         : 8
    , events            :
      { 'eventID1'      :
        { status        : 'success'
        }
      }
    }

#### Cancel Event Observation
If the steward no longer wishes for the implementation to observe an event:

    { path              : '/api/v1/report'
    , requestID         : 9
    , events            :
      { 'eventID1'      :
        { reason        : 'cancel'
        }
      }
    }

and the implementation responds with either a detailed result or error response:

    { requestID         : 9
    , events            :
      { 'eventID1'      :
        { status        : 'success'
        }
      }
    }

or

    { requestID         : 9
    , events            :
      { 'eventID1'      :
        { error         :
          { permanent   : false
          , diagnostic  : 'database busy, please retry...'
          }
        }
      }
    }

### Perform Tasks
The _perform_ message is sent by the steward to the ipmlementation to ask it to observe one or more tasks:

    { path              : '/api/v1/perform'
    , requestID         : 10
    , tasks             :
      { 'taskID1'       :
        { 'thing'       : 'thingID1'
        , 'perform'     : '...'
        , 'parameter'   : '...'
        , 'testOnly'    : false
        }

        // performance requests for other tasks, if any, go here...
      }
    }

When the implementation receives the _observe_ message,
if the _testOnly parameter is true,
then the implementation evaluates the performance parameters, and
either a detailed result or error response is returned:

    { requestID         : 10
    , tasks             :
      { 'taskID1'       :
        { 'status'      : 'success'
        }
      }
    }

or

    { requestID         : 10
    , tasks             :
      { 'taskID1'       :
        { error         :
          { permanent   : true
          , diagnostic  : 'invalid parameter value for task performance'
          }
        }
      }
    }

If the _testOnly_ parameter is false,
then the implementation immediately returns a detailed result or error response,
and then begins to perform the tasks.

## Security
Security is based on these assumptions:

* An authorized person is responsible for pairing the implementation to the steward.

* Both the steward and the implementation keep the _uuid/passCode__ pairing secure.

* The crytographic algorithms used for the secure WebSockets connection are, in fact, secure.
