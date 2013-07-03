#Setting Up the Rendezvous Server

1. Get a tarball of the [repository](https://github.com/mrose17/node-rendezvous/archive/master.zip) onto your local system, extract it, 'cd' there and then:

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
