/*
*/

var login = function(state) {
  var btn, chart, div, div2, form, img, lbl, radio, chkbox, span, txtbox, storage;
  
  storage = JSON.parse(getStorage("steward.location"));
  
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
  div.innerHTML = "Not Connected";
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
  radio.setAttribute('checked', 'true');
  radio.setAttribute('onclick', 'javascript:setTxtBoxes(event)');
  form.appendChild(radio);  
  lbl = document.createElement('label');
  lbl.setAttribute('for', 'local');
  lbl.innerHTML = 'Local';
  form.appendChild(lbl);

  radio = document.createElement('input');
  radio.setAttribute('type', 'radio');
  radio.setAttribute('name', 'log-type');
  radio.setAttribute('id', 'remote');
  radio.setAttribute('onclick', 'javascript:setTxtBoxes(event)');
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
  chkbox.setAttribute('checked', 'true');
  form.appendChild(chkbox);  
  lbl = document.createElement('label');
  lbl.innerHTML = 'Secure Connection';
  lbl.setAttribute('for', 'secure');
  form.appendChild(lbl);
  
  lbl = document.createElement('label');
  lbl.setAttribute('for', 'url');
  lbl.setAttribute('id', 'urlbox');
  lbl.setAttribute('style', 'display: block');
  lbl.innerHTML = 'URL:&nbsp;&nbsp;';
  span = document.createElement('span');
  span.setAttribute('id', 'protoTxt');
  span.innerHTML = "wss://";
  lbl.appendChild(span);
  txtbox = document.createElement('input');
  txtbox.setAttribute('type', 'text');
  txtbox.setAttribute('id', 'localURL');
  txtbox.setAttribute('size', '40');
  txtbox.setAttribute('value', (storage != null) ? storage['hostname'] : '127.0.0.1');
  lbl.appendChild(txtbox);
  form.appendChild(lbl);

  
  lbl = document.createElement('label');
  lbl.setAttribute('for', 'uuid');
  lbl.setAttribute('id', 'uuidbox');
  lbl.setAttribute('style', 'display: none');
  lbl.setAttribute('disabled', 'true');
  lbl.innerHTML = 'UUID:&nbsp;&nbsp;';

  txtbox = document.createElement('input');
  txtbox.setAttribute('type', 'text');
  txtbox.setAttribute('size', '40');
  txtbox.setAttribute('id', 'uuid');
  txtbox.setAttribute('value', (storage != null) ? storage['search'] : '');
  lbl.appendChild(txtbox);
  

  form.appendChild(lbl);

  btn = document.createElement('input');
  btn.setAttribute('type', 'button');
  btn.setAttribute('onclick', 'javascript:signIn()');
  btn.setAttribute('value', 'Connect');
  form.appendChild(btn);

  div.appendChild(form);
  chart.appendChild(div);
  
}

var setProtocol = function(evt) {
  var proto = (evt.target.checked) ? "wss://" : "ws://";
  d3.select("#protoTxt").text(proto);
}

var setTxtBoxes = function(evt) {
  var where = evt.target.id;
  if (where == "local") {
    document.getElementById("urlbox").style.display = "block";
    document.getElementById("uuidbox").style.display = "none";
  } else {
    document.getElementById("urlbox").style.display = "none";
    document.getElementById("uuidbox").style.display = "block";
  }

}

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

var signIn = function() {
  var steward, type;
  setConnStatus("Connecting...");
  type = (document.getElementById("local").checked) ? "local" : "remote";
  
  if (hasLocalStorage) {
    steward = {"hostname"   : document.getElementById("localURL").value,
               "port"       : getPort(),
               "protocol"   : (document.getElementById("secure").checked) ? "wss:" : "ws:",
               "search"     : document.getElementById("uuid").value,
               "remoteHost" : "199.223.216.16"};
      
    setStorage("steward.location", JSON.stringify(steward));
  }

  ringSteward(type);
  
  function getPort() {
  	if (type === "local") {
  		return (document.getElementById("secure").checked) ? "8888" : "8887";
  	} else {
  		return (document.getElementById("secure").checked) ? "8899" : "8888";
  	}
  }
}