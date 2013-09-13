
var showSettings = function() {
  var btn, chart, chkbox, div, div2, form, img, lbl, option, radio, select, settings, span, txtbox;

  div = document.createElement('div');
  div.setAttribute('id', 'settings');
  
  form = document.createElement('form');
  form.setAttribute('id', 'place-form');
  
  div2 = document.createElement('div');
  div2.setAttribute('class', 'form-heading');
  div2.innerHTML = "Steward Place Settings";
  form.appendChild(div2);
  
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

  btn = document.createElement('input');
  btn.setAttribute('type', 'button');
  btn.setAttribute('value', 'Save Place Settings');
  btn.setAttribute('onclick', 'javascript:savePlace(event)');
  form.appendChild(btn);

  div.appendChild(form);

  form = document.createElement('form');
  form.setAttribute('id', 'cloud-form');

  div2 = document.createElement('div');
  div2.setAttribute('class', 'form-heading');
  div2.innerHTML = "Cloud Services";
  form.appendChild(div2);

  select = document.createElement('select');
  select.setAttribute('id', 'bootableChoice');
  select = addBootables(select);
  form.appendChild(select);
  
  span = document.createElement('span')
  span.setAttribute('id', 'cloud-instructions');
  span.innerText = bootable[select.value].text;
  form.appendChild(span);
  
  var labelArray = labeledBoxes(select);
  form.appendChild(labelArray[0]);
  form.appendChild(labelArray[1]);
  
  btn = document.createElement('input');
  btn.setAttribute('type', 'button');
  btn.setAttribute('value', 'Add Cloud Service');
  btn.setAttribute('onclick', 'javascript:addCloud(event)');
  form.appendChild(btn);

  div.appendChild(form);
  
  img = document.createElement('img');
  img.setAttribute('src', 'popovers/assets/done_on.svg');
  img.setAttribute('style', 'position:absolute; top: 30px; left: 600px; cursor: pointer');
  img.setAttribute('onclick', 'javascript:closeSettings(event)');
  div.appendChild(img);
  document.body.appendChild(div);
  
  
  document.getElementById("stewardName").addEventListener('change', function(evt) {place_info.name = evt.target.value});
  document.getElementById("physical").addEventListener('change', function(evt) {place_info.physical = evt.target.value});
  document.getElementById("latitude").addEventListener('change', function(evt) {place_info.location[0] = evt.target.value});
  document.getElementById("longitude").addEventListener('change', function(evt) {place_info.location[1] = evt.target.value});
  document.getElementById("bootableChoice").addEventListener('change', pickBootable);
  document.getElementById("bootChoice0").addEventListener('change', stowInfo);
  document.getElementById("bootChoice1").addEventListener('change', stowInfo);

  fillPlaceFields();
  
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
    var optgroup, option
    var keys = getKeys(bootable);
    
    optgroup = document.createElement('optgroup');
    optgroup.setAttribute('label', 'Choose a Service');
    select.appendChild(optgroup);

    for (var i = 0; i < keys.length; i++) {
      option = document.createElement('option');
      option.setAttribute('value', keys[i]);
      option.innerHTML = keys[i];
      optgroup.appendChild(option);
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

var closeSettings = function(evt) {
  if (document.getElementById("settings")) document.body.removeChild(document.getElementById("settings"));
//  ws.close();
  stack = [];
  setTimeout(main, 500);
}

var pickBootable = function(evt) {
  var choice = evt.target.value;
  var info = bootable[choice].info;
  var keys = Object.keys(info);
  document.getElementById("cloud-instructions").innerText = bootable[choice].text;
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


var fillPlaceFields = function() {
  var entry, keys;
  document.getElementById("stewardName").value = place.name || "";
  document.getElementById("physical").value = place.info.physical || "";
  if (place_info.location) {
	  document.getElementById("latitude").value = place.info.location[0] || "";
	  document.getElementById("longitude").value = place.info.location[1] || "";
  }
  
}

var savePlace = function(evt) {
  var val = JSON.stringify({ path    : '/api/v1/actor/perform/place'
                         , requestID : "3"
                         , perform   : "set"
                         , parameter : JSON.stringify(place_info) || ''
                         });
  wsSend(val);
}

var addCloud = function(evt) {
  var val, emptyP = false, entry;
  var name = document.getElementById("bootableChoice").value;
  var info = bootable[name].info;

  entry = bootable[name];
  for (prop in info) if ((info.hasOwnProperty(prop)) && (info[prop] === '')) emptyP = true;
  if (!emptyP) {
    val = JSON.stringify({ path      : '/api/v1/device/create/' + name
                         , requestID : "3"
                         , name      : name
                         , whatami   : entry.actor
                         , info      : info || {}
                         });
//    console.log("Sending: " + val);
    wsSend(val);
    alert(name + " cloud service added to the steward.")
    document.getElementById("bootChoice0").value = "";
    document.getElementById("bootChoice1").value = "";
  }

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

