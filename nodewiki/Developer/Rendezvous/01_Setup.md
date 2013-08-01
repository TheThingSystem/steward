#Setting Up the Rendezvous Server

You do not need to have a domain name for your VPS;
however, you must have a stable IP address (e.g., 'a.b.c.d').

1. Get a [tarball](https://github.com/mrose17/node-rendezvous/archive/master.zip) of this repostory onto your local system,
extract it, and then:

        % cd node-rendezvous-master
        % npm -l install

    Note that until we reach Step 7, all the commands will be run on your local system.

2. Create a file called:

        vps.js

    that looks like this:

        var fs          = require('fs')
          ;

        exports.options =
          { rendezvousHost : 'a.b.c.d'
          , rendezvousPort : 8899
        
          , keyData        : fs.readFileSync('./registrar.key')
          , crtData        : fs.readFileSync('./registrar.crt')
        
          , redisHost      : '127.0.0.1'
          , redisPort      : 6379
          , redisAuth      : ''
          };
    
3. Create a keypair for use by the rendezvous server:

        % node make-cert.js

        % chmod  a-w registrar.key registrar.crt

        % chmod go-r registrar.key

    to create a self-signed certificate:

        registrar.crt

    and the corresponding private key:

        registrar.key

4. We're nearly ready.
The next step is to create entries in the database for the hidden servers.
Running:

        % node users.js

    will bring up a server on:

        http://127.0.0.1:8893

    Browse this URL, and you will see all UUIDs defined in the database (initially, none).
To create an entry, use the form on the page.
Whenever an entry is created,
a JS file is created which you can use with your hidden server.
You will want to copy the JS file to the provisioning area for your hidden server.

5. When you are done creating entries for the remote servers, kill the node process running

        users.js

6. Copy the server files to the VPS:

        % rm -rf node_modules
        % cd .. ; scp -r node-rendezvous-master root@a.b.c.d:.

7. Login to the VPS and install [node.js](http://nodejs.org/download/), and then

        vps% cd node-rendezvous-master/
        vps% npm install -l
        vps% cp vps.js local.js

8. Finally, start the server:

        vps% bin/run.sh

    Log entries are written to the file:

        server.log
