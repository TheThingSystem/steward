#The Security Model

The security model is:

1. The hidden server and the mobile client have to know the domain-name or IP-address of the rendezvous server,
and have to trust the certificate used by the rendezvous server.
This knowledge and trust is determined by out-of-band means.

2. The hidden server and rendezvous server must share a time-based secret. This is how the rendezvous server knows that the hidden server is allowed to respond to requests for a particular UUID. This shared secret is created by out-of-band means.

3. The mobile client does not need to authenticate itself to the rendezvous server.
If a hidden server is responding for a particular UUID,
then amy mobile client knowing the UUID is allowed to initiate a connection to that hidden server.

4. __Most importantly:__ it is the responsibility of the hidden server to authenticate the mobile client once the rendezvous
occurs.
Although there are many well-reasoned arguments as to why hiding behind a firewall is a bad thing,
please do not negate the one good thing about being behind a firewall or NAT!