/*
*/

var ws2; // For gettings/setting configuration info only

var loginpg = function(state) {
  var btn, chart, chkbox, div, div2, form, img, lbl, radio, span, txtbox, steward, storage;
  
  storage = JSON.parse(getStorage("steward.location"));
  
  var steward = { hostname : window.location.hostname
                 , port     : window.location.port
                 , protocol : (window.location.protocol.indexOf('https:') === 0) ? 'wss:' : 'ws:'
                 , search   : '%%UUID%%'
                 };

  chart = document.getElementById('chart');
  while (chart.lastChild) chart.removeChild(chart.lastChild);
  chart.style.backgroundImage = '';


  div = document.createElement('div');
  div.setAttribute('class', 'logo');
  img = document.createElement('img');
  img.setAttribute('src', 'images/thing.sys.logo.black.svg');
  div.appendChild(img);
  chart.appendChild(div);
  
  div = document.createElement('div');
  div.setAttribute('class', 'status');
  div.setAttribute('id', 'connectStatus');
  div.innerHTML = (ws && ws.readyState === 1) ? "Connected" :"Not Connected";
  chart.appendChild(div);
  
  div = document.createElement('div');
  div.setAttribute('id', 'login');
  
  div2 = document.createElement('div');
  div2.setAttribute('class', 'big-instructions');
  div2.innerHTML = "Sign In";
  div.appendChild(div2);
  
  form = document.createElement('form');
  form.setAttribute('id', 'login-form');
  
  radio = document.createElement('input');
  radio.setAttribute('type', 'radio');
  radio.setAttribute('name', 'log-type');
  radio.setAttribute('id', 'local');
  radio.checked = ((storage != null) ? (storage.lastlogin === 'local') : true);
  radio.setAttribute('onclick', 'javascript:setLoginTxtBoxes(event)');
  form.appendChild(radio);  
  lbl = document.createElement('label');
  lbl.setAttribute('for', 'local');
  lbl.innerHTML = 'Local';
  form.appendChild(lbl);

  radio = document.createElement('input');
  radio.setAttribute('type', 'radio');
  radio.setAttribute('name', 'log-type');
  radio.setAttribute('id', 'remote');
  radio.checked = ((storage != null) ? (storage.lastlogin === 'remote') : false);
  radio.setAttribute('onclick', 'javascript:setLoginTxtBoxes(event)');
  form.appendChild(radio);
  lbl = document.createElement('label');
  lbl.setAttribute('for', 'remote');
  lbl.innerHTML = 'Remote';
  form.appendChild(lbl);
  
  chkbox = document.createElement('input');
  chkbox.setAttribute('type', 'checkbox');
  chkbox.setAttribute('name', 'secure');
  chkbox.setAttribute('id', 'secure');
  chkbox.setAttribute('onclick', 'javascript:setProtocol(event)');
  chkbox.checked = ((storage != null) ? (storage.protocol === 'wss:') : (steward.protocol === 'wss:'));
  form.appendChild(chkbox);  
  lbl = document.createElement('label');
  lbl.innerHTML = 'Secure Connection';
  lbl.setAttribute('for', 'secure');
  form.appendChild(lbl);
  
  lbl = document.createElement('label');
  lbl.setAttribute('for', 'url');
  lbl.setAttribute('id', 'urlbox');
  lbl.setAttribute('style', ((storage != null) ? ((storage.lastlogin === "local") ? "display: block" : "display: none") : 'display: block'));
  lbl.innerHTML = 'Hostname or IP Address:&nbsp;&nbsp;';

  txtbox = document.createElement('input');
  txtbox.setAttribute('type', 'text');
  txtbox.setAttribute('id', 'localURL');
  txtbox.setAttribute('size', '40');
  txtbox.setAttribute('value', (storage != null) ? storage.hostname : steward.hostname);
  lbl.appendChild(txtbox);
  form.appendChild(lbl);

  
  lbl = document.createElement('label');
  lbl.setAttribute('for', 'uuid');
  lbl.setAttribute('id', 'uuidbox');
  lbl.setAttribute('style', ((storage != null) ? ((storage.lastlogin === "remote") ? "display: block" : "display: none") : 'display: none'));
  lbl.setAttribute('disabled', 'true');
  lbl.innerHTML = 'UUID:&nbsp;&nbsp;';

  txtbox = document.createElement('input');
  txtbox.setAttribute('type', 'text');
  txtbox.setAttribute('size', '40');
  txtbox.setAttribute('id', 'uuid');
  txtbox.setAttribute('value', (storage != null) ? storage.search : '');
  lbl.appendChild(txtbox);
  

  form.appendChild(lbl);

  btn = document.createElement('input');
  btn.setAttribute('id', 'toConnect');
  btn.setAttribute('type', 'button');
  btn.setAttribute('onclick', 'javascript:signIn()');
  btn.setAttribute('value', 'Connect');
  form.appendChild(btn);

  btn = document.createElement('input');
  btn.setAttribute('id', 'signout');
  btn.setAttribute('type', 'button');
  btn.setAttribute('onclick', 'javascript:signOut()');
  btn.setAttribute('value', 'Sign Out');
  btn.setAttribute('disabled', 'true');
  form.appendChild(btn);

  btn = document.createElement('input');
  btn.setAttribute('id', 'toHome');
  btn.setAttribute('type', 'button');
  btn.setAttribute('onclick', 'javascript:goHome()');
  btn.setAttribute('value', 'Home');
  btn.setAttribute('disabled', 'true');
  form.appendChild(btn);

  btn = document.createElement('input');
  btn.setAttribute('id', 'toConfig');
  btn.setAttribute('type', 'button');
  btn.setAttribute('onclick', 'javascript:goConfig()');
  btn.setAttribute('value', 'Configure');
  btn.setAttribute('disabled', 'true');
  form.appendChild(btn);

  div.appendChild(form);
  chart.appendChild(div);
  
//   if (ws && ws.readyState === 1) {
//     activateBtns();
// //     document.getElementById("toConnect").disabled = true;
// //     document.getElementById("signout").disabled = false;
// //     document.getElementById("toHome").disabled = false;
// //     document.getElementById("toConfig").disabled = false;
//   }
}

var configpg = function() {
  var btn, chart, chkbox, div, div2, form, img, lbl, option, radio, select, span, txtbox;

  chart = document.getElementById('chart');
  while (chart.lastChild) chart.removeChild(chart.lastChild);
  chart.style.backgroundImage = '';


  div = document.createElement('div');
  div.setAttribute('class', 'logo');
  img = document.createElement('img');
  img.setAttribute('src', 'images/thing.sys.logo.black.svg');
  div.appendChild(img);
  chart.appendChild(div);
  
  div = document.createElement('div');
  div.setAttribute('class', 'status');
  div.setAttribute('id', 'connectStatus');
  div.innerHTML = (ws && ws.readyState === 1) ? "Connected" :"Not Connected";
  chart.appendChild(div);
  
  div = document.createElement('div');
  div.setAttribute('id', 'config');
  
  div2 = document.createElement('div');
  div2.setAttribute('class', 'big-instructions');
  div2.innerHTML = "Configure Steward";
  div.appendChild(div2);
  
  form = document.createElement('form');
  form.setAttribute('id', 'config-form');

  form.appendChild(labeledBox('Steward Name', 'stewardName', 50, ''));
  form.appendChild(labeledBox('Street Address', 'physical', 70, ''));
  div2 = document.createElement('div');
  div2.setAttribute('class', 'big-instructions');
  div2.innerHTML = "Coordinates";
  btn = document.createElement('input');
  btn.setAttribute('type', 'button');
  btn.setAttribute('value', 'Use Browser Geolocation');
  btn.setAttribute('onclick', 'javascript:geolocate()');
  div2.appendChild(btn);
  btn = document.createElement('input');
  btn.setAttribute('type', 'button');
  btn.setAttribute('value', 'Use Geocoding from Street Address');
  btn.setAttribute('onclick', 'javascript:geocode()');
  div2.appendChild(btn);
  form.appendChild(div2);
  form.appendChild(labeledBox('Latitude', 'latitude', 20, ''));
  form.appendChild(labeledBox('Longitude', 'longitude', 20, ''));

  div2 = document.createElement('div');
  div2.setAttribute('class', 'big-instructions');
  div2.innerHTML = "Networked Products & Services";
  form.appendChild(div2);

  select = document.createElement('select');
  select.setAttribute('id', 'bootableChoice');
  select = addBootables(select);
  form.appendChild(select);
  
  var labelArray = labeledBoxes(select);
  form.appendChild(labelArray[0]);
  form.appendChild(labelArray[1]);
  
  btn = document.createElement('input');
  btn.setAttribute('type', 'button');
  btn.setAttribute('id', 'cancelConf');
  btn.setAttribute('value', 'Cancel');
  btn.setAttribute('onclick', 'javascript:cancelConfig(event)');
  form.appendChild(btn);
  btn = document.createElement('input');
  btn.setAttribute('type', 'button');
  btn.setAttribute('value', 'Save');
  btn.setAttribute('onclick', 'javascript:saveConfig(event)');
  form.appendChild(btn);

  div.appendChild(form);
  chart.appendChild(div);
  
  document.getElementById("stewardName").addEventListener('change', function(evt) {place_info.name = evt.target.value});
  document.getElementById("physical").addEventListener('change', function(evt) {place_info.physical = evt.target.value});
  document.getElementById("latitude").addEventListener('change', function(evt) {place_info.location[0] = evt.target.value});
  document.getElementById("longitude").addEventListener('change', function(evt) {place_info.location[1] = evt.target.value});
  document.getElementById("bootableChoice").addEventListener('change', pickBootable);
  document.getElementById("bootChoice0").addEventListener('change', stowInfo);
  document.getElementById("bootChoice1").addEventListener('change', stowInfo);

  
  connectConfig();
  
  // Create label & text input elements
  function labeledBox(lblTxt, boxID, size, val, pwd) {
	  lbl = document.createElement('label');
	  lbl.setAttribute('for', boxID);
	  lbl.setAttribute('style', 'display: block; text-transform: capitalize');
	  span = document.createElement('span');
	  span.innerHTML = lblTxt + ':&nbsp;&nbsp;';
	  lbl.appendChild(span);
	
	  txtbox = document.createElement('input');
	  txtbox.setAttribute('type', (pwd) ? 'password' : 'text');
	  txtbox.setAttribute('id', boxID);
	  txtbox.setAttribute('size', size);
	  txtbox.setAttribute('value', val);
	  lbl.appendChild(txtbox);
	  
	  return lbl;
  }
  
  // Create pair of label & text input elements for networked products
  function labeledBoxes(select) {
    var choice = select.value;
    var keys = getKeys(bootable[choice].info);
    var labels = [];
    labels[0] = labeledBox(keys[0], 'bootChoice0', 20, bootable[choice].info[keys[0]]);
    labels[1] = labeledBox(keys[1], 'bootChoice1', 20, bootable[choice].info[keys[1]], true);
    return labels;
  }
  
  // Populate select element with networked product names
  function addBootables(select) {
    var keys = getKeys(bootable);

    for (var i = 0; i < keys.length; i++) {
      option = document.createElement('option');
      option.setAttribute('value', keys[i]);
      option.innerHTML = keys[i];
      select.appendChild(option);
    }
    return select;
  }
  
  // Retrieve object keys for use as labels & select values
  function getKeys(obj) {
    var keys = [];
    for(var k in obj) keys.push(k);
    return keys;
  }
  
}

var setProtocol = function(evt) {
  var proto = (evt.target.checked) ? "wss://" : "ws://";
  d3.select("#protoTxt").text(proto);
}

var setLoginTxtBoxes = function(evt) {
  var where = evt.target.id;
  if (where == "local") {
    document.getElementById("urlbox").style.display = "block";
    document.getElementById("uuidbox").style.display = "none";
  } else {
    document.getElementById("urlbox").style.display = "none";
    document.getElementById("uuidbox").style.display = "block";
  }

}

var pickBootable = function(evt) {
  var choice = evt.target.value;
  var info = bootable[choice].info;
  var keys = Object.keys(info);
  document.getElementById("bootChoice0").labels[0].firstChild.innerHTML = keys[0] + ":&nbsp;&nbsp;";
  document.getElementById("bootChoice0").value = info[keys[0]];
  if (keys[1]) {
    document.getElementById("bootChoice1").labels[0].firstChild.innerHTML = keys[1] + ":&nbsp;&nbsp;";
    document.getElementById("bootChoice1").value = info[keys[1]];
    document.getElementById("bootChoice1").labels[0].style.visibility = "visible";
  } else {
    document.getElementById("bootChoice1").labels[0].style.visibility = "hidden";
  }
}

var stowInfo = function(evt) {
  var choice = document.getElementById("bootableChoice").value;
  var info = bootable[choice].info;
  var keys = Object.keys(info);
  for (var i = 0; i < keys.length; i++) {
    bootable[choice].info[keys[i]] = document.getElementById("bootChoice" + i).value;
  }
}

// Local Storage functions
var hasLocalStorage = function() {
  try {
    return "localStorage" in window && (window["localStorage"] !== null);
  } catch(e) {
    return false;
  }
}

var setStorage = function(name, value) {
  return (hasLocalStorage) ? localStorage.setItem(name, value) : null;
}

var getStorage = function(name) {
  return (hasLocalStorage) ? localStorage.getItem(name) : null;
}

var setConnStatus = function(txt) {
  if (document.getElementById('connectStatus')) {
  	document.getElementById('connectStatus').innerHTML = txt;
  } else {
//  	alert(txt);
  }
}

var activateBtns = function() {
  if (document.getElementById("login")) {
    document.getElementById("toConnect").disabled = true;
    document.getElementById("signout").disabled = false;
    document.getElementById("toHome").disabled = false;
    document.getElementById("toConfig").disabled = false;
  }
}

var deactivateBtns = function() {
  if (document.getElementById("login")) {
    document.getElementById("toConnect").disabled = false;
    document.getElementById("signout").disabled = true;
    document.getElementById("toHome").disabled = true;
    document.getElementById("toConfig").disabled = true;
  }
}

var goLogin = function() {
  stack.pop();
  var state = { page: loginpg };
  (state.page)(state);
}

var signIn = function() {
  var steward, type;
  setConnStatus("Connecting...");
  type = (document.getElementById("local").checked) ? "local" : "remote";
  
  if (hasLocalStorage) {
    steward = {"hostname"   : document.getElementById("localURL").value,
               "port"       : getPort(),
               "protocol"   : (document.getElementById("secure").checked) ? "wss:" : "ws:",
               "search"     : document.getElementById("uuid").value,
               "remoteHost" : "199.223.216.16",
               "lastlogin"  : type};
      
    setStorage("steward.location", JSON.stringify(steward));
  }

  connectSteward(type);
  
  function getPort() {
  	if (type === "local") {
  		return (document.getElementById("secure").checked) ? "8888" : "8887";
  	} else {
  		return (document.getElementById("secure").checked) ? "8899" : "8888";
  	}
  }
}

var signOut = function() {
  ws.close();
//  deactivateBtns();
}

var goHome = function() {
  firstRefresh();
}

var goConfig = function() {
  var state = { page: configpg };
  (state.page)(state);
}

function geolocate() {
  navigator.geolocation.getCurrentPosition(
	function(pos) {
	  place_info.location = [ pos.coords.latitude, pos.coords.longitude ];
	  document.getElementById("latitude").value  = pos.coords.latitude;
	  document.getElementById("longitude").value = pos.coords.longitude;
	},
	function(err) {
	  switch (err.code) {
		case 1:
		  alert("Permission denied by user.");
		  break;
		case 2:
		  alert("Position unavailable.");
		  break;
		case 3:
		  alert("Service timed out.");
		  break;
		default:
		  alert("Position error:" + err.message);
	  }
	},
	{'enableHighAccuracy': false, 'timeout': 10000, 'maximumAge': 0});

}

function geocode() {
  var physical = document.getElementById("physical");
  if (physical.value.length > 0) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
		var message, state;
	
		try {
		  if (this.readyState === 4) {
			message = JSON.parse(this.responseText);
			if (!message) throw new Error('invalid JSON: ' + this.responseText);
			if (message.status === 'OK') {
			  message = message.results[0];
			  physical.value = message.formatted_address;
			  place_info.physical = message.formatted_address;
			  place_info.location = [ message.geometry.location.lat, message.geometry.location.lng ];
			  document.getElementById("latitude").value  = message.geometry.location.lat;
			  document.getElementById("longitude").value = message.geometry.location.lng;
			  
			} else {
			  alert('Sorry, the address cannot be converted to coordinates.');
			}
		  }
		} catch(ex) { console.log(ex); }
	  }.bind(req);
	  var url = 'http://maps.googleapis.com/maps/api/geocode/json?address=' + physical.value.replace(/\s/g, "+") 
		   + '&sensor=false'
	  req.open('GET', url , true);
	  req.send(null);
  } else {
    alert("Please enter a street address.");
  }
}

// // Websocket connection for configuration
var connectConfig = function() {
  var prev, steward, storage, type;
  
  storage = JSON.parse(getStorage("steward.location"));
  
  if (!storage) return;

  type = storage.lastlogin;
  if (type === "local") {
	steward = storage.protocol + "//" + storage.hostname + ":" + storage.port + "/manage";
  } else {
	steward = storage.protocol + "//" + storage.remoteHost + ":" + storage.port + 
	  "/manage?rendezvous=" + storage.search;
  }
  
  ws2 = new WebSocket(steward);
  
  ws2.onopen = function(evt) {
       ws2.send(JSON.stringify({ path: '/api/v1/actor/list/', requestID: 1, options: { depth: 'all' }}));  
  }
  
  ws2.onmessage = function(evt) {
    var message;
    
    try {
      message = JSON.parse(evt.data);
      requestID = message.requestID.toString();
      switch (requestID) {
        case '1': onactors(message);	 break;
        case '2': onplace(message);      break;
        case '3': ondevices(message);    break;
        default: console.log(message);	 break;
      }
      
    } catch(e) {
      console.log(e.message);
    }
  }
  
  ws2.onclose = function(evt) {
    ws2.close();
    ws2 = null;
  }
  
  ws2.onerror = function(evt) {
    console.log("WebSocket Error: " + evt.reason);
    setConnStatus("Connection Closed");
  }
}

var onactors = function(message) {
  var actor, actors, entry, info;
  actors = message.result;
  
  actor = actors["/place"]["place/1"];
  place_info.name = actor.name;
  place_info.physical = actor.info.physical;
  if (actor.info.location) place_info.location = actor.info.location;
  
  for (name in bootable) {
    if (!bootable.hasOwnProperty(name)) continue;
    
    entry = bootable[name];
    actor = entry.actor;
    if (actors[actor]) {
      info = actors[actor][Object.keys(actors[actor])].info;
      entry.info = info;
    }
  }
  
  fillConfigFields();
}

var onplace = function(message) {
    console.log("Updating place/1: " + message.actors["place/1"].status);
    goLogin();
}

var ondevices = function(message) {
    console.log("Device saved");
    goLogin();
}

var fillConfigFields = function() {
  var entry, keys;
  document.getElementById("stewardName").value = place_info.name || "";
  document.getElementById("physical").value = place_info.physical || "";
  if (place_info.location) {
	  document.getElementById("latitude").value = place_info.location[0] || "";
	  document.getElementById("longitude").value = place_info.location[1] || "";
  }
  
  entry = bootable[document.getElementById("bootableChoice").value];
  keys = Object.keys(entry.info);
  for (var i = 0; i < keys.length; i++) {
    document.getElementById("bootChoice" + i).value = entry.info[keys[i]];
  }
}

var cancelConfig = function(evt) {
	goLogin();
}

var saveConfig = function(evt) {
  var emptyP, entry, info, val;
  
  document.getElementById("cancelConf").disabled = true;
  evt.target.value = "Saving...";
  
  // place
  val = JSON.stringify({ path    : '/api/v1/actor/perform/place'
                         , requestID : "2"
                         , perform   : "set"
                         , parameter : JSON.stringify(place_info) || ''
                         });
  console.log("Sending: " + val);
  ws2.send(val);

  // devices
  for (name in bootable) {
    if (!bootable.hasOwnProperty(name)) continue;
    
    entry = bootable[name];
    info = entry.info;
    emptyP = false;
    for (prop in info) if ((info.hasOwnProperty(prop)) && (info[prop] === '')) emptyP = true;
    if (!emptyP) {
      val = JSON.stringify({ path      : '/api/v1/device/create/' + name
                         , requestID : "3"
                         , name      : name
                         , whatami   : entry.actor
                         , info      : info || {}
                         });
      console.log("Sending: " + val);
      ws2.send(val);
    }
    
  }
}

var place_info   = { name        : 'Home'
                   , physical    : ''
                   , location : [ 39.50000, -98.35000 ]
                   };

var bootable = { prowl          :
                 { text         : 'If you have a Prowl account, the steward can automatically update you with alerts, etc.'
                 , instructions : 'Generate an API key.'
                 , site         : 'https://prowlapp.com/login.php'
                 , icon         : ''
                 , name         : 'prowler'
                 , actor        : '/device/indicator/text/prowl'
                 , info         :
                   { name       : 'prowler'
                   , apikey     : ''
                   }
                 }
               , netatmo        :
                 { text         : 'If you have a Netatmo weather station, the steward can manage it for you.'
                 , instructions : 'Enter your email and password.'
                 , site         : 'https://my.netatmo.com'
                 , icon         : ''
                 , name         : 'netatmo'
                 , actor        :'/device/gateway/netatmo/cloud'
                 , info         :
                   { email      : ''
                   , passphrase : ''
                   }
                 }
               , nest           :
                 { text         : 'If you have a Nest thermostat, the steward can manage it for you.'
                 , instructions : 'Enter your email address and password.'
                 , site         : 'https://home.nest.com'
                 , icon         : ''
                 , name         : 'nest'
                 , actor        : '/device/gateway/nest/cloud'
                 , info         :
                   { email      : ''
                   , passphrase : ''
                   }
                 }
               , tesla          :
                 { text         : 'If you have a Tesla Model S, the steward can monitor it for you.'
                 , instructions : 'Enter your email address and password.'
                 , site         : 'https://teslamotors.com/mytesla'
                 , icon         : ''
                 , name         : 'tesla'
                 , actor        : '/device/gateway/tesla/cloud'
                 , info         :
                   { email      : ''
                   , passphrase : ''
                   }
                 }
               , xively         :
                 { text         : 'If you have an Xively (nee cosm) account, the steward can automatically upload measurements.'
                 , instructions : 'Create a "device" and xively will automatically generate a device key (apikey) and feed'
                 , site         : 'https://xively.com/login'
                 , icon         : ''
                 , name         : 'xively'
                 , actor        : '/device/indicator/text/xively'
                 , info         :
                   { apikey     : ''
                   , feed       : ''
                   }
                 }
               };

