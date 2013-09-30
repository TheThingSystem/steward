README for arduino example clients
==================================
By default, the steward requires that LAN connections use HTTPS (not HTTP).

At the present time, doing HTTPS with the arduino clients is somewhat painful.

Accordingly, there is an option in the steward that allows you to disable this check, thereby allowing LAN connections to use HTTP:

        { path      : /api/v1/actor/perform/place
          requestID : 'NNN'
          perform   : 'set'
          parameter : JSON.stringify({ strict: 'off' })
        }
