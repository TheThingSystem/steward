#Node Rendezvous

The [_node-rendezvous_](https://github.com/mrose17/node-rendezvous) package is a general purpose stand-alone package allowing rendezvous for 'hidden servers' (behind firewalls/NATs) and 'mobile clients' using a third-party service. The source code is [available on GitHub](https://github.com/mrose17/node-rendezvous)

It is used by the _steward_ software for this purpose, however it is not tied to the _steward_ code base. The package implements an HTTP-specific protocol that will allow an HTTP connection from the mobile client to the hidden server.

The hidden server uses HTTPS and the *CONNECT* method both to authenticate itself and wait for a rendezvous.
The mobile client establishes an HTTPS connection to the rendezvous server, and specifies the identity of the hidden server. At this point the rendezvous server moves the octets back-and-forth.

The protocol may be provisioned using a [PAAS](http://en.wikipedia.org/wiki/Platform_as_a_service) provider,
_if_ that service transparently supports the HTTP *CONNECT* method. Otherwise, deployment must be provisioned using a [VPS](http://en.wikipedia.org/wiki/Virtual_private_server).

