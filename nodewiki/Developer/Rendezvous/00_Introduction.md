#Node Rendezvous

The [_node-rendezvous_](https://github.com/mrose17/node-rendezvous) package is a general purpose stand-alone package allowing rendezvous for 'hidden servers' (behind firewalls/NATs) and 'mobile clients' using a third-party service. The source code is [available on GitHub](https://github.com/mrose17/node-rendezvous)

It is used by the _steward_ software for this purpose, however it is not tied to the _steward_ code base. The package implements two different protocols:

* A generic protocol that will allow an arbitrary TCP path between the hidden server and the mobile client; and,

* An HTTP-specific protocol that will allow an HTTP connection from the mobile client to the hidden server.

In both cases, the hidden server must first authenticate itself with a registration server using HTTPS, before the mobile client attempts a rendezvous.

With the generic protocol: after authentication, the hidden server establishes a TCP connection to a rendezvous server and then waits for a rendezvous. Later on, the mobile client establishes an HTTPS connection, identifies the hidden server, receives information for establishing a rendezvous, and then establishes a TCP connection to a rendezvous server that moves the octets back-and-forth.

With the HTTP-specific protocol: the hidden server uses HTTP's CONNECT method both to authenticate itself and wait for a rendezvous. The mobile client establishes an HTTPS connection to the registration server, and specifies the identity of the hidden server as a query parameter. In this case, the rendezvous server is co-resident with the registration server and moves the octets back-and-forth.

The generic protocol may be provisioned as a highly-scalable service, but requires two listening TCP ports, one for HTTPS and the other for TCP. This makes it suitable for deployment on a [VPS](http://en.wikipedia.org/wiki/Virtual_private_server).

The HTTP-specific protocol may be provisioned using a [PAAS](http://en.wikipedia.org/wiki/Platform_as_a_service) provider, if that service allows the HTTP CONNECT method.

