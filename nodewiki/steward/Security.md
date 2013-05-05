**THIS IS A PROPOSAL, NOT AN IMPLEMENTATION**

# The Security Model
Speaking plainly: there is a _wide_ spectrum of security properties with respect to home automation peripherals. Although there are some exceptions, the properties run the gamit from horrific to rather unfortunate.

With that in mind, here's the basics:

* The steward runs on either a Mac or a Linux box.

    * If we shipped you the box, then it is hardened according to the box's specification;

    * otherwise, then hardening of the box is outside of our scope.

* Allow only persons whom you trust to have physical access to the box. Anyone who can physically access the is capable of defeating any security on the box. This is true whether those persons wear black hats or diapers.

* If you connect to the steward via the loopbox interface, you have full administrative privileges.

    * This is a failsafe feature. If you lose all access tokens (physical or virtual), you can still access the console applications via a browser running on the box.

    * You may be tempted to provide a tunnel to the loopback interface. If you feel you must do so, please make it an ssh tunnel that requires public-key (not password) authentication.

* If you connect to the steward via another interface, you must encrypt to do anything meaningful.

    * However, the steward will accept unencrypted traffic for http/ws protocols for very limited status checking.

## Client (not user) Authentication
### The _tap_
A person takes a device and _taps_ the NFC pad on the box. During the tap:

* The client sends:

    * An ssh public key to the steward, which is used by the steward to authenticate incoming ssh requests.

* The steward returns:

    * A self-signed public-key certificate;

    * An SNI hostname;

    * An ssh key fingerprint; and,

    * An opaque client-identifier.

### API access
Whenever the client connects to the steward for API access:

* The client uses the mDNS to identify the IP address and port number of the steward.

* The client establishes a TCP connection, and starts TLS over that connection:

    * It authenticates itself using the private-key corresponding to the PKC that it sent to the steward during the _tap_.

    * It send the SNI hostname during the initialization, allowing the steward to select the appropriate private-key to use.

* Once the TLS is negotiated, the client does an HTTP upgrade to WebSockets.

### ssh access
Whenever the client connects to the steward for SSH access:

* The client uses the mDNS to identify the IP address and port number of the steward.

* The client starts an ssh client using the client-identifier and it's ssh private key.

* The client verifies that the fingerprint corresponding to the server matches the value provided during the _tap_.
