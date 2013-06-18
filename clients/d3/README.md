status board
============

__NOTE WELL: this is an early implementation code. it will be heavily modified prior to alpha launch.__

Clients interact with the steward using a websockets-based API.

The initial browser-based UI uses the d3 visualization package. 

Ideally, the browser-based UI would talk directly to the steward.
However, the security framework isn't implemented yet.

So, this implementation, intead of talking directly to the steward gets its files from a public Dropbox folder.
This folder not only has HTML and JavaScript files,
but also has JSON files that are created by the steward.
The contents of these files are identical to what the correponsping websockets-based API calls produce.

From the steward's perspective,
it is simply putting files in a directory that you tell it to.

This allows pre-alpha clients to monitor the steward remotely without any proxy.

When the security framework is implemented,
the HTML files will be served directly from the steward via a proxy and will support both monitoring and control functions.

One other thing:
although this is a browser-based client,
it is designed with the iPad _status board_ app in mind.
This app is a tiled web-browser showing multiple panels simultaneously.
Of course,
the app will run fine in a regular browser.
