
var actors = {}
  , place
  , tags   = {}
  , multiple_arcs = []
  , lastUpdated
  , lastIconTrayPage = 1;

var home = function(state) {
  var a, actor, categories, category, chart, device, devices, div, entry, i, img, message, p, prop, span, tag;
  var actorHeight = 80, actorRow = 0, actorWidth = 58;
  
  var self = this;
  
  lastIconTrayPage = 1;

  chart = document.getElementById('chart');
  while (chart.lastChild) chart.removeChild(chart.lastChild);
  chart.style.backgroundImage = '';

  message = state.message;
  place = thePlace(message);
  devices = mostDevices(message);
  tags = allTags(message);
  categories = allCategories(message);

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

  div = document.createElement('div');
  div.setAttribute('id', 'controls-home');
  div.setAttribute('style', 'margin-top: 70px;');
  div.innerHTML = '<div class="big-instructions" style="padding-top: 0px;">We are ready.<br />'
                  + '<span style="color: #666;">Please send instructions.</span></div>'
                  + '<div class="small-instructions">'
                  + '<span id="sName" style="color:' + place.status + '; cursor: pointer;" onclick=showSettings()>' + place.name + '</span>'
                  + ' — updated <span id="timeagoStamp">' + d3.timestamp.ago(lastUpdated,true) + '</span></div>';
  chart.appendChild(div);


  div = document.createElement('div');
  div.setAttribute('class', 'actors');

  for (a = i = 0; i < devices.length; i++) {
    device = devices[i];
    entry = entries[device.deviceType] || entries['default'];
    if ((!entry) || (!entry.img)) continue;

    actor = document.createElement('div');
    actor.setAttribute('class', 'actor-home');
    actor.setAttribute('style', 'top:' + (actorRow * actorHeight) + 'px; left:' + (actorWidth * (a % 12)) + 'px;');
    actor.innerHTML = '<p class="actor-name" id="' + actor2ID(device.actor) + '-label" style="color: ' + statusColor(device) + '">' + device.name + '</p>';
    img = document.createElement('img');
    img.setAttribute('src', entry.img);
    img.setAttribute('id', actor2ID(device.actor));
    img.setAttribute('style', 'background-color:' + statusColor(device));
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
    tag.setAttribute('id', 'tag' + (a + 1));
    tag.setAttribute('onclick', 'javascript:goforw(tag_drilldown, "' + prop + '");');
    tag.innerHTML = prop.replace(/\s/g, '&nbsp;');
    div.appendChild(tag);
    span = document.createElement('span');
    span.innerHTML = ' '; // there's a space between quotes
    div.appendChild(span);
    if (++a >= 12) break;
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
  for (prop in categories) if (categories.hasOwnProperty(prop)) a++;
  a = (a >= 11) ? 0 : Math.floor((12 - a) / 2);
  for (prop in categories) if (categories.hasOwnProperty(prop)) {
    if (prop === "gateway" || prop === "indicator") continue;
    entry = entries[prop] || entries['default'];
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
    var actorID;
    lastUpdated = [];
    
    for (var i = 0; i < updates.length; i++) {
      if ((updates[i].info.whatami && updates[i].info.whatami.match(/\/device\/gateway\//)) ||
       (updates[i].whatami && updates[i].whatami.match(/\/device\/gateway\//))) {
        if (updates[i].level && updates[i].level === "alert") {
          alert(updates[i].message);
        }
      
        continue;
      
      }
      if (updates[i].whatami.match(/\/place/)) {
        lastUpdated.push(updates[i].updated);
        continue;
      }
      actorID = actor2ID(updates[i].whoami);
      if (document.getElementById(actorID)) {
        document.getElementById(actorID).style.backgroundColor = statusColor(updates[i]);
        document.getElementById(actorID + '-label').style.color = statusColor(updates[i]);
      }
      lastUpdated.push(updates[i].updated);
    }
    lastUpdated = lastUpdated.sort(function(a, b) {return b - a;})[0];
  }
};

var onUpdate_drilldown = function(updates) {
  var actor, arc, arcs, arcz, category, entry, i, j, update;
//  var arcColor = []; // save to calc contrasting overlaid text color
  for (i = 0; i < updates.length; i++) {
    update = updates[i];
    if (update.whatami.match(/\/device\/gateway\//)) continue;
    if (update.whatami.match(/\/place/)) {
      lastUpdated.push(update.updated);
      continue;
    }
    
    actors[update.whoami].info = update.info;
    actors[update.whoami].status = update.status;
    actors[update.whoami].updated = update.updated;
    
    entry = entries[update.whatami];
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
      document.getElementById("actor-big-icon").style.backgroundColor = statusColor(update);
      document.getElementById("actor-big-name").style.color = statusColor(update);
      document.getElementById("single-device-instructions").innerHTML = entry.instrux(currDevice.device);
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
  img.setAttribute('onclick', 'javascript:goback();');
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
       .attr('src', function(d, i) {return entries[devices[i].deviceType].img; })
       .style('background-color', function(d, i) {return statusColor(devices[i]); })
       .attr('class', 'actor-grouping')
       .attr('id', function(d, i) {return actor2ID(devices[i].actor) + "-tray-icon";})
       .attr('onclick', function(d, i) {return 'javascript:goforw(' + entries[devices[i].deviceType].single + ', "' + devices[i].actor + '");'; });
    
    div.appendChild(div3);
    
    if (pager) div.appendChild(pager);
    
    div2 = document.createElement('div');
    div2.setAttribute('class', 'multiple-instructions');
    div2.innerHTML = '<span class="actor-name" style="">' + name + '</span>'
                    + '<span>'
                    + instructions
                    + '</span>';
    div.appendChild(div2);
  } else {
    device = devices[0];
    currDevice.device = device;
    entry = entries[device.deviceType] || entries['default'];
    currDevice.entry = entry;
    div.innerHTML = '<div style="width: 155px; height: 155px; position: relative; left: 62px; overflow: hidden;"><img class="actor-big" id="actor-big-icon" style="background-color:' + statusColor(device) + ';" src="' + entry.img + '" /></div>'
                    + '<div id="toPopover" class="big-instructions">'
                    + '<span class="actor-name" id="actor-big-name" style="color:' + statusColor(device) + ';">' + name + '</span>'
                    + instructions
                    + '</div>';
  }
  chart.appendChild(div);
  if (document.getElementById("toPopover")) {
    document.getElementById("toPopover").setAttribute('onclick', 'javascript:showPop(currDevice.device , currDevice.entry);');
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
//  values = '';
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
     labels += arcs[i].label + '<br />';
//     values += '<div class="label">' + arcs[i].cooked + '</div>';
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
		var re = /\&deg;/gi;
		txt = txt.replace(re, "°");
		re = /\<sup\>2\<\/sup\>/gi;
		txt = txt.replace(re, "²");
		re = /\<sub\>2\<\/sub\>/gi;
		txt = txt.replace(re, "₂");
		re = /\&sigma;/gi;
		txt = txt.replace(re, "σ");
		return txt;
	}

};


var single_device_drilldown = function(state, arcs, instructions) {
  var device;

  device = actors[state.actor];
  device_drilldown(device.name, [ device ], arcs || single_device_arcs(device),
                   instructions || single_device_instructions(device));
};

var single_device_arcs = function(device) {
  var a0, a1, arcs, brightness, color, delta, level, now, prop, v;

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

      default:
        continue;
    }
    break;
  }

  return arcs;
};

var single_device_instructions = function(device) {
  var instructions;

  switch (device.status) {
    case 'present':
     return 'send alert';

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

var single_gateway_drilldown   = single_device_drilldown;
var gateway_device_arcs        = single_device_arcs;
var single_indicator_drilldown = single_device_drilldown;
var indicator_device_arcs      = single_device_arcs;
var single_sensor_drilldown    = single_device_drilldown;
var sensor_device_arcs         = single_device_arcs;


var single_climate_drilldown = function(state) {
  var device, instructions;

  device = actors[state.actor];
  instructions = single_climate_instructions(device);

  device_drilldown(device.name, [ device ], climate_device_arcs(device), instructions);
};

var single_climate_instructions = function(device) {
  instructions = 'show data for last week';
  return instructions;
};



var climate_device_arcs = function(device) {
  var arcs, now, prop, v;

  arcs = [];

  if (!device.info.lastSample) device.info.lastSample = device.updated;
  for (prop in device.info) {
    if (!device.info.hasOwnProperty(prop)) continue;

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
                          , cooked : v.toFixed(2) + '&deg;C' + ' / ' + ((v * 1.8) + 32).toFixed(2) + '&deg;F'
                          , value  : clip2bars(v, 18, 28)
                          , index  : 0.60
                          });
        break;

      case 'airQuality':
        arcs.splice(1, 0, { name   : prop
                          , raw    : v
                          , label  : 'QUALITY'
                          , cooked : v + '&sigma;'
                          , value  : clip2bars(-v, -5, 1.5)
                          , index  : 0.60
                          });
        break;

// 2nd ring
      case 'humidity':
        arcs.splice(2, 0, { name   : prop
                          , raw    : v
                          , label  : 'HUMIDITY'
                          , cooked : v + '%'
                          , value  : clip2bars(v, 21,  70)
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
                          , cooked : v + 'mb'
                          , value  : clip2bars(v, 50,  250)
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


// 3rd ring
      case 'co2':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'CO<sub>2</sub>'
                          , cooked : v + 'ppm'
                          , value  : clip2bars(v,  0, 1200)
                          , index  : 0.40
                          });
        break;

      case 'smoke':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'SMOKE'
                          , cooked : v + '&sigma;'
                          , value  : clip2bars(-v,  -5, 1.5)
                          , index  : 0.40
                          });
        break;

      case 'leaf':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'LEAF'
                          , cooked : v
                          , value  : clip2bars(v !== 'on' ? 0 : 100, 0, 100)
                          , index  : 0.40
                          });
        break;

      case 'light':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'LIGHT'
                          , cooked : v + 'lx'
                          , value  : clip2bars(v,  5000, 25000)
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

// 4th ring
      case 'noise':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'NOISE'
                          , cooked : v + 'dB'
                          , value  : clip2bars(v, 0, 70)
                          , index  : 0.30
                          });
        break;

      case 'co':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'CO'
                          , cooked : v + '&sigma;'
                          , value  : clip2bars(-v, -5, 1.5)
                          , index  : 0.40
                          });
        break;

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


// 5th ring
      case 'pressure':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'PRESSURE'
                          , cooked : v + 'mb'
                          , value  : clip2bars(v, 980,  1060)
                          , index  : 0.20
                          });
        break;

      case 'no2':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'NO<sub>2</sub>'
                          , cooked : v + 'ppm'
                          , value  : clip2bars(v,  0, 1200)
                          , index  : 0.20
                          });
        break;

      case 'away':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'AWAY'
                          , cooked : v
                          , value  : clip2bars(v !== 'on' ? 0 : 100, 0, 100)
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
// there should be a pop-up box available for this drilldown...

  return single_climate_drilldown(state);
};

var device_thermostat_arcs    = climate_device_arcs;


var single_lighting_drilldown = function(state) {
  var device, instructions;

  device = actors[state.actor];
  instructions = single_lighting_instructions(device);

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
// there should be a pop-up box available for this drilldown...

  var device, instructions;

  device = actors[state.actor];
  instructions = single_media_instructions(device);

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

var media_device_arcs = function(device) {
  var arcs, prop, text, v;

  arcs = [];

  v = device.status;
  arcs.push({ name   : 'status'
            , raw    : v
            , label  : 'STATUS'
            , cooked : v
            , value  : clip2bars(v === 'playing' ? 100 : v === 'idle' ? 0 : 50, 0, 100)
            , index  : 0.70
            });

  for (prop in device.info) {
    if (!device.info.hasOwnProperty(prop)) continue;

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
                          , value  : clip2bars ((text.length > 0) ? 100 : 0, 0, 100)
                          , index  : 0.60
                          });

        text = getTimeString(v.position);
        if ((text !== '') && (!!v.duration)) text += ' / ' + getTimeString(v.duration);
        arcs.splice(2, 0, { name   : 'position'
                          , raw    : v.pos || ''
                          , label  : 'POSITION'
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

  if (!v) return text;

  v = Math.round(v / 1000);

  text = ('0' + (v % 60)).substr(-2);
  v = Math.round(v / 60);

  if (v !== 0) {
    text = ('0' + (v % 60)).substr(-2) + ':' + text;
    v = Math.round(v / 60);
  } else text = '00:' + text;
  if (v !== 0) text = ('0' + v).substr(-2) +':' + text;

  return text;
};


var single_motive_drilldown = function(state) {
// there should be a pop-up box available for this drilldown...

  var device, instructions;

  device = actors[state.actor];
  instructions = single_motive_instructions(device);

  device_drilldown(device.name, [ device ], motive_device_arcs(device), instructions);
};

var single_motive_instructions = function(device) {
  instructions = (device.info.doors !== 'locked') ? 'lock doors' : 'unlock doors';
  instructions += '<br/>' + 'flash headlights<br/>' + 'honk horn<br/>' + 'adjust air conditioning';
  if (device.info.sunroof !== 'none') instructions += '<br/>' + 'adjust sunroof';
  return instructions
}

var motive_device_arcs = function(device) {
  var arcs, cooked, dist, prop, v;

  arcs = [];

  for (prop in device.info) {
    if (!device.info.hasOwnProperty(prop)) continue;

    v = device.info[prop];
    if ((!isNaN(v)) && typeof v === 'string') v = v * 1.0;
    switch (prop) {
      case 'location':
        if ((!!place.info) && (!!place.info.location) && (!!place.info.location[1])) {
          dist = getDistanceFromLatLonInKm(v[0], v[1], place.info.location[0], place.info.location[1]);
          cooked = (dist >= 1) ? (dist.toFixed(0) + ' km' + ' / ' + (dist / 1.60934).toFixed(0) + ' miles')
                               : (dist > 0) && (device.info.velocity > 0) ? 'nearby'
                               : place.name;
        } else {
          cooked = v.toString();
          dist = -1;
        }
        arcs.splice(0, 0, { name   : prop
                          , raw    : v
                          , label  : (dist > 1) ? 'DISTANCE' : 'LOCATION'
                          , cooked : cooked
                          , value  : clip2bars(dist > 0 ? dist : 0, 0, 4700)
                          , index  : 0.70
                          });
        break;

      case 'velocity':
        arcs.splice(1, 0, { name   : prop
                          , raw    : v
                          , label  : 'SPEED'
                          , cooked : (v > 0) ? ((v / 1000).toFixed(0) + ' kph' + ' / ' + (v * 2.23694).toFixed(0) + ' mph')
                                             : 'stationary'
                          , value  : clip2bars(v, 0, 50)
                          , index  : 0.60
                          });
        break;

      case 'heading':
        arcs.splice(2, 0, { name   : prop
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
                          , index  : 0.50
                          });
        break;

      case 'odometer':
        arcs.splice(3, 0, { name   : prop
                          , raw    : v
                          , label  : 'ODOMETER'
                          , cooked : v.toFixed(0) + ' km' + ' / ' + (v / 1.60934).toFixed(0) + ' miles'
                          , value  : clip2bars(v % 20000, 0, 20000)
                          , index  : 0.40
                          });
        break;

      case 'charger':
        arcs.splice(4, 0, { name   : prop
                          , raw    : v
                          , label  : 'CHARGER'
                          , cooked : v
                          , value  :   v === 'charging'      ? 0.50
                                     : v === 'regenerating'  ? 0.375
                                     : v === 'drawing'       ? 0
                                     : 0.25
                          , index  : 0.30
                          });
        break;

      case 'intTemperature':
        arcs.splice(5, 0, { name   : prop
                          , raw    : v
                          , label  : 'INTERIOR'
                          , cooked : v.toFixed(2) + '&deg;C' + ' / ' + ((v * 1.8) + 32).toFixed(2) + '&deg;F'
                          , value  : clip2bars(v,  17, 32)
                          , index  : 0.20
                          });
        break;

      default:
        continue;
    }
  }

  return arcs;
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


var single_presence_drilldown  = function(state) {
// there should be a pop-up box available for this drilldown...

  return single_device_drilldown(state);
};
var presence_device_arcs       = single_device_arcs;


var single_switch_drilldown    = function(state) {
// there should be a pop-up box available for this drilldown...

  return single_device_drilldown(state);
};

var switch_device_arcs         = single_device_arcs;


var single_wearable_drilldown  = function(state) {
// there should be a pop-up box available for this drilldown...

  return single_device_drilldown(state);
};

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
    entry = entries[device.deviceType] || entries['default'];
    if ((!entry) || (!entry.arcs)) continue;

    members.push(device);
  }

  multiple_drilldown(state.actor, members);
};

var category_climate_drilldown = function(state) {
  category_drilldown(state, '/device/climate/');
};

var category_gateway_drilldown = function(state) {
  category_drilldown(state, '/device/gateway');
};

var category_indicator_drilldown = function(state) {
  category_drilldown(state, '/device/indicator');
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
    entry = entries[device.deviceType] || entries['default'];
    if ((!entry) || (!entry.arcs)) continue;

    members.push(device);
  }

  multiple_drilldown(state.actor, members);
};


var set_multiple_labels_and_arcs = function() {

};

var multiple_drilldown = function(name, members) {
  var arc, arcs, arcz, device, devices, entry, i, index; 

  arcs = [];
  devices = [];
  index = 0.7;
  for (i = 0; i < members.length; i++) {
    device = members[i];
    entry = entries[device.deviceType] || entries['default'];
    if ((!entry) || (!entry.arcs)) continue;

    arcz = entry.arcs(device);

    arc = arcz[1] || {};
    arc.id = actor2ID(device.actor); // device.deviceType.split('/')[3] + ' ' + device.actor.split('/')[1];
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
      entry = entries[device.deviceType] || entries['default'];
      if (!!entry.single) entry.single({ page: entry.single, actor: device.actor });
      break;

    default:
      device_drilldown(name, devices, arcs, 'touch a thing to manage it');
      break;
  }
};

// managing multi-drilldown icon display and control

var handleArrowVisibility = function() {
	var viewPortWidth = parseInt(document.getElementById("device-viewport").style.width, 10);
	var trayWidth = parseInt(document.getElementById("image-tray").style.width, 10);
	var trayLeft = parseInt(document.getElementById("image-tray").style.left, 10);
    var trayPage = Math.abs(trayLeft / viewPortWidth);
    document.getElementById("bullet" + trayPage).className = "bullet-on";
    lastIconTrayPage = trayPage + 1;
    
	if (trayLeft >= 0) {
		document.getElementById("right-arrow").style.display = "none";
	} else {
		document.getElementById("right-arrow").style.display = "block";
	}
	if (trayWidth + trayLeft <= viewPortWidth) {
		document.getElementById("left-arrow").style.display = "none";
	} else {
		document.getElementById("left-arrow").style.display = "block";
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
	leftEnd = ((evt.target.id === 'left-arrow') ? (startLeft - viewPortWidth) : (startLeft + viewPortWidth));
	
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

/*
  drone.svg
  ecobee.svg
  electric-vehicle.svg
  home.svg
  insteon-water.svg
  motrr.svg
  romo.svg
  swivl.svg
 */

var entries = {
// actors
                '/device/climate/arduino/sensor'            : { img     : 'actors/arduino.svg'
                                                              , single  : single_climate_drilldown
                                                              , arcs    : climate_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/climate/grove/air-quality'         : { img     : 'actors/grove.svg'
                                                              , single  : single_climate_drilldown
                                                              , arcs    : climate_device_arcs
                                                              , instrux : no_instructions
                                                              }
              , '/device/climate/datasensinglab/air-quality': { img     : 'actors/data-sensing-lab.svg'
                                                              , single  : single_climate_drilldown
                                                              , arcs    : climate_device_arcs
                                                              , instrux : no_instructions
                                                              }
              , '/device/climate/koubachi/plant'            : { img     : 'actors/koubachi-plant.svg'
                                                              , single  : single_climate_drilldown
                                                              , arcs    : climate_device_arcs
                                                              , instrux : no_instructions
                                                              }
              , '/device/climate/koubachi/sensor'           : { img     : 'actors/koubachi.svg'
                                                              , single  : single_climate_drilldown
                                                              , arcs    : climate_device_arcs
                                                              , instrux : no_instructions
                                                              }
              , '/device/climate/ecobee/control'            : { img     : 'actors/ecobee.svg'
                                                              , single  : single_thermostat_drilldown
                                                              , arcs    : device_thermostat_arcs
                                                              , instrux : single_thermostat_instructions
                                                              }
              , '/device/climate/nest/control'              : { img     : 'actors/nest.svg'
                                                              , single  : single_thermostat_drilldown
                                                              , arcs    : device_thermostat_arcs
                                                              , instrux : single_thermostat_instructions
                                                              }
              , '/device/climate/netatmo/sensor'            : { img     : 'actors/netatmo.svg'
                                                              , single  : single_climate_drilldown
                                                              , arcs    : climate_device_arcs
                                                              , instrux : single_climate_instructions
                                                              }
              , '/device/climate/oregon-scientific/sensor'  : { img     : 'actors/oregon-scientific.svg'
                                                              , single  : single_climate_drilldown
                                                              , arcs    : climate_device_arcs
                                                              , instrux : single_climate_instructions
                                                             }
              , '/device/gateway/insteon/hub'               : { img     : 'actors/insteon-hub.svg'
                                                              , single  : single_gateway_drilldown
                                                              , arcs    : gateway_device_arcs
                                                              }
              , '/device/gateway/insteon/smartlinc'         : { img     : 'actors/smart-linc.svg'
                                                              , single  : single_gateway_drilldown
                                                              , arcs    : gateway_device_arcs
                                                              }
              , '/device/gateway/netatmo/cloud'             : { img     : 'actors/netatmo.svg'
                                                              , single  : single_gateway_drilldown
                                                              , arcs    : gateway_device_arcs
                                                              }
              , '/device/gateway/rfxrec433/usb'             : { img     : 'actors/rfxcom.svg'
                                                              , single  : single_gateway_drilldown
                                                              , arcs    : gateway_device_arcs
                                                              }
              , '/device/gateway/sonos/bridge'              : { img     : 'actors/sonos-bridge.svg'
                                                              , single  : single_gateway_drilldown
                                                              , arcs    : gateway_device_arcs
                                                              }
              , '/device/gateway/zigbee/gmo'                : { img     : 'actors/q53.svg'
                                                              , single  : single_gateway_drilldown
                                                              , arcs    : gateway_device_arcs
                                                              }
              , '/device/indicator/text/xively'             : { img     : 'actors/xively.svg'
                                                              , single  : single_indicator_drilldown
                                                              , arcs    : indicator_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/indicator/text/prowl'              : { img     : 'actors/prowl.svg'
                                                              , single  : single_indicator_drilldown
                                                              , arcs    : indicator_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/indicator/text/status'             : { img     : 'actors/HTML5.svg'
                                                              , single  : single_indicator_drilldown
                                                              , arcs    : indicator_device_arcs
                                                              }
              , '/device/lighting/blink1/led'               : { img     : 'actors/blink1.svg'
                                                              , single  : single_lighting_drilldown
                                                              , arcs    : lighting_device_arcs
                                                              , instrux : single_lighting_instructions
                                                              }
              , '/device/lighting/blinkstick/led'           : { img     : 'actors/blinkstick.svg'
                                                              , single  : single_lighting_drilldown
                                                              , arcs    : lighting_device_arcs
                                                              , instrux : single_lighting_instructions
                                                              }
              , '/device/lighting/hue/bloom'                : { img     : 'actors/hue-bloom.svg'
                                                              , single  : single_lighting_drilldown
                                                              , arcs    : lighting_device_arcs
                                                              , instrux : single_lighting_instructions
                                                              }
              , '/device/lighting/hue/bulb'                 : { img     : 'actors/hue.svg'
                                                              , single  : single_lighting_drilldown
                                                              , arcs    : lighting_device_arcs
                                                              , instrux : single_lighting_instructions
                                                              }
              , '/device/lighting/hue/lightstrip'           : { img     : 'actors/hue-lightstrip.svg'
                                                              , single  : single_lighting_drilldown
                                                              , arcs    : lighting_device_arcs
                                                              , instrux : single_lighting_instructions
                                                              }
              , '/device/lighting/insteon/led'              : { img     : 'actors/insteon-led.svg'
                                                              , single  : single_lighting_drilldown
                                                              , arcs    : lighting_device_arcs
                                                              , instrux : single_lighting_instructions
                                                              }
              , '/device/lighting/robosmart/led'            : { img     : 'actors/robosmart.svg'
                                                              , single  : single_lighting_drilldown
                                                              , arcs    : lighting_device_arcs
                                                              , instrux : single_lighting_instructions
                                                              }
              , '/device/media/appletv/video'               : { img     : 'actors/appletv.svg'
                                                              , single  : single_media_drilldown
                                                              , arcs    : media_device_arcs
                                                              , instrux : single_media_instructions
                                                              }
              , '/device/media/chromecast/video'            : { img     : 'actors/chromecast.svg'
                                                              , single  : single_media_drilldown
                                                              , arcs    : media_device_arcs
                                                              , instrux : single_media_instructions
                                                              }
              , '/device/media/sonos/audio'                 : { img     : 'actors/sonos-playbar.svg'
                                                              , single  : single_media_drilldown
                                                              , arcs    : media_device_arcs
                                                              , instrux : single_media_instructions
                                                              }
              , '/device/media/roku/video'                  : { img     : 'actors/roku3.svg'
                                                              , single  : single_media_drilldown
                                                              , arcs    : media_device_arcs
                                                              , instrux : single_media_instructions
                                                              }
              , '/device/motive/tesla/model-s'              : { img     : 'actors/tesla-motors.svg'
                                                              , single  : single_motive_drilldown
                                                              , arcs    : motive_device_arcs
                                                              , instrux : single_motive_instructions
                                                              }
              , 'device/presence/fob/hone'                  : { img     : 'actors/hone.svg'
                                                              , single  : single_presence_drilldown
                                                              , arcs    : presence_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/presence/fob/inrange'              : { img     : 'actors/philips-inrange.svg'
                                                              , single  : single_presence_drilldown
                                                              , arcs    : presence_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/presence/fob'                      : { img     : 'actors/presence-fob.svg'
                                                              , single  : single_presence_drilldown
                                                              , arcs    : presence_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/sensor/arduino/seated-mat'         : { img     : 'actors/arduino.svg'
                                                              , single  : single_sensor_drilldown
                                                              , arcs    : sensor_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/sensor/arduino/water'              : { img     : 'actors/arduino.svg'
                                                              , single  : single_sensor_drilldown
                                                              , arcs    : sensor_device_arcs
                                                              , instrux : single_device_instructions
                                                             }
              , '/device/sensor/grove/water'                : { img     : 'actors/grove.svg'
                                                              , single  : single_sensor_drilldown
                                                              , arcs    : sensor_device_arcs
                                                              , instrux : single_device_instructions
                                                             }
              , '/device/sensor/texas-instruments/sensortag': { img     : 'actors/ti-sensor.svg'
                                                              , single  : single_sensor_drilldown
                                                              , arcs    : sensor_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/sensor/wemo/motion'                : { img     : 'actors/wemo-sensor.svg'
                                                              , single  : single_sensor_drilldown
                                                              , arcs    : sensor_device_arcs
                                                              , instrux : no_instructions
                                                              }
              , '/device/switch/insteon/dimmer'             : { img     : 'actors/insteon-dimmer.svg'
                                                              , single  : single_switch_drilldown
                                                              , arcs    : switch_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/switch/insteon/onoff'              : { img     : 'actors/insteon-plug.svg'
                                                              , single  : single_switch_drilldown
                                                              , arcs    : switch_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/switch/wemo/onoff'                 : { img     : 'actors/wemo-plug.svg'
                                                              , single  : single_switch_drilldown
                                                              , arcs    : switch_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/wearable/watch/cookoo'             : { img     : 'actors/cookoo.svg'
                                                              , single  : single_wearable_drilldown
                                                              , arcs    : wearable_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , '/device/wearable/watch/metawatch'          : { img     : 'actors/metawatch.svg'
                                                              , single  : single_wearable_drilldown
                                                              , arcs    : wearable_device_arcs
                                                              , instrux : single_device_instructions
                                                              }
              , 'default'                                   : { img     : 'actors/t.svg'
                                                              , single  : single_device_drilldown
                                                              , arcs    : single_device_arcs
                                                              , instrux : single_device_instructions
                                                              }

// categories
              , climate                                     : { img     : 'categories/climate.svg'
                                                              , single  : category_climate_drilldown
                                                              }
              , gateway                                     : { img     : 'categories/gateway.svg'
                                                              , single  : category_gateway_drilldown
                                                              }
              , indicator                                   : { img     : 'categories/indicator.svg'
                                                              , single  : category_indicator_drilldown
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
              };
