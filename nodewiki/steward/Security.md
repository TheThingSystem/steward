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
it may invoke an API call to upload

* A self-signed public-key certificate; and,

* An ssh key fingerprint.

and then retrieve a _privacy package_ from the steward containing:

* A self-signed public-key certificate;

* An SNI hostname; and,

* An ssh key fingerprint.

After this exchange,
both the steward and client have https and ssh materials suitable for uniquely identifying both parties.

### HTTPS access
Whenever the client connects to the steward for API access:

* The client uses the mDNS to identify the IP address and port number of the steward.

* The client establishes a TCP connection, and starts TLS over that connection:

    * It authenticates itself using the private-key corresponding to the PKC that it sent to the steward.

    * It sends the SNI hostname during the initialization, allowing the steward to select the appropriate private-key to use.

* Once the TLS is negotiated, the client does an HTTP upgrade to WebSockets.

### SSH access
Whenever the client connects to the steward for ssh access:

* The client uses the mDNS to identify the IP address and port number of the steward.

* The client starts an ssh client using its ssh private key.

* Using a local extension, the client sends the SNI from the _privacy package_.

* The client verifies that the fingerprint corresponding to the server matches the value provided in the _privacy package_.

## Authorization: Roles
A user has one of five roles:

* _master_   - for unlimited access to the steward;

* _resident_ - for extended access to the steward;

* _guest_    - for limited access to the steward;

* _device_   - for devices implementing [The Simple Thing Protocol](Simple.md); or,

* _cloud_    - for services in the cloud
