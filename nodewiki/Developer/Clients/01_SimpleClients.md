#Client Applications

Building a simple client is easy.

##Controlling a single device

* Get the deviceID of the device you want. You can do an actor list to get everything, 

      "/device/lighting/hue/led":
        {"device/18":
            {"name":"Home Office",
             "status":"on",
             "info":
                {"color":
                    {"model":"cie1931",
                     "cie1931":
                        {"x":0.3362,
                         "y":0.3604}},
                 "brightness":100},
             "updated":null},
         "device/19":
            {"name":"Desk Lamp",
             "status":"on",
             "info":
                {"color":
                    {"model":"cie1931",
                     "cie1931":
                        {"x":0.3363,
                         "y":0.3604}},
                 "brightness":100},
             "updated":null},
         "device/20":
            {"name":"Sitting Room",
             "status":"on",
             "info":
                {"color":
                    {"model":"cie1931",
                     "cie1931":
                        {"x":0.3362,
                         "y":0.3604}},
                 "brightness":100},
             "updated":null}},

if you wanted to manage the "Desk Lamp", the deviceID is '19'

* use 

      /api/v1/device/foo/deviceID

where _foo_ is 'list' or 'perform' or 'delete'

##Example Clients

Lets start off and build some simple example client applications.

###Javascript


###Perl


###iOS


##Implementing Magic

Magic clients applications are typically server side


##node.js

The steward itself is implemented in Javascript as a node.js application. If you intend your magic to 


##Other

So long as your language of choice
