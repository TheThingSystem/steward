#Protocol specifications

The two different protocols are outlined below:

## Generic protocol

The protocol:

1. The registration server resides at a well-known location in the Internet, e.g.,

        https://registrar.example.com/

2. The hidden server establishes an HTTPS connection to the registration server and authenticates itself.

3. The registration server returns a _rendezvous triple_ containing a hostname, a TCP port, and a cookie.

4. The hidden server connects to the location in the _rendezvous triple_ (a rendezvous server),
sends the cookie followed by '\n',
and waits for an (eventual) status indicator before sending to/from the mobile client.
In the interim,
if the connection fails,
the hidden server retries accordingly.

5. The mobile client establishes an HTTPS connection to the registration server,
and identifies the hidden server that it's interested in.

6. The registration server returns a _rendezvous triple_.

7. The mobile client connects to the location in the _rendezvous triple_,
sends the cookie followed by '\n',
and waits for a status indicator before sending to/from the hidden server.

8. When the rendezvous server server receives the cookie from the mobile client,
it sends the '+OK...\n' status indicator to both the hidden server and the mobile client.

9. Upon receiving the status indicator,
in addition to processing any data from the mobile client,
the hidden server may make another connection using the _rendezvous triple_ from the registration server.
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
    |   HTTPS PUT of |          |                |
    |           UUID |   ---->  |                |
    |                |          |                |
    |                |  <----   | 3:return triple|
    |                |          |                |
    |                |          |                |            mobile  client
    |                |          |                |          +----------------+
    |                |          |                |          |                |
    |                |          |                |          | 5:HTTPS GET of |
    |                |          |                |  <----   | UUID           |
    |                |          |                |          |                |
    |                |          |6:return triple |   ---->  |                |
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
    |  keep TCP open |          | keep TCP open  |          |                |
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

## HTTP-specific protocol

The protocol:

1. The registration server resides at a well-known location in the Internet, e.g.,

        https://registrar.example.com/

2. The hidden server establishes an HTTPS connection to the registration server,
and authenticates using the CONNECT method:

        CONNECT uuid:ID?response=TKN HTTP/1.1

    where 'ID' is administratively assigned by the provider of the registration server,
and TKN is a one-time authentication token.

3. If the hidden server successfully authenticates itself,
then the registration server sends:

        HTTP/1.1 200 OK

    and waits for an (eventual) rendezvous with the mobile client.
(If an error occurs, the registration server returns a 4xx or 5xx response and closes the connection.)

    Similarly,
the hidden server, upon receiving the 200 response waits for a subsequent HTTP request from the mobile client.
In the interim,
if the connection fails,
the hidden server retries accordingly.

4. The mobile client establishes an HTTPS connection to the registration server, e.g.,

        https://uuid:ID@registrar.example.com/...

    and identifies the hidden server that it's interested in:

        GET /... HTTP/1.1
        Authorization: base64(uuid:ID)
        Host: ...
        Connection: keep-alive
        ...

    (Yes, the HTTP-specific protocol misuses HTTP's
[basic authentication](http://en.wikipedia.org/wiki/HTTP_basic_authentication) header to identify the hidden server.)

5. If a hidden server with that identity is registered,
then the registration server sends the HTTP request over the connection to the hidden server.
(Otherwise, the registration server returns a 4xx or 5xx response and closes the connection.)

6. Upon receiving the HTTP request,
in addition to processing any data on the connection,
the hidden server may make another HTTPS connection to the registration server.
(In this fashion,
the hidden server should always have something waiting for the next mobile client connection.)

7. Regardless:

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
    |2:HTTPS CONNECT |   ---->  |                |
    |                |          |                |
    |                |  <----   | 3:return 200   |
    |                |          |                |
    |  keep TCP open |          | keep TCP open  |            mobile  client
    |                |          |                |          +----------------+
    |                |          |                |          |                |
    |                |          |                |          | 4:HTTPS with   |
    |                |          |                |  <----   |       ?uuid=ID |
    |                |          |                |          |                |
    |                |  <----   | 5:send request |          |                |
    |                |          |                |          |                |
    |                |          |                |          |                |
    | 6:             |          |                |          |                |
    | [if multiple   |          |                |          |                |
    |  connections   |          |                |          |                |
    |  are desired,  |          |                |          |                |
    |  another TCP   |          |                |          |                |
    |  connection to |          |                |          |                |
    |  the rendezvous|          |                |          |                |
    |  server occurs]|          |                |          |                |
    |                |          |                |          |                |
    |                |          |                |          |                |
    |       7:       |          |       7:       |          |       7:       |
    | send/recv data |  <---->  | <------------> |  <---->  | send/recv data |
    |    until close |          |                |          | until close    |
    |                |          |                |          |                |
    |                |  <----   | <------------  |  <----   | close          |
    |                |          |     and/or     |          |                |
    |          close |   ---->  |  ------------> |   ---->  |                |
    |                |          |                |          |                |
    +----------------+          +----------------+          +----------------+
