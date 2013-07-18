# The Security Model
Speaking plainly: there is a _wide_ spectrum of security properties with respect to home automation peripherals. Although there are some exceptions, the properties run the gamit from horrific to rather unfortunate.

With that in mind, here's the basics:

* The steward runs on either a Mac or a Linux box.

    * If we shipped you the box, then it is hardened according to the box's specification;

    * otherwise, then hardening of the box is outside of our scope.

* Allow only persons whom you trust to have physical access to the box.
Anyone who can physically access the box is capable of defeating any security on the box.
This is true whether those persons wear black hats or diapers.

* If you connect to the steward via the loopbox interface, you have full administrative privileges.

    * This is a failsafe feature. If you lose all access tokens (physical or virtual), you can still access the console applications via a browser running on the box.

    * You may be tempted to provide a tunnel to the loopback interface. If you feel you must do so, please make it an ssh tunnel that requires public-key (not password) authentication.

* If you connect to the steward via another interface, you must encrypt.
The steward has a self-signed certificate that it used for authenticated traffic.
However,
once a client is registered with the steward,
it downloads a _privacy package_ containing keys specific to the steward/client pairing.

## The Bootstrap
First,
the client should be on a computer that's on the same network as the steward.

Whenever a client connects to the steward for the first time,
the client warns that the certificate being used by the steward is untrusted.
At this point, two actions must be undertaken:

* look at the "details" of the certificate and record its "SHA1 fingerprint", which will look something like this:

        9E DF 5F C4 17 E2 3E D3 88 E2 74 17 D6 93 91 8D 96 1D 9A E1

* click the checkbox that says something like :

        Always trust 'steward' when connecting to ...

Compare the fingerprint reported by the client with the fingerprint in the file:

    sandbox/startup.sha1

on the steward.

If the two values match, then the client is talking directly to the steward;
otherwise, there is another device on the network which is perfomring a man-in-the-middle attack.
Find it and "fix" it as is appropriate.


## Client (not user) Authentication
Clients authenticate to the steward,
and the user associated with a client is authorized to invoke various API calls.
There is a 1:N relationship between users and clients.

If no users are configured on the steward,
then an unauthenticated API call from a device on the same network as the steward may be used to create the initial user and
client.

### Authentication: Time-based OTP (TOTP)
When a client is created,
the steward responds with TOTP information allowing the client to authenticate itself.
The methods used by the TOTP algorithm are based on [RFC 6238](http://tools.ietf.org/html/rfc6238),
so programs such as [Google Authenticator](https://support.google.com/accounts/answer/1066447) can be used for web-based
access.

### Privacy: HTTPS or SSH
After a client is created,
it may upload an SSH public key fingerprint and retrieve a _privacy package_ from the steward containing:

* An SNI hostname; and,

* A self-signed public-key certificate;

* An ssh key fingerprint.

__Note that at present, these steward ignores the SNI hostname and uses the same private keys for all clients.
This will likely change in a future release.__

### HTTPS access
Whenever the client connects to the steward for API access:

* The client uses the mDNS ("_wss._tcp." ) to identify the IP address and port number of the steward.

* The client establishes a TCP connection,
starts TLS over that connection,
and then HTTPS.

* Once the HTTPS is negotiated, the client does an HTTP upgrade to WebSockets, and then authenticates itself.

### SSH access
**Note that at present, _ssh_ is not implemented; please use _https_ instead.**

Whenever the client connects to the steward for ssh access:

* The client uses the mDNS ("_ssh._tcp." )  to identify the IP address and port number of the steward.

* The client starts an ssh client using its ssh private key.

* The client verifies that the fingerprint corresponding to the server matches the value provided in the _privacy package_,
and then authenticates itself.

## Authorization: Roles
A user has one of five roles:

* _master_   - for unlimited access to the steward;

* _resident_ - for extended access to the steward;

* _guest_    - for limited access to the steward;

* _device_   - for devices implementing [The Simple Thing Protocol](Simple.md); or,

* _cloud_    - for services in the cloud
