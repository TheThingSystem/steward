#Protocol specifications

The protocols is outlined below:

1. The rendezvous server resides at a well-known location in the Internet, e.g.,

        https://rendezvous.example.com/

2. The hidden server establishes an HTTPS connection to the rendezvous server,
and authenticates using the CONNECT method, e.g.,

        CONNECT uuid:ID?response=TKN HTTP/1.1

    where 'ID' is administratively assigned by the provider of the rendezvous server,
and TKN is a one-time authentication token.

3. If the hidden server successfully authenticates itself,
then the rendezvous server sends:

        HTTP/1.1 200 OK

    and waits for an (eventual) rendezvous with the mobile client.
(If an error occurs, the rendezvous server returns a 4xx or 5xx response and closes the connection.)

    Similarly,
the hidden server, upon receiving the 200 response,
waits for a subsequent HTTP request from the mobile client over the connection.
In the interim,
if the connection fails,
the hidden server retries accordingly.

4. The mobile client establishes an HTTPS connection to the rendezvous server, e.g.,

        https://rendezvous.example.com/...

    and gets back a request for digest authentication from the rendezvous server:

        HTTP/1.1 401
        WWW-Authenticate: Digest realm="rendezvous"
                          , qop="auth, auth-int"
                          , nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093"
                          , opaque="5ccc069c403ebaf9f0171e9517f40e41"

    and the mobile client responds using the hidden server's UUID as the username with any password:

        GET /... HTTP/1.1
        Host: ...
        Connection: keep-alive
        Authorization: Digest username="ID"
                       , realm="rendezvous"
                       , qop=auth
                       , nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093"
                       , opaque="5ccc069c403ebaf9f0171e9517f40e41"
                       , ...

    (Yes, the HTTP-specific protocol misuses HTTP's
[digest authentication](http://en.wikipedia.org/wiki/Digest_authentication) header to identify the hidden server.)

5. If a hidden server with that identity is registered,
then the rendezvous server sends the mobile client's second HTTP request over the connection to the hidden server,
but without the 'Authentication' header.
(Otherwise, the rendezvous server returns a 4xx or 5xx response and closes the connection.)

6. Upon receiving the HTTP request,
in addition to processing any data on the connection,
the hidden server may make another HTTPS connection to the rendezvous server.
(In this fashion,
the hidden server should always have something waiting for the next mobile client connection.)

7. Regardless:

 * any data written from one socket is written to the other; and,

 * if either socket is closed, the other socket is also closed.

Pictorially:

                                rendezvous  server
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
    |                |          |                |  <----   |                |
    |                |          |                |          |                |
    |                |          | return 401     |   ---->  |                |
    |                |          |                |          |                |
    |                |          |                |          | HTTPS with     |
    |                |          |                |          | digest         |
    |                |          |                |  <----   | authentication |
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
