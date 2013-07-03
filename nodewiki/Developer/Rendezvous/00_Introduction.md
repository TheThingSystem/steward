#Node Rendezvous

The [_node-rendezvous_](https://github.com/mrose17/node-rendezvous) package is a general purpose stand-alone package allowing rendezvous for 'hidden servers' (behind firewalls/NATs) and 'mobile clients' using a third-party service. The source code is [available on GitHub](https://github.com/mrose17/node-rendezvous)

it is used by the _steward_ software for this purpose, however it is not tied to the _steward_ code base.

The protocol:

1. The registration server resides at a well-known location in the Internet.

2. The hidden server establishes an https connection to the registration server and authenticates itself.

3. The registration server returns a _rendezvous triple_ containing a hostname, a TCP port, and a cookie.

4. The hidden server connects to the location in the _rendezvous triple_ (the rendezvous server),
sends the cookie followed by '\n',
and waits for an (eventual) status indicator before sending to/from the mobile client.
If the connection fails, it retries accordingly.

5. The mobile client establishes an https connection to the registration server,
and identifies the hidden server that it's interested in.

6. The registration server returns a _rendezvous triple_.

7. The mobile client connects to the location in the _rendezvous triple_,
sends the cookie followed by '\n',
and waits for a status indicator before sending to/from the hidden server.

8. When the rendezvous server server receives the cookie from the mobile client,
it sends the '+OK...\n' status indicator to both the hidden server and the mobile client.

9. Upon receiving the status indicator,
the hidden server (in addition to processing any data from the mobile client)
may make another connection using the _rendezvous triple_ from the registration server.
(In this fashion,
the hidden server should always have something listening for the next mobile client connection.)

10. Regardless:

 * any data written from one socket is written to the other; and,

 * if either socket is closed, the other socket is also closed.

Pictorially:





                                registration server
                                +----------------+
                                |                |
                                | 1:listen on    |
                                | well-known IP  |
                                | adddress and   |
     "hidden" server            | TCP port       |
     behind NAT, etc.           |                |
    +----------------+          |                |
    |                |          |                |
    |2:authenticated |          |                |
    |   https PUT of |          |                |
    |           UUID |   ---->  |                |
    |                |          |                |
    |                |  <----   | 3:return triple|
    |                |          | or error       |
    |                |          |                |
    |                |          |                |            mobile  client
    |                |          |                |          +----------------+
    |                |          |                |          |                |
    |                |          |                |          | 5:https GET of |
    |                |          |                |  <----   | UUID           |
    |                |          |                |          |                |
    |                |          |6:return triple |   ---->  |                |
    |                |          |       or error |          |                |
    |                |          |                |          |                |
    |                |          |                |          |                |
    |                |          |                |          |                |
    |                |          |                |          |                |
    |                |          |                |          |                |
    |                |          |                |          |                |
    |                |          +----------------+          |                |
    |                |                                      |                |
    |                |                                      |                |
    |                |          rendezvous server           |                |
    |  4:open TCP to |          +----------------+          |                |
    | triple address |          |                |          |                |
    |and send cookie |   ---->  |                |          |                |
    |                |          |                |          |                |
    |  keep TCP open |          |                |          |                |
    |                |          |                |          | 7: open TCP to |
    |                |          |                |          | triple address |
    |                |          |                |  <----   | and send cookie|
    |                |          |                |          |                |
    |                |  <----   | 8:send '+OK\n' |   ---->  |                |
    |                |          |                |          |                |
    | 9:             |          |                |          |                |
    | [if multiple   |          |                |          |                |
    |  connections   |          |                |          |                |
    |  are desired,  |          |                |          |                |
    |  another TCP   |          |                |          |                |
    |  connection to |          |                |          |                |
    |  the rendezvous|          |                |          |                |
    |  server occurs]|          |                |          |                |
    |                |          |                |          |                |
    |                |          |                |          |                |
    |      10:       |          |      10:       |          |      10:       |
    | send/recv data |  <---->  | <------------> |  <---->  | send/recv data |
    |    until close |          |                |          | until close    |
    |                |          |                |          |                |
    |                |  <----   | <------------  |  <----   | close          |
    |                |          |     and/or     |          |                |
    |          close |   ---->  |  ------------> |   ---->  |                |
    |                |          |                |          |                |
    +----------------+          +----------------+          +----------------+


