#The Security Model

The security model for this package is:

1. The hidden server and the mobile client have to know the domain-name or IP-address of the registration server,
and have to trust the certificate used by the registration server.
This knowledge and trust is determined by out-of-band means.

2. The hidden server and registration server must share a time-based secret.
This is how the registration server knows that the hidden server is allowed to respond to requests for a particular UUID.
This shared secret is created by out-of-band means.

3. The mobile client does not need to authenticate itself to the registration server.
If a hidden server is responding for a particular UUID,
then a mobile client knowing the UUID is allowed to initiate a connection to that hidden server.

4. __Most importantly:__ it is the responsibility of the hidden server to authenticate the mobile client once the rendezvous
server sends the '+OK...\n' status indicator.
Although there are many well-reasoned arguments as to why hiding behind a firewall is a bad thing,
please do not negate the one good thing about being behind a firewall or NAT!


The implementation in this repository seperates the protocol from the model. The files

    registration-server.js
    rendezvous-server.js

ipmlement the protocol, and the file

    cloud-server.js

implements the security model.

This package is intended as a small-scale implementation,
so all three files reside in a single process.
We're going to use a [VPS](http://en.wikipedia.org/wiki/Virtual_private_server) for deployment.
I'd prefer to use a node.js [PAAS](http://en.wikipedia.org/wiki/Platform_as_a_service) such as
[nodejitsu](http://nodejitsu.com);
however,
the server needs to listen both for HTTPS and "raw" TCP connections.
At the present time,
no PAAS provider offers the latter.

In terms of the security model,
the instructions below describe how to create a keypair for use by the registrar,
and how to create a configuration file for a VPS deployment.

You do not need to have a domain name for your VPS;
however, you must have a stable IP address.
