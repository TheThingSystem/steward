#node-rendezvous

Straight-forward rendezvous for 'hidden servers' (behind firewalls/NATs) and 'mobile clients' using a third-party service. The source code is [available on GitHub](https://github.com/mrose17/node-rendezvous)

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



##Pictorially:





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


##Security Model

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


##Set-Up

1. Get a tarball of this [repostory](https://github.com/mrose17/node-rendezvous/archive/master.zip) onto your local system,
extract it, 'cd' there and then:

        % npm -l install

    Note that until we reach Step 7, all the commands will be run on your local system.

2. Create a keypair for use by the registrar. There are many ways to do this, i suggest:

        % openssl req -x509 -newkey rsa:2048 -keyout registrar.key -nodes \
            -out registrar.crt -days 3650 -subj '/CN=example-rendezvous'
        
        % chmod  a-w registrar.key registrar.crt
        
        % chmod go-r registrar.key

    this creates a self-signed certificate

        registrar.crt
    and the corresponding private key

        registrar.key

3. Find out what the stable IP address is of your VPS ('a.b.c.d') and create a file called config.js that looks like this:

        var fs          = require('fs');
        
        exports.options =
            { registrarHost  : 'a.b.c.d'
            , registrarPort  : 8898
        
            , keyData        : fs.readFileSync('./registrar.key')
            , crtData        : fs.readFileSync('./registrar.crt')
        
            , redisHost      : '127.0.0.1'
            , redisPort      : 6379
            , redisAuth      : ''

            , rendezvousHost : 'a.b.c.d'
            , rendezvousPort : 8899
            };
    
4. We're nearly ready.
The next step is to create entries in the database for the remote servers.
Running:

        % node users.js

    will bring up a server on

        http://127.0.0.1:8893

    Browse this URL, and you will see all UUIDs defined in the database (initially, none).
To create an entry, use the form on the page.
When an entry is created,
a JS file is created which you can use with your hidden server.
You will want to copy the JS file to the repository for your hidden server.

5. When you are done creating entries for the remote servers, kill

        users.js

6. Copy the server files to the VPS:

        % cd .. ; scp -r node-rendezvous-master root@a.b.c.d:.

7. Login to the VPS and install [node.js](http://nodejs.org/download/), and then

        vps% cd node-rendezvous-master/
        vps% npm install -l

8. Finally, start the server:

        vps% bin/run.sh

##License


[MIT](http://en.wikipedia.org/wiki/MIT_License) license. Freely have you received, freely give.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.