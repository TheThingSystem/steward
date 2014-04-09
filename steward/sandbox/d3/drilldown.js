var actors           = {}
  , place
  , names            = {}
  , tags             = {}
  , containers       = {}
  , multiple_arcs    = []
  , lastUpdated      = []
  , lastIconTrayPage = 1
  , lastStageScroll  = 0
  , firstLoad        = true
  , alertQueue       = []
  , permissions;

// alert user to something important
var notify = function(msg, next) {
  var alertElem, alertTxt = '', q;
  
  if (!next && document.getElementById('notification')) {
    if (msg === d3.select('#notification').text().substring(1) || alertQueue.indexOf(msg) >= 0) return;
    alertQueue.push(msg);
    return;
  }

  if (next) d3.select('#notification').remove();
  alertElem = d3.select('body')
    .append('div')
    .attr('id', 'notification')
    .attr('class', 'notification');
  alertElem.append('div')
    .attr('class', 'notification-ok')
    .text('x')
    .on('click', function () {
      d3.select('#notification').transition()
      .duration(800)
      .each('end', function() {
        if (alertQueue.length > 0) {
          alertTxt = alertQueue.shift();
          notify(alertTxt, true);
        }
      })
      .style('top', function() { return '-' + d3.select('#notification').style('height') }).remove(); });
  alertElem.append('span')
    .attr('id', 'notification-text')
    .attr('class', 'notification-text')
    .text(msg);
  alertElem.transition()
    .duration(800)
  	.style('top', '0px');
}

var priorityNotify = function(msg) {
  var currMsg, hasNext = false;
  if (document.getElementById('notification')) {
    currMsg = d3.select('#notification').text().substring(1)
    if (msg === currMsg || alertQueue.indexOf(msg) >= 0) return;
    alertQueue.unshift(currMsg);
    hasNext = true;
  }
  notify(msg, hasNext);
}

var resetNotifications = function() {
  if (document.getElementById('notification')) {
    d3.select('#notification').transition()
      .duration(400)
      .style('top', function() { return '-' + d3.select('#notification').style('height') }).remove();
    alertQueue = [];
  }
}

var home = function(state) {
  var a, actor, b, categories, category, chart, device, devices, div, entry, i, img, message, nothing, p, prop, span, stage, tag;
  var actorHeight = 80, actorRow = 0, actorWidth = 58;
  
  var self = this;
  
  lastIconTrayPage = 1;

  chart = document.getElementById('chart');
  while (chart.lastChild) chart.removeChild(chart.lastChild);
  chart.style.backgroundImage = '';

  message = state.message;
  place = thePlace(message);
  devices = mostDevices(message);
  names = allNames(message);
  tags = allTags(message);
  categories = allCategories(message);
  containers = allContainers(message);
  
  img = document.createElement('img');
  img.setAttribute('id', 'to-config');
  img.setAttribute('src', 'popovers/assets/gear.svg');
  img.setAttribute('title', 'To configuration screen...');
  img.setAttribute('onclick', 'javascript:showSettings()');
  chart.appendChild(img);

if (true) {
  img = document.createElement('img');
  img.setAttribute('id', 'to-voice');
  img.setAttribute('src', 'popovers/assets/microphone.svg');
  img.setAttribute('title', 'To voice control settings...');
  img.setAttribute('onclick', 'javascript:showVoiceSettings()');
  chart.appendChild(img);
}
  
  chart = document.getElementById('chart');

  div = document.createElement('div');
  div.setAttribute('id', 'logo');
  div.setAttribute('class', 'logo');
  img = document.createElement('img');
  img.setAttribute('src', 'images/thing.sys.logo.black.svg');
  div.appendChild(img);
  chart.appendChild(div);

  div = document.createElement('div');
  div.setAttribute('class', 'status');
  div.innerHTML = 'Retrieving list of everything.';
  div.innerHTML = 'Touch a thing for more info.';
  chart.appendChild(div);
  
  lastUpdated = place.updated;
  
  span = (place.info.conditions) ? 
          ('<span style="background-color: #fff; position: absolute; left: 0px; top: -7px; width: 26px;">'
          + '<img id="wxicon" src="' + weather_icon(place.info.conditions.code, place.info.solar) + '" style="height: 26px;" /></span>') : '';

  div = document.createElement('div');
  div.setAttribute('id', 'controls-home');
  div.setAttribute('style', 'margin-top: 70px;');
  div.innerHTML = '<div class="big-instructions" style="padding-top: 0px;">We are ready.<br />'
                  + '<span style="color: #666;">Please send instructions.</span></div>'
                  + '<div class="small-instructions">'
                  + span
                  + '<span id="sName" style="color:' + place.status + ';">' + place.name + '</span>'
                  + ' — updated <span id="timeagoStamp">' + d3.timestamp.ago(lastUpdated,true) + '</span></div>';
  chart.appendChild(div);
  if (place.info.conditions) document.getElementById("wxicon").setAttribute('onclick', 'javascript:goforw(weather_drilldown, "weather")');
  
  if (place.info.review.length > 0) {
    span = document.getElementById("sName");
    span.style.textDecoration = "underline";
    span.style.cursor = "pointer";
    span.setAttribute('onclick', 'javascript:goforw(review_drilldown, "place/1")');
  }

  div = document.createElement('div');
  div.setAttribute('class', 'actors');
  div.setAttribute('id', 'stage');
  div.setAttribute('onscroll', 'javascript:lastStageScroll = this.scrollTop;');

  if (!devices.length) {
    // Didn't find any things
    nothing = document.createElement('div');
    nothing.setAttribute('id', 'no-devices-placeholder');
    nothing.innerHTML = '<h1>Did not discover any devices.</h1>'
                        + '<p>If you were expecting something else, view the '
                        + '<a href="/console.html">steward console</a> for details.';
    div.appendChild(nothing);
  }
  for (a = i = 0; i < devices.length; i++) {
    device = devices[i];
    entry = entries[device.deviceType] || entries.default(device.deviceType);
    if ((!entry) || (!entry.img)) continue;

    actor = document.createElement('div');
    actor.setAttribute('class', 'actor-home');
    actor.setAttribute('style', 'top:' + (actorRow * actorHeight) + 'px; left:' + (actorWidth * (a % 12)) + 'px;');
    actor.innerHTML = '<p class="actor-name" id="' + actor2ID(device.actor) + '-label" style="color: ' + statusColor(device) + '">' + device.name + '</p>';
    img = document.createElement('img');
    img.setAttribute('src', entry.img);
    img.setAttribute('id', actor2ID(device.actor));
    img.setAttribute('style', 'background-color:' + statusColor(device));
    if (!!containers[device.actor]) {
      img.setAttribute('onclick', 'javascript:goforw(container_drilldown, "' + device.actor + '");');
    } else 
    if (!!entry.single) img.setAttribute('onclick', 'javascript:goforw(' + entry.single + ', "' + device.actor + '");');
    actor.appendChild(img);
    div.appendChild(actor);

    actors[device.actor] = device;
    a++;
    if ((a > 0) && ((a % 12) === 0)) actorRow++;
  }
  div.setAttribute('style', 'overflow-y: ' + ((actorRow > 2) ? 'scroll' : 'hidden') + '; overflow-x: hidden;');
  chart.appendChild(div);
  
  div = document.createElement('div');
  div.setAttribute('class', 'tags');
  chart.appendChild(div);
  span = document.createElement('span');
  span.setAttribute('class', 'grouping');
  span.innerHTML = 'tags';
  div.appendChild(span);
  div.appendChild(document.createElement('br'));

  a = 0;
  for (prop in tags) if (tags.hasOwnProperty(prop)) {
    tag = document.createElement('span');
    tag.setAttribute('class', 'tag');
    if (a === 0) {
      tag.setAttribute('style', 'background-color: #000; color: #00ba00;');
      tag.innerHTML = 'tags';
    } else {
      tag.setAttribute('id', 'tag' + (a + 1));
      tag.setAttribute('onclick', 'javascript:goforw(tag_drilldown, "' + prop + '");');
      tag.innerHTML = prop.replace(/\s/g, '&nbsp;');
    }
    div.appendChild(tag);
    span = document.createElement('span');
    span.innerHTML = ' ';
    div.appendChild(span);
    if (++a >= 12) break;
  }
if (false) {
  div = document.createElement('div');
  div.setAttribute('class', 'apprentices');
  chart.appendChild(div);
  
  tag = document.createElement('span');
  tag.setAttribute('class', 'tag');
  tag.setAttribute('style', 'background-color: #000; color: #00ba00;');
  tag.innerHTML = 'apprentices';
  div.appendChild(tag);
  span = document.createElement('span');
  span.innerHTML = ' ';
  div.appendChild(span);
  tag = document.createElement('span');
  tag.setAttribute('class', 'tag');
  tag.setAttribute('onclick', 'javascript:goApprentices()');
  tag.innerHTML = 'home&nbsp;autonomy';
  div.appendChild(tag);
  span = document.createElement('span');
  span.innerHTML = ' ';
  div.appendChild(span);
}
  div = document.createElement('div');
  div.setAttribute('class', 'wrapper');
  chart.appendChild(div);
  div = document.createElement('div');
  div.setAttribute('class', 'categories');
  chart.appendChild(div);
  span = document.createElement('span');
  span.setAttribute('class', 'grouping');
  span.innerHTML = 'categories';
  div.appendChild(span);
  div.appendChild(document.createElement('br'));

  a = 0;
  b = 0
  for (prop in categories) {
    if (categories.hasOwnProperty(prop)) {
      a++;
      if (prop === "gateway" || prop === "indicator") continue;
      b++;
    }
  }
  div.setAttribute('style', 'left:' + (420 - ((60 * b)/2) - 6) + 'px');
  a = (a >= 11) ? 0 : Math.floor((12 - a) / 2);
  for (prop in categories) if (categories.hasOwnProperty(prop)) {
    if (prop === "gateway" || prop === "indicator") continue;
    entry = entries[prop] || entries.default(prop);
    if ((!entry) || (!entry.img)) continue;

    category = document.createElement('div');
    category.setAttribute('id', 'category' + (a + 1));
    category.setAttribute('class', 'category');
    img = document.createElement('img');
    img.setAttribute('src', entry.img);
    if (!!entry.single) img.setAttribute('onclick', 'javascript:goforw(' + entry.single + ', "' + prop + '");');
    category.appendChild(img);
    p = document.createElement('p');
    p.setAttribute('class', 'actor-name');
    p.innerHTML = prop;
    category.appendChild(p);
    div.appendChild(category);

    if (++a >= 12) break;
  }
  
  function updateAgo() {
    if (document.getElementById("timeagoStamp")) {
      document.getElementById("timeagoStamp").innerHTML = d3.timestamp.ago(lastUpdated, true);
      setTimeout(updateAgo, 1000);
    }
  }
  setTimeout(updateAgo, 1000);

  self.onUpdate = function(updates) {
    var actorID, update, refresh = false;
    lastUpdated = [];
    if (!document.getElementById('stage')) return;
    for (var i = 0; i < updates.length; i++) {
      update = updates[i];

      if ((update.info.whatami && update.info.whatami.match(/\/device\/gateway\//)) ||
       (update.whatami && update.whatami.match(/\/device\/gateway\//))) {
        if (update.level && update.level === "alert") {
          notify("From " + update.name + ":" + update.message);
        }
      
        continue;
      
      }
      if (/\/place/.test(update.whatami)) {
        if (!!lastUpdated && !!update.updated) lastUpdated.push(update.updated);
        if (document.getElementById("wxicon")) {
          document.getElementById("wxicon").src = weather_icon(update.info.conditions.code, update.info.solar);
        }
        continue;
      }
      actorID = actor2ID(update.whoami);
      if (document.getElementById(actorID)) {
        document.getElementById(actorID).style.backgroundColor = statusColor(update);
        document.getElementById(actorID + '-label').style.color = statusColor(update);
      } else {
        refresh = true;
      }
      if (!!lastUpdated && !!update.updated) lastUpdated.push(update.updated);
    }
    lastUpdated = lastUpdated.sort(function(a, b) {return b - a;})[0];
    if (refresh) refreshActors(1);
  }
  
  function scrollDown(elem, top) {
    var endY = ((actorRow - 3) * actorHeight);
    var step = 5;
    if ((top+=step) < endY) {
      elem.scrollTop = top;
      setTimeout(function() {scrollDown(elem, top)}, 20);
    } else {
      firstLoad = false;
      scrollUp(elem, top);
    }
  }
  function scrollUp(elem, top) {
    var endY = 0;
    var step = 5;
    if ((top-=step) >= endY) {
      elem.scrollTop = top;
      setTimeout(function() {scrollUp(elem, top)}, 20);
    }
  }
  if (firstLoad) {
    setTimeout(function() {scrollDown(document.getElementById('stage'), 50)}, 0);
  } else {
    document.getElementById('stage').scrollTop = lastStageScroll;
  }
  
  showReauth();
};

var onUpdate_drilldown = function(updates) {
  var actor, arc, arcs, arcz, category, entry, i, j, update;
  for (i = 0; i < updates.length; i++) {
    update = updates[i];
    if (update.whatami.match(/\/device\/gateway\//)) continue;
    if (update.whatami.match(/\/place/)) {
      if (!!lastUpdated && !!update.updated) lastUpdated.push(update.updated);
      continue;
    }
    
    actors[update.whoami].info = update.info;
    actors[update.whoami].status = update.status;
    actors[update.whoami].updated = update.updated;
    
    entry = entries[update.whatami] || entries.default(update.whatami);
    currDevice.entry = entry;
    arcs = entry.arcs(update);
    
    if (document.getElementById("device-viewport")) {
      // Update multi-drilldown page
      for (j = 0; j < multiple_arcs.length; j++) {
        // Look for old arc object
        if (multiple_arcs[j].id === actor2ID(update.whoami)) {
          multiple_arcs[j].color = arcs[1].color;
          multiple_arcs[j].cooked = arcs[1].cooked;
          multiple_arcs[j].raw = arcs[1].raw;
          multiple_arcs[j].value = arcs[1].value;
          document.getElementById(actor2ID(update.whoami) + "-tray-icon").style.backgroundColor = statusColor(update);
          drawArcs();
          break;
        }
      }
    } else {
      // Update single drilldown page
      if (update.whoami !== currDevice.actor) continue;
      currDevice.device.status = update.status;
      currDevice.device.info = update.info;
      currDevice.device.name = update.name;
      document.getElementById("actor-big-icon").style.backgroundColor = statusColor(update);
      document.getElementById("actor-big-name").style.color = statusColor(update);
      document.getElementById("actor-big-name").textContent = currDevice.device.name;
      if (document.getElementById("single-device-instructions")) {
        document.getElementById("single-device-instructions").innerHTML = entry.instrux(currDevice.device);
      }
      drawArcs(arcs);
      // Update popover controls, if present
      if (document.getElementById("pop-substrate")) {
        updatePopover(currDevice.device, update);
      }
      
    }
  }
};

var device_drilldown = function(name, devices, arcs, instructions) {
  var chart, device, div, div2, entry, i, img, trayLeft, trayPages, trayWidth;
  var iconWidth = 50;
  var viewportWidth = iconWidth * 5;
  
  chart = document.getElementById('chart');
  while (chart.lastChild) chart.removeChild(chart.lastChild);
  chart.style.backgroundImage = 'url(images/thing.bkg.svg)';

  if (instructions.length) {
    instructions = '<div class="big-instructions">'
                  + '<span style="color: #666;">Send me instructions.</span>'
                  + '</div>'
                  + '<div id="single-device-instructions" class="small-instructions" style="cursor: pointer">'
                  + instructions
                  + '</div>';
  }

  div = document.createElement('div');
  div.setAttribute('style', 'position: absolute; top: 20px; left: 20px; margin-bottom: 8px; width: 44px; height: 44px; background-color: #fff;');
  img = document.createElement('img');
  img.setAttribute('src', 'actors/home.svg');
  img.setAttribute('onclick', 'javascript:if (document.getElementById("map-canvas")) {document.body.removeChild(document.getElementById("map-canvas"))}; goback();');
  div.appendChild(img);
  chart.appendChild(div);

  div = document.createElement('div');
  div.setAttribute('id', 'controls');
  div.setAttribute('style', 'margin-top: 40px;');
  
  chart.appendChild(div);
  
  if (devices.length > 1) {
    var actor, div3, div4, pager;
    var actorWidth = 50;
    

    multiple_arcs = arcs; //Preserve for redrawing arcs
    arcs = null;
    
    // Arrow elements for multis > 5
    if (devices.length > 5) {
		div3 = document.createElement('div');
		div3.setAttribute('id', 'left-arrow');
		div3.setAttribute('onclick', 'javascript:handleArrow(event)');
		div3.innerHTML = '&larr;';
		div.appendChild(div3);
		
		div3 = document.createElement('div');
		div3.setAttribute('id', 'right-arrow');
		div3.setAttribute('onclick', 'javascript:handleArrow(event)');
		div3.innerHTML = '&rarr;';
		div.appendChild(div3);
    }
    
    // The little dot navigator below the icon tray
    trayWidth = iconWidth * devices.length;
	if (devices.length > 5) {
	   trayPages = Math.ceil(trayWidth / viewportWidth);
	   trayWidth = iconWidth * 5 * trayPages;
   
	   pager = document.createElement('p');
	   pager.setAttribute('style', 'position: relative; top: -5px;');
	   var pagerElements = '';
	   for (i = 0; i < trayPages; i++) {
		  if (i == (lastIconTrayPage - 1)) {
			 pagerElements += "<span id='bullet" + i + "' class='bullet-on' onclick='javascript:gotoPage(event)'>&bull;</span>";
		  } else {
			 pagerElements += "<span id='bullet" + i + "' class='bullet-off' onclick='javascript:gotoPage(event)'>&bull;</span>";
		  }
	   }
	   pager.innerHTML = pagerElements;
	}
	trayLeft = ((viewportWidth / 2) - (trayWidth / 2));
	trayLeft = (trayLeft < 0) ? -(viewportWidth * (lastIconTrayPage - 1)) : trayLeft;
	
    // device-viewport and image-tray needed for horizontal scrolling of icons
    div3 = document.createElement('div');
    div3.setAttribute('id', 'device-viewport');
    div3.setAttribute('style', 'position: relative; left:12px; top: 85px; overflow-x: hidden; overflow-y: hidden; width: ' 
    				  + viewportWidth + 'px; height: 140px;');
    
    div.appendChild(div3);
    
    div4 = d3.select("#device-viewport")
      .append("div")
      .attr("id", "image-tray")
      .style('position', 'relative')
      .style('height', '107px')
      .style('width', trayWidth + 'px')
      .style('left', trayLeft + 'px');
       
    actor = div4.selectAll('div')
       .data(devices)
       .enter().append('div')
       .style('position', 'absolute')
       .style('top', '10px')
       .style('left', function(d, i) {return (i * actorWidth + 'px'); })
       .style('text-align', 'center')
       .style('width', actorWidth + 'px')
       .style('height', '107px')
       .style('overflow', 'hidden');
       
    actor.append('img')
       .attr('src', function(d, i) {
         if (/\weather\b/.test(devices[i].actor)) return weather_icon(devices[i].info.code); 
         var entry = entries[devices[i].deviceType] || entries.default(devices[i].deviceType); 
         return entry.img; })
       .style('background-color', function(d, i) {return statusColor(devices[i]); })
       .style('width', function(d, i) {if (/\weather\b/.test(devices[i].actor)) return '50px'; return 'inherit';})
       .attr('class', 'actor-grouping')
       .attr('id', function(d, i) {return actor2ID(devices[i].actor) + "-tray-icon";})
       .attr('onclick', function(d, i) {var entry = entries[devices[i].deviceType] || entries.default(devices[i].deviceType);
         return (!!containers[devices[i].actor]) ? 'javascript:goforw(container_drilldown, "' + devices[i].actor + '");' : 
           'javascript:goforw(' + entry.single + ', "' + devices[i].actor + '");'; });
    
    div.appendChild(div3);
    
    if (pager) div.appendChild(pager);
    
    div2 = document.createElement('div');
    div2.setAttribute('class', 'multiple-instructions');
    if (!!containers[currDevice.actor]) div2.setAttribute('id', 'toPopover');
    div2.innerHTML = '<span class="actor-name" style="">' + name + '</span>'
                    + '<span>'
                    + instructions
                    + '</span>';
    div.appendChild(div2);
  } else {
    device = devices[0];
    currDevice.device = device;
    entry = entries[device.deviceType] || entries.default(device.deviceType);
    currDevice.entry = entry;
    if (readOnlyAccess) instructions = '';
    img = (/\weather\b/.test(device.actor)) ? weather_icon(device.info.code) : entry.img;
    div.innerHTML = '<div style="width: 155px; height: 155px; position: relative; left: 62px; overflow: hidden;">'
                    + '<img class="actor-big" id="actor-big-icon" style="background-color:' + statusColor(device) + ';" src="' + img + '" /></div>'
                    + '<div id="toPopover" class="big-instructions">'
                    + '<span class="actor-name" id="actor-big-name" style="color:' + statusColor(device) + ';">' + name + '</span>'
                    + instructions
                    + '</div>';
  }
  chart.appendChild(div);
  if (document.getElementById("toPopover") && !readOnlyAccess) {
    document.getElementById("toPopover").setAttribute('onclick', 'javascript:showPop(currDevice.device);');
  }
  
  if (document.getElementById("left-arrow")) handleArrowVisibility();
  drawArcs(arcs);
};

var drawArcs = function(arcs) {
  var arcText, arcz, chart, div, i, index, limit, labels, trayLeft, values;
  var MAXARCS = 7;
  
  chart = document.getElementById("chart");
  if (document.getElementById("arcCanvas")) {
    chart.removeChild(document.getElementById("labels"));
    chart.removeChild(document.getElementById("arcCanvas"));
  }

  div = document.createElement('div');
  div.setAttribute('id', 'labels');
  div.setAttribute('style',
                   'position: absolute; top: 52px; left: 178px; width: 200px; height: 240px; text-align: right; font-weight: normal;');
  labels = '';
  arcz = [];
  if (!arcs) arcs = multiple_arcs;
  
  trayLeft = (document.getElementById("image-tray")) ? parseInt(d3.select("#image-tray").style("left"), 10) : null;
  if ((trayLeft == null) || (arcs.length < 5)) {
    i = 0;
	limit = arcs.length;
  } else {
    i = Math.abs(trayLeft) / 50;
    limit = ((i + 5) > arcs.length) ? arcs.length : (i + 5);
  }

  index = 0.7; // Reassign index values for arcs subset
  for (; i < limit; i++) {
    labels += arcLabelHTML(arcs[i].label);
    arcs[i].index = index;
    arcz.push(arcs[i]);
    index -= 0.1;
  }
  arcs = arcz;

  div.innerHTML = '<div class="labels" style="white-space: nowrap; width: 190px; overflow: hidden; -o-text-overflow: ellipsis; text-overflow: ellipsis; ">' + labels + '</div>';
  chart.appendChild(div);


// Based on http://vis.stanford.edu/protovis/ex/chart.html
// with an assist from arctween.js

  var w = 758,
      h = 758,
      r = Math.min(w, h) / 1.8,
      s = 0.09,
      color = d3.scale.ordinal()                // based on Status Board palette
      .range(["#9b00c1", "#006be6", "#009e99", "#00ba00", "#fc6a00", "#ffc600", "#ff3000"]);

  
  var arc = d3.svg.arc()
      .startAngle(0)
      .endAngle(function(d) { return d.value * 2 * Math.PI; })
      .innerRadius(function(d) { return d.index * r; })
      .outerRadius(function(d) { return (d.index + s) * r; });

  var arc2 = d3.svg.arc()
      .startAngle(0)
      .endAngle(function(d) { return 1.9999 * Math.PI; })
      .innerRadius(function(d) { return d.index * r; })
      .outerRadius(function(d) { return (d.index + s) * r; });

  var vis = d3.select("#chart").append("svg")
      .attr("width", w)
      .attr("height", h)
      .attr("id", "arcCanvas")
        .append("g")
      .attr("transform", "translate(" + w / 2 + "," + h / 2 + ")");

  var g = vis.selectAll("g")
      .data(function() { return arcs; })
    .enter().append("g");

// Commented code part of attempt to animate/bounce arc drawing. To be continued...
//   var path = g.selectAll("path")
//   	  .data(arcz.filter(function(d) { return d.value; }), function(d) { return d.name; });
//  
//   path.enter().append("path")
//       .transition()
//       .ease("elastic")
//       .duration(1000)
//       .attrTween("d", arcTween);
//  
//   path.transition()
//       .ease("elastic")
//       .duration(1000)
//       .attrTween("d", arcTween);
//  
//   path.exit().transition()
//       .ease("bounce")
//       .duration(1000)
//       .attrTween("d", arcTween)
//       .remove();
 
//   var path = vis.append("path")
//       .attr("id", function(d,i){return "a"+i;})
//       .attr("d", circle);
  
  var arcColor = []; // save to calc contrasting overlaid text color
  
  g.append("path")
      .style("fill", function(d, i) { arcColor[i] = ((!!d.color) ? d.color : color(i)); return arcColor[i]; })
      .attr("id", function(d, i) {return "arcPath" + i;})
      .classed("arc-path-spec", true)
      .attr("d", arc);
  
  var g2 = g.append("path")
      .style("fill", "none")
      .style("stroke", "none")
      .attr("id", function(d,i){return "a"+i;})
      .attr("d", arc2);  
    
    // readings
	var text = g.append("text")
		.attr("text-anchor", "start")
		.attr("dx", 4)
		.attr("dy", 24)
		.style("font-family", "Roadgeek 2005 Series D")
		.style("font-size", "12px")
		.style("color", "#fff")
		.classed("readings-text", true);
		
	text.append("textPath")
		.attr("stroke", "none")
		.attr("fill",function(d,i){return textColor(arcColor[i], arcs[i].value);})
		.attr("xlink:href",function(d,i){return "#a"+i;})
		.attr("id", function(d,i){return "arcTextPath" + i})
		.text(function(d,i){ return convertSymbol(d.cooked); });
           
    
//   function arcTween(b) {
//     var i = d3.interpolate( {value: b.start}, b);
//     return function(t) {
//       return arc(i(t));
//     };
//  }

  function convertSymbol(txt) {
    if (txt) {
      var re = /\&deg;/gi;
      txt = txt.replace(re, "°");
      re = /\<sup\>2\<\/sup\>/gi;
      txt = txt.replace(re, "²");
      re = /\<sub\>2\<\/sub\>/gi;
      txt = txt.replace(re, "₂");
      re = /\&sigma;/gi;
      txt = txt.replace(re, "σ");
      re = /\&plusmn;/gi;
      txt = txt.replace(re, "±");
    }
    return txt;
  }
  
  function arcLabelHTML(labelText) {
    var result = "";
    switch (labelText.toLowerCase()) {
      case "distance":
      case "location":
        result += "<span class='clickable-text' onclick='javascript:showLocation(event)'>" + labelText + "</span>";
        break;
      default:
        result += labelText;
        break;
    }
    return (result + "<br/>");
  }
};


var single_device_drilldown = function(state, arcs, instructions) {
  var device;

  device = actors[state.actor];
  device_drilldown(device.name, [ device ], arcs || single_device_arcs(device),
                   instructions || single_device_instructions(device));
};

var single_device_arcs = function(device) {
  var a0, a1, arcs, brightness, color, delta, metric, level, now, prop, v, v2;

  metric = place_info.displayUnits === 'metric';
  arcs = [];

  now = new Date().getTime();
  delta = clip2bars(now - (new Date(device.updated).getTime()), 0, 86400 * 1000);
  arcs.push({ name   : 'updated'
            , raw    : device.updated
            , label  : 'TIME'
            , cooked : d3.timestamp.ago(device.updated)
            , value  : delta
            , index  : 0.70
            });

  color = statusColor(device);
  switch (device.status) {
    case 'red':
    case 'unsafe':
    case 'error':
    case 'reset':
      arcs.push({ name   : 'status'
                , raw    : device.status
                , color  : color
                , label  : 'STATUS'
                , cooked : device.status
                , value  : 0.10
                , index  : 0.60
                });
     break;

    case 'indigo':
    case 'absent':
    case 'busy':
    case 'waiting':
      arcs.push({ name   : 'status'
                , raw    : device.status
                , color  : color
                , label  : 'STATUS'
                , cooked : device.status
                , value  : 0.20
                , index  : 0.60
                });
     break;

    case 'blue':
    case 'recent':
      arcs.push({ name   : 'status'
                , raw    : device.status
                , color  : color
                , label  : 'STATUS'
                , cooked : device.status
                , value  : 0.35
                , index  : 0.60
                });
     break;

    case 'off':
    case 'on':
      brightness = device.info.brightness;
      level = device.info.level || device.info.brightness;
      arcs.push({ name   : 'status'
                , raw    : device.status
                , color  : color
                , label  : (!level) ? 'STATUS' : (!brightness) ? 'LEVEL' : 'BRIGHTNESS'
                , cooked : (!!level) ? (level + '%') : device.status
                , value  : ((device.status === 'off') ? 0.0 : (!!level) ? level / 200 : 0.5)
                , index  : 0.60
                });
      break;

    case 'motion':
    case 'quiet':
      arcs.push({ name   : 'status'
                , raw    : device.status
                , color  : color
                , label  : 'STATUS'
                , cooked : device.status
                , value  : (!!device.info.lastSample) ? delta : 0.50
                , index  : 0.60
                });
      break;

    case 'locked':
    case 'unlocked':
      arcs.push({ name   : 'status'
                , raw    : device.status
                , color  : color
                , label  : 'STATUS'
                , cooked : device.status
                , value  : device.status === 'locked' ? 0.5 : 0.0
                , index  : 0.60
                });
        break;

    case 'present':
      break;

    default:
      arcs.push({ name   : 'status'
                , raw    : device.status
                , color  : color
                , label  : 'STATUS'
                , cooked : device.status
                , value  : 0.50
                , index  : 0.60
                });
      break;
  }

  if (device.status === 'present') { a0 = 1; a1 = 0.60; } else { a0 = 2; a1 = 0.50; }
  for (prop in device.info) {
    if (!device.info.hasOwnProperty(prop)) continue;

    v = device.info[prop];
    if ((!isNaN(v)) && typeof v === 'string') v = v * 1.0;
    switch (prop) {
      case 'contact':
        arcs.splice(a0,0, { name   : prop
                          , raw    : v
                          , label  : 'CONTACT'
                          , cooked : v
                          , value  : clip2bars(v === 'detected' ? 100 : 0, 0, 100)
                          , index  : a1
                          });
        break;

      case 'water':
        arcs.splice(a0,0, { name   : prop
                          , raw    : v
                          , label  : 'LEAK'
                          , cooked : v === 'detected' ? 'YES!' : 'nothing detected'
                          , value  : clip2bars(v === 'detected' ? 100 : 0, 0, 100)
                          , index  : a1
                          });
        break;

      case 'currentUsage':
      case 'generating':
        v2 = Array.isArray(v) ? v[0] : v;
        arcs.splice(a0,0, { name   : prop
                           , raw    : v2
                           , label  : prop === 'currentUsage' ? 'USING' : 'GENERATING'
                           , cooked : v2 + ' watts'
                           , value  : clip2bars(v2, 0, 1000)
                           , index  : a1
                           });
        continue;

      case 'dailyUsage':
      case 'exporting':
        v2 = Array.isArray(v) ? v[0] : v;
        arcs.splice(a0+1,0, { name   : prop
                           , raw    : v2
                           , label  : prop === 'dailyUsage' ? 'DAILY USAGE' : 'EXPORTING'
                           , cooked : v2 + (prop === 'dailyUsage' ? ' watt-hours' : ' watts')
                           , value  : clip2bars(v2, 0, 10000)
                           , index  : a1 - 0.10
                           });
        continue;

      case 'location':
        if ((!!place.info) && (!!place.info.location) && (!!place.info.location[1])) {
          dist = getDistanceFromLatLonInKm(v[0], v[1], place.info.location[0], place.info.location[1]);
          cooked = (dist >= 1) ? (metric) ? (dist.toFixed(0) + ' km' ) : ((dist / 1.60934).toFixed(0) + ' mi')
                               : (dist > 0) && (device.info.velocity > 0) ? 'nearby'
                               : place.name;
          if ((dist >= 1) && (!!device.info.physical)) {
            cooked = device.info.physical + ' (' + cooked + ')';
            dist = 0;
          }
        } else {
          cooked = v.toString();
          dist = -1;
        }
        arcs.splice(a0,0, { name   : prop
                          , raw    : v
                          , label  : (dist > 1) ? 'DISTANCE' : 'LOCATION'
                          , cooked : cooked
                          , value  : clip2bars(dist > 0 ? dist : 0, 0, 4700)
                          , index  : 0.70
                          });
        continue;

      case 'accuracy':
        v2 = isNaN(v) ? v.toFixed(2) : v;
        arcs.splice(a0+1,0, { name   : prop
                           , raw    : v2
                           , label  : 'ACCURACY'
                           , cooked : (metric) ? '&plusmn; ' + v2 + 'm' : Math.round(v * 3.28084) + 'ft'
                           , value  : clip2bars(v2, 0, 100)
                           , index  : a1 - 0.10
                           });
        continue;

      case 'rankings':
        if (!Array.isArray(v)) continue;
        for (i = 0; i < v.length; ) {
          v2 = v[i++];
          v2 = names[v2] || v2;
          arcs.splice(a0 + i , 0,
                             { name   : prop
                             , raw    : v2
                             , label  : v2
                             , cooked : (i == 1) ? (device.info.lqi + ' LQI') : ''
                             , value  : clip2bars(i == 1 ? device.info.lqi : -127, -127, 128)
                             , index  : a1 - (i * 0.10)
                             });
          if (i >= 4) break;
        }
        break;

      default:
        continue;
    }
    break;
  }

  if (arcs.length === 0) {
    arcs.push({ name   : 'status'
              , raw    : device.status
              , color  : color
              , label  : 'STATUS'
              , cooked : device.status
              , value  : 50
              , index  : a1
              });
  }

  return arcs;
};

var single_device_instructions = function(device) {
  var instructions;

  switch (device.status) {
    case 'present':
     return '';

    case 'off':
      return 'turn on';

    case 'on':
      instructions = 'turn off';
      if (!!device.info.level) instructions += '<br/>adjust power';
      return instructions;

    default:
      return '';
  }
};

var no_instructions = function(device) {
  return '';
}

var single_climate_drilldown = function(state) {
  var device, entry, instructions;

  device = actors[state.actor];
  entry = entries[device.deviceType] || entries.default(device.deviceType);
  instructions = entry.instrux(device);

  device_drilldown(device.name, [ device ], climate_device_arcs(device), instructions);
};

var single_climate_instructions = function(device) {
//  instructions = 'show data for last week';
  instructions = '';
  return instructions;
};



var climate_device_arcs = function(device) {
  var arcs, i, metric, now, prop, props, v;

  metric = place_info.displayUnits === 'metric';
  arcs = [];

  if (!device.info.lastSample) device.info.lastSample = device.updated;
  props = sortprops(device.info, [ 'lastSample',
                                 , 'temperature',     'airQuality',      'voc'
                                 , 'goalTemperature', 'flame',           'moisture', 'needsWater',    'text'
                                 , 'humidity',        'co2',             'smoke',    'light',         'flow',
                                                      'needsMist',       'rssi'
                                 , 'hvac',            'noise',           'co',       'concentration', 'nextSample',
                                                      'needsFertilizer', 'battery',  'batteryLevel',  'location'
                                 , 'away',             'pressure',       'no2'
                                 ]);

  for (i = 0; i < props.length; i++) {
    prop = props[i];

    v = device.info[prop];
    if ((!isNaN(v)) && typeof v === 'string') v = v * 1.0;
    switch (prop) {
// outer ring
      case 'lastSample':
        now = new Date().getTime();
        arcs.splice(0, 0, { name   : prop
                          , raw    : v
                          , label  : 'TIME'
                          , cooked : d3.timestamp.ago(v)
                          , value  : clip2bars(now - (new Date(v).getTime()), 0, 86400 * 1000)
                          , index  : 0.70
                          });
        break;


// 1st ring
      case 'temperature':
        arcs.splice(1, 0, { name   : prop
                          , raw    : v
                          , label  : 'TEMPERATURE'
                          , cooked : (metric) ? v.toFixed(2) + '&deg;C' : ((v * 1.8) + 32).toFixed(2) + '&deg;F'
                          , value  : clip2bars(v, v >= 18 ? 18 : 0, v <= 28 ? 28 : 100)
                          , index  : 0.60
                          });
        break;

      case 'airQuality':
        arcs.splice(1, 0, { name   : prop
                          , raw    : v
                          , label  : 'QUALITY'
                          , cooked : isNaN(v) ? v : (v + (typeof v === 'string' ? '&sigma;' : 'ppm'))
                          , value  : clip2bars(-v, -5, 1.5)
                          , index  : 0.60
                          });
        break;

      case 'voc':
        arcs.splice(1, 0, { name   : prop
                          , raw    : v
                          , label  : 'VOC'
                          , cooked : v + ' ppm'
                          , value  : clip2bars(v, 450, 900)
                          , index  : 0.60
                          });
        break;


// 2nd ring
      case 'goalTemperature':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'GOAL'
                          , cooked : (metric) ? v.toFixed(2) + '&deg;C' : ((v * 1.8) + 32).toFixed(2) + '&deg;F'
                          , value  : clip2bars(v, 18, 28)
                          , index  : 0.50
                          });
        break;

      case 'flame':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'FLAME'
                          , cooked : v === 'detected' ? 'YES!' : 'nothing detected'
                          , value  : clip2bars(v === 'detected' ? 100 : 0, 0, 100)
                          , index  : 0.50
                          });
        break;

      case 'moisture':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'MOISTURE'
                          , cooked : v.toFixed(3) + ' mb'
                          , value  : clip2bars(v, 50, 250)
                          , index  : 0.50
                          });
        break;

      case 'needsWater':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'WATER'
                          , cooked : v === 'true' ? 'NEEDS WATER!' : 'ok'
                          , value  : clip2bars(v === 'true' ? 100 : 0, 0, 100)
                          , index  : 0.50
                          });
        break;

      case 'text':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'CONDITIONS'
                          , cooked : v
                          , value  : clip2bars(v.length ? 100 : 0, 0, 100)
                          , index  : 0.50
                          });
        break;


// 3rd ring
      case 'humidity':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'HUMIDITY'
                          , cooked : v + '%'
                          , value  : clip2bars(v, 21, 70)
                          , index  : 0.40
                          });
        break;

      case 'co2':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'CO<sub>2</sub>'
                          , cooked : v + ' ppm'
                          , value  : clip2bars(v, 0, 1200)
                          , index  : 0.40
                          });
        break;

      case 'smoke':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'SMOKE'
                          , cooked : (!isNaN(v)) ? (v + (typeof v === 'string' ? '&sigma;' : 'ppm'))
                                                 : (v !== 'absent') ? v.toUpperCase() : v
                          , value  : clip2bars((isNaN(v)) ? ((v === 'absent') ? -5 : 1.5) : -v, -5, 1.5)
                          , index  : 0.40
                          });
        break;

      case 'light':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'LIGHT'
                          , cooked : v.toFixed(1) + ' lx'
                          , value  : clip2bars(v, 5000, 25000)
                          , index  : 0.40
                          });
        break;

      case 'flow':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'AIR FLOW'
                          , cooked : isNaN(v) ? v : (v + (typeof v === 'string' ? '&sigma;' : 'ppm'))
                          , value  : clip2bars(-v, -5, 2.5)
                          , index  : 0.40
                          });
        break;

      case 'needsMist':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'MIST'
                          , cooked : v === 'true' ? 'NEEDS MISTING!' : 'ok'
                          , value  : clip2bars(v === 'true' ? 100 : 0, 0, 100)
                          , index  : 0.40
                          });
        break;

      case 'rssi':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'SIGNAL'
                          , cooked : v + ' dB'
                          , value  : clip2bars(v, -127, 128)
                          , index  : 0.40
                          });
        break;


// 4th ring
      case 'hvac':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'MODE'
                          , cooked : v
                          , value  : clip2bars(  v === 'fan'  ?  33
                                               : v === 'heat' ?  66
                                               : v === 'cool' ? 100 : 0, 0, 100)
                          , index  : 0.30
                          });
        break;

      case 'noise':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'NOISE'
                          , cooked : v + ' dB'
                          , value  : clip2bars(v, 0, 70)
                          , index  : 0.30
                          });
        break;

      case 'co':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'CO'
                          , cooked : (!isNaN(v)) ? (v + (typeof v === 'string' ? '&sigma;' : 'ppm'))
                                                 : (v !== 'absent') ? v.toUpperCase() : v

                          , value  : clip2bars((isNaN(v)) ? ((v === 'absent') ? -5 : 1.5) : -v, -5, 1.5)
                          , index  : 0.40
                          });
        break;

      case 'concentration':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'CONCENTRATION'
                          , cooked : v.toFixed(0) + ' pcs/liter'
                          , value  : clip2bars(v, 0, 14000)
                          , index  : 0.40
                          });
        break;

      case 'nextSample':
        now = new Date().getTime();
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'NEXT SAMPLE'
                          , cooked : d3.timestamp.ago(v)
                          , value  : clip2bars((new Date(v).getTime()) - now, 0, 86400 * 1000)
                          , index  : 0.30
                          });
        break;

      case 'needsFertilizer':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'FERTILIZER'
                          , cooked : v === 'true' ? 'NEEDS FERTILIZER!' : 'ok'
                          , value  : clip2bars(v === 'true' ? 100 : 0, 0, 100)
                          , index  : 0.30
                          });
        break;

      case 'battery':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'BATTERY'
                          , cooked : v + ' volts'
                          , value  : clip2bars(v, 0, 12)
                          , index  : 0.30
                          });
        break;

      case 'batteryLevel':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'BATTERY'
                          , cooked : v + '%'
                          , value  : clip2bars(v, 0, 100)
                          , index  : 0.30
                          });
        break;

      case 'location':
        if (!!device.info.placement) {
          arcs.splice(4, 0, { name   : prop
                            , raw    : v
                            , label  : prop.toUpperCase()
                            , cooked : device.info.placement
                            , value  : 0
                            , index  : 0.30
                            });
          break;
        }
        if ((!!place.info) && (!!place.info.location) && (!!place.info.location[1])) {
          dist = getDistanceFromLatLonInKm(v[0], v[1], place.info.location[0], place.info.location[1]);
          cooked = (dist >= 1) ? (metric) ? (dist.toFixed(0) + ' km') : ((dist / 1.60934).toFixed(0) + ' mi')
                               : (dist > 0) && (device.info.velocity > 0) ? 'nearby'
                               : place.name;
          if ((dist >= 1) && (!!device.info.physical)) {
            cooked = device.info.physical + ' (' + cooked + ')';
            dist = 0;
          }
        } else {
          cooked = v.toString();
          dist = -1;
        }
        arcs.splice(4,0, { name   : prop
                          , raw    : v
                          , label  : (dist > 1) ? 'DISTANCE' : 'LOCATION'
                          , cooked : cooked
                          , value  : clip2bars(dist > 0 ? dist : 0, 0, 4700)
                          , index  : 0.30
                          });
        break;


// 5th ring
      case 'away':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'AWAY'
                          , cooked : v
                          , value  : clip2bars(v !== 'on' ? 0 : 100, 0, 100)
                          , index  : 0.20
                          });
        break;

      case 'pressure':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'PRESSURE'
                          , cooked : v.toFixed(3) + ' mbars'
                          , value  : clip2bars(v, 980, 1060)
                          , index  : 0.20
                          });
        break;

      case 'no2':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'NO<sub>2</sub>'
                          , cooked : v.toFixed(0) + ' ppm'
                          , value  : clip2bars(v, 0, 1200)
                          , index  : 0.20
                          });
        break;

      default:
        continue;
    }
  }

  return arcs;
};


var single_thermostat_drilldown = function(state) {
  var device, entry, instructions;

  device = actors[state.actor];
  entry = entries[device.deviceType] || entries.default(device.deviceType);
  instructions = entry.instrux(device);

  device_drilldown(device.name, [ device ], thermostat_device_arcs(device), instructions);
};

var thermostat_device_arcs    = climate_device_arcs;


var single_lighting_drilldown = function(state) {
  var device, entry, instructions;

  device = actors[state.actor];
  entry = entries[device.deviceType] || entries.default(device.deviceType);
  instructions = entry.instrux(device);

  device_drilldown(device.name, [ device ], lighting_device_arcs(device), instructions);
};

var single_lighting_instructions = function(device) {
  instructions = (device.status === 'off') ? 'turn on' : 'turn off';
  if (device.status === 'on') {
    if (!!device.info.brightness) instructions += '<br/>adjust brightness';
    if ((!!device.info.color) && (!device.info.color.fixed)) instructions += '<br/>adjust color';
  }
  return instructions;
};

var lighting_device_arcs = single_device_arcs;


var single_media_drilldown = function(state) {
  var device, entry, instructions;

  device = actors[state.actor];
  entry = entries[device.deviceType] || entries.default(device.deviceType);
  instructions = entry.instrux(device);

  device_drilldown(device.name, [ device ], media_device_arcs(device), instructions);
};

var single_media_instructions = function(device) {
  instructions = (device.status !== 'playing') ? 'play' : 'pause';
  if (device.info.volume) instructions += '<br/>' + 'adjust volume<br/>';
  if (device.info.muted) instructions += (device.info.muted !== 'on') ? 'mute' : 'unmute';
  return instructions;
};

var single_thermostat_instructions = function(device) {
  instructions = "";
  if (device.info.hvac) instructions += (device.info.hvac !== 'on') ? 'turn on HVAC' : 'turn off HVAC';
  instructions += '<br/>' + 'set desired temperature';
  if (device.info.fan) instructions += '<br/>' + 'set fan time';
  return instructions;
};

var single_presence_instructions = function(device) {
  instructions = (device.status === "present") ? "send alerts" : "";
  return instructions;
};

var media_device_arcs = function(device) {
  var arcs, prop, text, v;

  arcs = [];

  props = sortprops(device.info, [ 'track', 'volume', 'muted', 'mode' ]);

  v = device.status;
  arcs.push({ name   : 'status'
            , raw    : v
            , label  : 'STATUS'
            , cooked : v
            , value  : clip2bars(v === 'playing' ? 100 : v === 'idle' ? 0 : 50, 0, 100)
            , index  : 0.70
            });

  for (i = 0; i < props.length; i++) {
    prop = props[i];

    v = device.info[prop];
    if ((!isNaN(v)) && typeof v === 'string') v = v * 1.0;
    switch (prop) {
      case 'track':
        text = v.title || '';
        if ((text.length > 0) && (!!v.artist)) text += ' / ' + v.artist;
        if ((text.length > 0) && (!!v.album))  text += ' / ' + v.album;
        arcs.splice(1, 0, { name   : prop
                          , raw    : v.title || ''
                          , label  : 'TRACK'
                          , cooked : text
                          , value  : clip2bars((text.length > 0) ? 100 : 0, 0, 100)
                          , index  : 0.60
                          });

        text = getTimeString(v.position);
        if (text !== '') {
          v2 = getTimeString(v.duration);
          if (v2 != '') text += ' / ' + getTimeString(v.duration);
          v2 = 'POSITION';
        } else if ((!!v.duration)) {
          v2 = 'DURATION';
          text = getTimeString(v.duration);
        } else break;
        
        arcs.splice(2, 0, { name   : 'position'
                          , raw    : v.pos || ''
                          , label  : v2
                          , cooked : text
                          , value  : clip2bars(v.position || 0, 0, v.duration || 1)
                          , index  : 0.50
                          });
        break;

      case 'volume':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'VOLUME'
                          , cooked : v + '%'
                          , value  : clip2bars(v, 0, 100)
                          , index  : 0.40
                          });
        break;

      case 'muted':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'MUTE'
                          , cooked : v
                          , value  : clip2bars(v !== 'on' ? 0 : 100, 0, 100)
                          , index  : 0.30
                          });
        break;

      case 'mode':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'MODE'
                          , cooked : v
                          , value  : clip2bars(  v === 'repeat'   ?  33
                                               : v === 'shuffle'  ?  66
                                               : v === 'shuffle1' ? 100 : 0, 0, 100)
                          , index  : 0.20
                          });
        break;

      default:
        continue;
    }
  }

  return arcs;
};

var getTimeString = function(v) {
  var text = '';

  if ((!v) || isNaN(v)) return text;

  v = Math.round(v / 1000);

  text = ('0' + (v % 60)).substr(-2);
  v = Math.floor(v / 60);

  if (v !== 0) {
    text = ('0' + (v % 60)).substr(-2) + ':' + text;
    v = Math.floor(v / 60);
  } else text = '00:' + text;
  if (v !== 0) text = ('0' + v).substr(-2) +':' + text;

  return text;
};


var single_motive_drilldown = function(state) {
  var device, entry, instructions;

  device = actors[state.actor];
  entry = entries[device.deviceType] || entries.default(device.deviceType);
  instructions = entry.instrux(device);

  device_drilldown(device.name, [ device ], motive_device_arcs(device), instructions);
};

var single_motive_instructions = function(device) {
  var performs = stack[0].message.result.actors[device.deviceType].perform.toString();
  var instructions = '';
  if (/\block\b/.test(performs) && /\bunlock\b/.test(performs)) 
    instructions += ((device.status !== 'locked') ? 'lock' : 'unlock') + '<br/>';
  if (/\bdoors\b/.test(performs)) instructions += ((device.info.doors !== 'locked') ? 'lock doors' : 'unlock doors') + '<br/>';
  if (/\blights\b/.test(performs)) instructions += 'flash headlights<br/>';
  if (/\bhorn\b/.test(performs)) instructions += 'honk horn<br/>';
  if (/\bhvac\b/.test(performs)) instructions += 'set desired temperature<br/>';
  if (/\bsunroof\b/.test(performs)) instructions += (device.info.sunroof !== 'none') ? 'adjust sunroof' : '';
  return instructions
}

var motive_device_arcs = function(device) {
  var arcs, cooked, dist, i, prop, props, v;

  metric = place_info.displayUnits === 'metric';
  arcs = [];
  props = sortprops(device.info, [ 'lastSample', 'location', 'velocity', 'heading', 'odometer', 'charger', 'intTemperature' ]);

  for (i = 0; i < props.length; i++) {
    prop = props[i];

    v = device.info[prop];
    if ((!isNaN(v)) && typeof v === 'string') v = v * 1.0;
    switch (prop) {
      case 'lastSample':
        now = new Date().getTime();
        arcs.splice(0, 0, { name   : prop
                          , raw    : v
                          , label  : 'TIME'
                          , cooked : d3.timestamp.ago(v)
                          , value  : clip2bars(now - (new Date(v).getTime()), 0, 86400 * 1000)
                          , index  : 0.70
                          });
        break;

      case 'location':
        if ((!!place.info) && (!!place.info.location) && (!!place.info.location[1])) {
          dist = getDistanceFromLatLonInKm(v[0], v[1], place.info.location[0], place.info.location[1]);
          cooked = (dist >= 1) ? (metric) ? (dist.toFixed(0) + ' km') : ((dist / 1.60934).toFixed(0) + ' mi')
                               : (dist > 0) && (device.info.velocity > 0) ? 'nearby'
                               : place.name;
          if ((dist >= 1) && (!!device.info.physical)) {
            cooked = device.info.physical + ' (' + cooked + ')';
            dist = 0;
          }
        } else {
          cooked = v.toString();
          dist = -1;
        }
        arcs.splice(1, 0, { name   : prop
                          , raw    : v
                          , label  : (dist > 1) ? 'DISTANCE' : 'LOCATION'
                          , cooked : cooked
                          , value  : clip2bars(dist > 0 ? dist : 0, 0, 4700)
                          , index  : 0.60
                          });
        break;

      case 'velocity':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'SPEED'
                          , cooked : (v > 0) ? (metric) ? ((v * 3.6).toFixed(0) + ' km/h') : ((v * 2.23694).toFixed(0) + ' mph')
                                             : 'stationary'
                          , value  : clip2bars(v, 0, 50)
                          , index  : 0.50
                          });
        break;

      case 'heading':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'HEADING'
                          , cooked :   (v <  22.5) ? 'north' 
                                     : (v <  67.5) ? 'north-east'
                                     : (v < 112.5) ? 'east'
                                     : (v < 157.5) ? 'south-east'
                                     : (v < 202.5) ? 'south'
                                     : (v < 247.5) ? 'south-west'
                                     : (v < 292.5) ? 'west'
                                     : (v < 335.5) ? 'north-west'
                                     : 'north'
                          , value  : clip2bars((v > 180) ? (360 - v) : v, 0, 180)
                          , index  : 0.40
                          });
        break;

      case 'odometer':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'ODOMETER'
                          , cooked : (metric) ? v.toFixed(0) + ' km' : (v / 1.60934).toFixed(0) + ' mi'
                          , value  : clip2bars(v % 20000, 0, 20000)
                          , index  : 0.30
                          });
        break;

      case 'charger':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'CHARGER'
                          , cooked : v
                          , value  :   v === 'charging'      ? 0.50
                                     : v === 'regenerating'  ? 0.375
                                     : v === 'drawing'       ? 0
                                     : 0.25
                          , index  : 0.20
                          });
        break;

      case 'intTemperature':
        arcs.splice(6, 0, { name   : prop
                          , raw    : v
                          , label  : 'INTERIOR'
                          , cooked : (metric) ? v.toFixed(2) + '&deg;C' : ((v * 1.8) + 32).toFixed(2) + '&deg;F'
                          , value  : clip2bars(v, 17, 32)
                          , index  : 0.10
                          });
        break;

      default:
        continue;
    }
  }

  if (arcs.length > 0) return arcs;

  now = new Date().getTime();
  delta = clip2bars(now - (new Date(device.updated).getTime()), 0, 86400 * 1000);
  arcs.push({ name   : 'updated'
            , raw    : device.updated
            , label  : 'TIME'
            , cooked : d3.timestamp.ago(device.updated)
            , value  : delta
            , index  : 0.70
            });
  arcs.push({ name   : 'status'
            , raw    : device.status
            , color  : statusColor(device)
            , label  : 'STATUS'
            , cooked : device.status
            , value  : device.status === 'locked' ? 0.5 : 0.0
            , index  : 0.60
            });

  return arcs;
};

var sortprops = function(info, ordered) {
  var prop;

  props = [];
  for (prop in info) if (!!info.hasOwnProperty(prop)) props.push(prop);
  props.sort(function(a, b) { return (ordered.indexOf(a) - ordered.indexOf(b)); });

  return props;
};

// from http://stackoverflow.com/questions/27928/how-do-i-calculate-distance-between-two-latitude-longitude-points

var getDistanceFromLatLonInKm = function (lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
};

var deg2rad = function(deg) {
  return deg * (Math.PI/180);
};


var single_presence_drilldown  = single_device_drilldown;
var presence_device_arcs       = single_device_arcs;


var single_sensor_drilldown    = single_climate_drilldown;
var sensor_device_arcs         = climate_device_arcs;


var single_switch_drilldown    = single_device_drilldown;;
var switch_device_arcs         = single_device_arcs;


var single_wearable_drilldown  = single_device_drilldown;
var wearable_device_arcs       = single_device_arcs;



var clip2bars = function(v, min, max) {
  if (v < min) v = min;
  else if (v > max) v = max;

  return ((v - min) / ((max -min) * 2));
};


var category_drilldown = function(state, prefix) {
  var actor, device, entry, members;

  members = [];
  for (actor in actors) {
    if (!actors.hasOwnProperty(actor)) continue;

    device = actors[actor];
    if (device.deviceType.indexOf(prefix) !== 0) continue;
    entry = entries[device.deviceType] || entries.default(device.deviceType);
    if ((!entry) || (!entry.arcs)) continue;

    members.push(device);
  }

  multiple_drilldown(state.actor, members);
};

var category_climate_drilldown = function(state) {
  category_drilldown(state, '/device/climate/');
};

var category_lighting_drilldown = function(state) {
  category_drilldown(state, '/device/lighting');
};

var category_media_drilldown = function(state) {
  category_drilldown(state, '/device/media');
};

var category_motive_drilldown = function(state) {
  category_drilldown(state, '/device/motive');
};

var category_presence_drilldown = function(state) {
  category_drilldown(state, '/device/presence');
};

var category_sensor_drilldown = function(state) {
  category_drilldown(state, '/device/sensor');
};

var category_switch_drilldown = function(state) {
  category_drilldown(state, '/device/switch');
};

var category_wearable_drilldown = function(state) {
  category_drilldown(state, '/device/wearable');
};


var tag_drilldown = function(state) {
  var device, entry, group, i, members;

  group = tags[state.actor];
  if (!group) return;

  members = [];
  for (i = 0; i < group.length; i++) {
    device = group[i];
    entry = entries[device.deviceType] || entries.default(device.deviceType);
    if ((!entry) || (!entry.arcs)) continue;

    members.push(device);
  }

  multiple_drilldown(state.actor, members);
};

var container_drilldown = function(state) {
  var device, entry, group, i, members;
  
  currDevice.actor = state.actor;
  currDevice.device = actors[state.actor];
  currDevice.entry = entries[currDevice.device.deviceType] || entries.default(currDevice.device.deviceType);
  
  group = containers[state.actor];
  if (!group) return;

  members = [];
  for (i = 0; i < group.length; i++) {
    device = actors[group[i]];
    entry = entries[device.deviceType] || entries.default(device.deviceType);
    if ((!entry) || (!entry.arcs)) continue;

    members.push(device);
  }

  multiple_drilldown(actors[state.actor].name, members);
};

var review_drilldown = function(state) {
  var device, entry, group, i, members;
  
  group = place.info.review;
  if (!group) return;
  
  members = [];
  for (i = 0; i < group.length; i++) {
    device = actors[group[i]];
    if (!device) continue;
    entry = entries[device.deviceType] || entries.default(device.deviceType);
    if ((!entry) || (!entry.arcs)) continue;

    members.push(device);
  }

  multiple_drilldown(place.name, members);
}

var weather_drilldown = function(state) {
  var arc, arcs, arcz, device, devices, entry, group, i, index, maxForecasts, members, name, placeInfo;
  maxForecasts = 3;
  name = "";
  
  placeInfo = state.message.result['/place']['place/1'].info;
  if (!placeInfo.conditions || !placeInfo.forecasts) return;
  
  members = [];
  device = {actor      : "weather/1"
          , deviceType : "conditions"
          , info       : placeInfo.conditions
          , name       : "CURRENT"
          };
  members.push(device);
  group = placeInfo.forecasts;
  for (i = 0; i < group.length; i++) {
    if (i > maxForecasts) continue;
    device = {actor      : "weather/" + (i + 2)
            , deviceType : "forecast"
            , info       : group[i]
            , name       : (dayAhead(i + 1)).toUpperCase()
            };
    members.push(device);
  }
  
  arcs = [];
  devices = [];
  index = 0.7;
  for (i = 0; i < members.length; i++) {
    device = members[i];
    entry = entries[device.deviceType];
    
    arcz = entry.arcs(device);
    
    arc = arcz[0] || {};
    arc.id = actor2ID(device.actor + "/" + i);
    arc.label = device.name;
    arc.index = index;
    index -= 0.1;
    arcs.push(arc);
    
    devices.push(device);
  }
  
  device_drilldown(name, devices, arcs, 'touch a thing to learn more');
};

var single_weather_drilldown = function(state) {
  var device, devices, entry, i, instructions, placeInfo, suffix;
  devices = [];
  device = {};
  
  placeInfo = state.message.result['/place']['place/1'].info;
  if (state.actor === "weather/1") {
    device.actor = state.actor;
    device.deviceType = "conditions";
    device.info = placeInfo.conditions;
    device.name = "CURRENT";
  } else {
    suffix = state.actor.match(/\/(.+)$/)[1];
    device.actor = state.actor;
    device.deviceType = "forecasts";
    device.info = placeInfo.forecasts[suffix - 2];
    device.name = (dayAhead(suffix - 1).toUpperCase());
  }
  devices.push(device);
  device_drilldown(devices[0].name, devices, weather_arcs(devices[0]), '');
};

var weather_arcs = function(device) {
  var arcs, codeValues, metric, prop, v, v2;
  
  metric = place_info.displayUnits === 'metric';
  
  arcs = [];
  
  for (prop in device.info) {
    if (!device.info.hasOwnProperty(prop)) continue;

    v = device.info[prop];
    if ((!isNaN(v)) && typeof v === 'string') v = v * 1.0;
    switch (prop) {
      case 'text':
        v2 = "wx" + device.info.code;
        codeValues = { wx0     : 5
                  , wx2     : 5
                  , wx4     : 10
                  , wx5     : 15
                  , wx11    : 30
                  , wx12    : 30
                  , wx16    : 20
                  , wx18    : 20
                  , wx20    : 25
                  , wx23    : 25
                  , wx26    : 35
                  , wx32    : 50
                  , wx36    : 45
                  , wx40    : 40
                  , wx44    : 10
                  , wx45    : 10
                  };
        arcs.splice(0, 0, { name   : prop
                          , raw    : v
                          , label  : 'SUMMARY'
                          , cooked : v
                          , value  : clip2bars(codeValues[v2] || 25, 0, 100)
                          , index  : 0.70
                          });
        break;
      case 'temperature':
      case 'highTemperature':
        arcs.splice(1, 0, { name   : prop
                          , raw    : v
                          , label  : (prop === 'temperature') ? 'TEMPERATURE' : 'HIGH TEMP'
                          , cooked : (metric) ? v.toFixed(2) + '&deg;C' : ((v * 1.8) + 32).toFixed(2) + '&deg;F'
                          , value  : clip2bars(v, v >= -30 ? -30 : 0, v <= 50 ? 50 : 100)
                          , index  : 0.60
                          });
        break;
      case 'humidity':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'HUMIDITY'
                          , cooked : v + '%'
                          , value  : clip2bars(v, 21, 70)
                          , index  : 0.50
                          });
        break;
      case 'lowTemperature':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'LOW TEMP'
                          , cooked : (metric) ? v.toFixed(2) + '&deg;C' : ((v * 1.8) + 32).toFixed(2) + '&deg;F'
                          , value  : clip2bars(v, v >= -30 ? -30 : 0, v <= 50 ? 50 : 100)
                          , index  : 0.50
                          });
        break;
      case 'pressure':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'PRESSURE'
                          , cooked : v.toFixed(3) + ' mbars'
                          , value  : clip2bars(v, 980, 1060)
                          , index  : 0.40
                          });
        break;
      case 'windchill':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'WIND CHILL'
                          , cooked : (metric) ? v.toFixed(2) + '&deg;C' : ((v * 1.8) + 32).toFixed(2) + '&deg;F'
                          , value  : clip2bars(v, v >= -30 ? -30 : 0, v <= 50 ? 50 : 100)
                          , index  : 0.30
                          });
        break;
      case 'visibility':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'VISIBILITY'
                          , cooked : (metric) ? v.toFixed(0) + ' km' : (v / 1.60934).toFixed(0) + ' mi'
                          , value  : clip2bars(v, 0, 50)
                          , index  : 0.20
                          });
        break;
    }
  }
  if (arcs.length > 0) return arcs;
};

var weather_icon = function(code, solar) {
  var entry;
  var path = 'popovers/assets/weather/';
  if (!solar) solar = stack[1].message.result['/place']['place/1'].info.solar;
  var codeEntries = {wx0     : 'tornado.svg'
                  ,  wx2     : 'hurricane.svg'
                  ,  wx4     : 'thunderstorm.svg'
                  ,  wx5     : 'mixedrainandsnow.svg'
                  ,  wx11    : 'showers.svg'
                  ,  wx12    : 'showers.svg'
                  ,  wx16    : 'snow.svg'
                  ,  wx18    : 'sleet.svg'
                  ,  wx20    : 'foggy.svg'
                  ,  wx23    : 'blustery.svg'
                  ,  wx26    : 'cloudy.svg'
                  ,  wx32    : 'sunny.svg'
                  ,  wx36    : 'hot.svg'
                  ,  wx44    : 'partlycloudy.svg'
                  ,  wx45    : 'thunderstorm.svg'
  };
  var solarEntries = {dawn               : 'night.svg'
                   ,  'morning-twilight' : 'night.svg'
                   ,  sunrise            : 'day.svg'
                   ,  morning            : 'day.svg'
                   ,  daylight           : 'day.svg'
                   ,  noon               : 'day.svg'
                   ,  evening            : 'day.svg'
                   ,  sunset             : 'day.svg'
                   ,  'evening-twilight' : 'night.svg'
                   ,  dusk               : 'night.svg'
                   ,  night              : 'night.svg'
                   ,  nadir              : 'night.svg'
  };
  entry = codeEntries['wx' + code] || solarEntries[solar];
  return path + entry;
};

function dayAhead(n) {
	var days, now, result;
	result = "";
	
        if (n-- === 1) return "today";
	days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	now = new Date();
	result = (n === 1) ? "tomorrow" : days[((now.getDay() + n) % 7)];
	return result;
}

var multiple_drilldown = function(name, members) {
  var arc, arcs, arcz, device, devices, entry, i, index; 

  arcs = [];
  devices = [];
  index = 0.7;
  members.sort(multiSort("deviceType", "name"));
  for (i = 0; i < members.length; i++) {
    device = members[i];
    entry = entries[device.deviceType] || entries.default(device.deviceType);
    if ((!entry) || (!entry.arcs)) continue;

    arcz = entry.arcs(device);

    arc = arcz[1] || {};
    arc.id = actor2ID(device.actor);
    arc.label = device.name;
    arc.index = index;
    index -= 0.1;
    arcs.push(arc);

    devices.push(device);
  }

  switch (devices.length) {
    case 0:
      break;

    case 1:
      device = devices[0];
      entry = entries[device.deviceType] || entries.default(device.deviceType);
      if (!!entry.single) entry.single({ page: entry.single, actor: device.actor });
      break;

    default:
      device_drilldown(name, devices, arcs, 'touch a thing to learn more');
      break;
  }
  
  // Multi-property sort adapted from http://stackoverflow.com/a/11379791
  function singleSort(prop) {
    return function(obj1, obj2) {
      return obj1[prop] > obj2[prop] ? 1 : obj1[prop] < obj2[prop] ? -1 : 0;
    }
  }
  
  function multiSort() {
    var props = arguments;
    return function(obj1, obj2) {
      var i = 0;
      result = 0;
      propCount = props.length;
      while(result === 0 && i < propCount) {
        result = singleSort(props[i])(obj1, obj2);
        i++;
      }
      return result;
    }
  }
};

var showLocation = function(evt) {
  var allLocs, count, hasLocations, i, image, j, lines, loc, locArray, locs, map, mapOptions, mapCanvas, marker, roadAtlassStyles, roadMapType, styledMapOptions;
  
  hasLocations = currDevice.device.info.hasOwnProperty('locations');
  
  if (!document.getElementById('googleMapsAPI')) {
    loadScript();
  } else {
    if (document.getElementById('map-canvas')) {
      chart.removeChild(document.getElementById('closeme'));
      document.body.removeChild(document.getElementById('map-canvas'));
      return;
    }
    
		mapCanvas = document.createElement('div');
		mapCanvas.id = 'map-canvas';
		document.body.appendChild(mapCanvas);

		div = document.createElement('div');
		div.setAttribute('id', 'closeme');
		img = document.createElement('img');
		img.setAttribute('src', 'popovers/assets/close.svg');
		img.setAttribute('onclick', 'javascript:showLocation()');
		div.appendChild(img);
		chart.appendChild(div);
    
    loc = currDevice.device.info.location;
    mapOptions = {
      zoom: 12,
      center: new google.maps.LatLng(parseFloat(loc[0]), parseFloat(loc[1])),
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        mapTypeIds: [google.maps.MapTypeId.HYBRID, 'usroadatlas']
      }
    };
		roadAtlasStyles = [
			{
				featureType: 'road.highway',
				elementType: 'geometry',
				stylers: [
					{ color: '#ffd809' },
					{ saturation: 0 },
					{ lightness: 0 }
				]
			},{
				featureType: 'road.arterial',
				elementType: 'geometry',
				stylers: [
					{ color: '#eeeeee' },
					{ visibility: 'on' },
				]
			},{
				featureType: 'road.local',
				elementType: 'geometry',
				stylers: [
					{ color: '#eeeeee' },
					{ visibility: 'simplified' }
				]
			},{
				featureType: 'water',
				elementType: 'geometry',
				stylers: [
					{ saturation: 40 },
					{ lightness: 40 }
				]
			},{
				featureType: 'road.highway',
				elementType: 'labels',
				stylers: [
					{ visibility: 'on' },
					{ saturation: 98 }
				]
			},{
				featureType: 'administrative.locality',
				elementType: 'labels',
				stylers: [
					{ hue: '#4b2057' },
					{ saturation: 50 },
					{ lightness: -10 },
					{ gamma: 0.90 }
				]
			},{
				featureType: 'transit.line',
				elementType: 'geometry',
				stylers: [
					{ hue: '#ff0000' },
					{ visibility: 'on' },
					{ lightness: -70 }
				]
			},{
				featureType: 'landscape',
				elementType: 'geometry',
				stylers: [
					{ color: '#ffffff' },
				]
			}    
		];
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
		styledMapOptions = {
			name: 'Road Map'
		};
	
		roadMapType = new google.maps.StyledMapType(
				roadAtlasStyles, styledMapOptions);
	
		map.mapTypes.set('usroadatlas', roadMapType);
		map.setMapTypeId('usroadatlas');
    
    image = {
      url: 'popovers/assets/actors/t.svg'
    };
    marker = new google.maps.Marker({
      position: new google.maps.LatLng(parseFloat(loc[0]), parseFloat(loc[1])),
      icon: image,
      map: map
    });
    
    if (hasLocations) {
      locs = [];
      allLocs = currDevice.device.info.locations;
    
      for (i = 0; i < allLocs.length; i++) {
        locArray = allLocs[i].split(',');
        locs[i] = new google.maps.LatLng(parseFloat(locArray[0]), parseFloat(locArray[1]))
      }
    
      lines = [];
      function addLine(i, start, end) {
        lines[i] = new google.maps.Polyline({
          path: [start, end],
          strokeColor: '#9b00c1',
          strokeWeight: 4,
          map: map
        });
        if (count === locs.length - 1) {
          count = 0;
          for (j = 0; j < lines.length; j++) {
            lines[j].setMap(null);
          }
        }
      }
    
      count = 0;
      function drawLines() {
        window.setInterval(function() {
          addLine(count, locs[count], locs[++count]);
        }, 800);
      }
    
      if (locs.length > 1) drawLines();
    }
  }
    
  function loadScript() {
    var script = document.createElement('script');
    script.id = 'googleMapsAPI';
    script.type = 'text/javascript';
    script.src = 'https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false&callback=showLocation';
    document.body.appendChild(script);
  }
}

// managing multi-drilldown icon display and control

var handleArrowVisibility = function() {
	var viewPortWidth = parseInt(document.getElementById("device-viewport").style.width, 10);
	var trayWidth = parseInt(document.getElementById("image-tray").style.width, 10);
	var trayLeft = parseInt(document.getElementById("image-tray").style.left, 10);
    var trayPage = Math.abs(trayLeft / viewPortWidth);
    document.getElementById("bullet" + trayPage).className = "bullet-on";
    lastIconTrayPage = trayPage + 1;
    
	if (trayLeft >= 0) {
		document.getElementById("left-arrow").style.display = "none";
	} else {
		document.getElementById("left-arrow").style.display = "block";
	}
	if (trayWidth + trayLeft <= viewPortWidth) {
		document.getElementById("right-arrow").style.display = "none";
	} else {
		document.getElementById("right-arrow").style.display = "block";
	}

};

var gotoPage = function(evt) {
    if (evt.target.className == "bullet-off") {
    	var viewPortWidth = parseInt(document.getElementById("device-viewport").style.width, 10);
		var pageNum = evt.target.id.slice(6);
		var leftEnd = -(pageNum * viewPortWidth);
		lastIconTrayPage = pageNum + 1
		
		var tray = d3.select("#image-tray");
		var transition = d3.transition()
		  .duration(5000)
		  .ease("linear");
		  
		tray.transition().each("end", function() {
			clearPager();
			drawArcs();
			handleArrowVisibility();
		})
	       .style("left", function() {return leftEnd + 'px';});
    }
};

var clearPager = function() {
    var i = 0;
    while (document.getElementById("bullet" + i)) {
       document.getElementById("bullet" + i).className = "bullet-off";
       i++;
    }
};

var handleArrow = function(evt) {
    var leftEnd, tray, startLeft;
	var viewPortWidth = parseInt(document.getElementById("device-viewport").style.width, 10);
	
	clearPager();
	tray = d3.select("#image-tray");
	startLeft = parseInt(tray.style("left"), 10);
	leftEnd = ((evt.target.id === 'right-arrow') ? (startLeft - viewPortWidth) : (startLeft + viewPortWidth));
	
	var transition = d3.transition()
	  .duration(5000)
	  .ease("linear");
	  
	tray.transition().each("end", function() {
		drawArcs();
		handleArrowVisibility();
	})
	  .style("left", function() {return leftEnd + 'px';});
}

// Convert actor name to qualified DOM id
var actor2ID = function(actor) {
	return actor.replace(/\//g, "_");
}

// Adapted from http://stackoverflow.com/questions/4726344/
// To work with d3_Color type
function textColor(bgColor, arcVal) {
   var bgDelta, components, nThreshold = 105;
   if (typeof bgColor === "string") {
     components = getRGBComponents(bgColor);
   } else {
     components = bgColor;
   }
   bgDelta = (components.r * 0.299) + (components.g * 0.587) + (components.b * 0.114);
   return (((255 - bgDelta) < nThreshold) && (arcVal > 0.015)) ? "#000000" : "#ffffff"; 
   
   function getRGBComponents(color) {       
     var r = color.substring(1, 3);
     var g = color.substring(3, 5);
     var b = color.substring(5, 7);

     return {
       "r": parseInt(r, 16),
       "g": parseInt(g, 16),
       "b": parseInt(b, 16)
     };
   }
}

var entries = {
// actors

// defaults for unknown device types
               default                                      : function(deviceType) {
                  var result = { img     : 'actors/t.svg'
                               , single  : single_device_drilldown
                               , arcs    : single_device_arcs
                               , instrux : single_device_instructions 
                               , pop     : ''
                               }
                    , quad   = deviceType.split('/')
                    ;
                  
                  result.img = 'actors/' + quad[2] + '-' + quad[4] + '.svg';
                  switch (quad[2]) {
                    case 'climate':
                      if (quad[4] === 'control') {
                        result.img = 'actors/control-thermostat.svg';
                        result.single = single_thermostat_drilldown;
                        result.arcs = thermostat_device_arcs;
                        result.instrux = single_thermostat_instructions;
                        result.pop = 'thermostat_pop';
                        break;
                      }
                           if (quad[4] === 'monitor')     result.img = 'actors/sensor-meteo.svg';
                      else if (quad[4] === 'temperature') result.img = 'actors/sensor-meteo.svg';
                      else if (quad[4] === 'sensor')      result.img = 'actors/sensor-generic.svg';
                      else                                result.img = 'actors/sensor-' + quad[4] + '.svg';
                      result.single = single_climate_drilldown;
                      result.arcs = climate_device_arcs;
                      result.instrux = single_device_instructions;
                      result.pop = 'history_pop';
                      break;

                    case 'lighting':
                           if (quad[4].indexOf('rgb') !== -1)   result.img = 'actors/' + quad[2] + '-lightstrip.svg';
                      else if (quad[4].indexOf('color') !== -1) result.img = 'actors/' + quad[2] + '-led.svg';
                      result.single = single_lighting_drilldown;
                      result.arcs = lighting_device_arcs;
                      result.instrux = single_lighting_instructions;
                      result.pop = 'lighting_pop';
                      break;

                    case 'media':
                      result.single = single_media_drilldown;
                      result.arcs = media_device_arcs;
                      result.instrux = single_media_instructions;
                      result.pop = 'media_pop';
                      break;

                    case 'motive':
// temporary
                      if (quad[4] === 'model-s') result.img = 'actors/' + quad[2] + '-vehicle.svg';
                      result.single = single_motive_drilldown;
                      result.arcs = motive_device_arcs;
                      result.instrux = single_motive_instructions;
                      result.pop = 'motive_pop';
                      break;

                    case 'presence':
                      result.single = single_presence_drilldown;
                      result.arcs = presence_device_arcs;
                      result.instrux = single_presence_instructions;
                      result.pop = 'presence_pop';
                      break;

                    case 'sensor':
// temporary
                      if ((quad[4] === 'spotter') || (quad[4] === 'sensortag')) {
                        result.img = 'actors/' + quad[2] + '-generic.svg';
                      }
                      result.single = single_sensor_drilldown;
                      result.arcs = sensor_device_arcs;
                      result.instrux = no_instructions;
                      break;

                    case 'switch':
                      result.single = single_switch_drilldown;
                      result.arcs = switch_device_arcs;
                      result.instrux = single_lighting_instructions;
                      result.contains = ['outlets', 'plugs'];
                      result.pop = 'switch_pop';
                      break;

                    case 'wearable':
                      result.single = single_wearable_drilldown;
                      result.arcs = wearable_device_arcs;
                      result.instrux = single_presence_instructions;
                      result.pop = 'wearable_pop';
                      break;
                  }
                  
                  return result;
                                                              }
// categories
              , climate                                     : { img     : 'categories/climate.svg'
                                                              , single  : category_climate_drilldown
                                                              }
              , lighting                                    : { img     : 'categories/lighting.svg'
                                                              , single  : category_lighting_drilldown
                                                              }
              , media                                       : { img     : 'categories/media.svg'
                                                              , single  : category_media_drilldown
                                                              }
              , motive                                      : { img     : 'categories/motive.svg'
                                                              , single  : category_motive_drilldown
                                                              }
              , presence                                    : { img     : 'categories/presence.svg'
                                                              , single  : category_presence_drilldown
                                                              }
              , sensor                                      : { img     : 'categories/sensor.svg'
                                                              , single  : category_sensor_drilldown
                                                              }
              , 'switch'                                    : { img     : 'categories/switch.svg'
                                                              , single  : category_switch_drilldown
                                                              }
              , wearable                                    : { img     : 'categories/wearable.svg'
                                                              , single  : category_wearable_drilldown
                                                              }
//weather
              , conditions                                  : { single  : single_weather_drilldown
                                                              , arcs    : weather_arcs
                                                              , instrux : no_instructions
                                                              }
              , forecast                                    : { single  : single_weather_drilldown
                                                              , arcs    : weather_arcs
                                                              , instrux : no_instructions
                                                              }
              };
