var bigSliderKnob = { "diam": 22 };
var bigSlider = { "min": 310, "max": 39 };
var bigHorSlider = { "min": 220, "max": 400 };
var onOffKnob = { "diam": 18 };
var onOffSlider = { "min": 25, "max": 71 - onOffKnob.diam };
var newPerform = { "path":"", "requestID":"2", "perform":"", "parameter":{} };

// d3 drag functions
var drag = d3.behavior.drag()
    .origin(Object)
    .on("drag", dragmove)
    .on("dragend", sendData);

function dragmove(d) {
	var max, min, bx1, bx2, by1, by2, elem;
	var elemID = d3.event.sourceEvent.target.id;
	switch(elemID) {
	
		case "brightness-knob":
		case "brightness":
			max = bigSlider.max; // brightness div top minus half button height
			min = bigSlider.min; // brightness div bottom minus button height
			d3.select(this).style("top", function() { 
				by1 = parseInt(d3.select(this).style("top"));
				by2 = by1 + d3.event.dy;
				if (by2 > max && by2 < min) {
					by1 = by2;
				}
				var pct = 100 - parseInt(((by1 - max + 1)/(min - max)) * 100);
				d3.select("#slider-readout").text(pct + "%").style("top", by1 + 7 + "px");
				newPerform.parameter.brightness = pct;
				return by1 + "px";
			});
			break;
    	case "volume-control-indicator":
			var currAngle = 0;
			elem = d3.event.sourceEvent.target;
			var exy = [d3.event.sourceEvent.offsetX, d3.event.sourceEvent.offsetY];
			//      console.log("exy:" + exy[0] + "," + exy[1]);
			var dxy = [elem.width/2, elem.height/2];
			var angle = (angleBetweenPoints(exy, dxy) * (180/Math.PI));
			if (elem.style.transform) {
			  currAngle = parseFloat(elem.style.transform.match(/\-*\d*\.*\d+/));
			} else if (elem.style.webkitTransform) {
			  currAngle = parseFloat(elem.style.webkitTransform.match(/\-*\d*\.*\d+/));
			}
			
			var rotateAngle = (angle + currAngle + 40)%360;
			if (rotateAngle > -10 && rotateAngle < 280) {
  			  d3.select(this)
			    .style("-webkit-transform", "rotate(" + rotateAngle + "deg)")
			    .style("transform", "rotate(" + rotateAngle + "deg)");
			}
			rotateAngle = ((rotateAngle + 10) / 280) * 100;
			rotateAngle = Math.max(rotateAngle, 0);
			rotateAngle = Math.min(rotateAngle, 100);
			newPerform.parameter.volume = rotateAngle;
			break;
		case "track-progress-knob":
			max = 500;
			min = 0;
			d3.select(this).style("left", function() { 
				bx1 = parseInt(d3.select(this).style("left"));
				bx2 = bx1 + d3.event.dx;
				bx2 = Math.max(bx2, min);
				bx2 = Math.min(bx2, max);
				var pct = bx2/(max - min);
				newPerform.parameter.track.position = parseInt((newPerform.parameter.track.duration * pct), 10);
				return bx2 + "px";
			});
			break;
		case "temperature-knob":
        	var tempFRange = {min: 40, max: 100};
			max = 340;
			min = 0;
			d3.select(this).style("left", function() { 
				bx1 = parseInt(d3.select(this).style("left"));
				bx2 = bx1 + d3.event.dx;
				bx2 = Math.max(bx2, min);
				bx2 = Math.min(bx2, max);
				var pct = bx2/(max - min);
				var fahr = (pct * (tempFRange.max - tempFRange.min)) + tempFRange.min;
				var cels = ((fahr - 32) * 5) / 9;
				d3.select("#temperature-readout").html(fahr.toFixed(1) + "&deg;F").style("left", bx2 - 5 + "px");
				newPerform.parameter.goalTemperature = cels;
				
				return bx2 + "px";
			});
			break;
		case "fantime-knob":
			max = bigSlider.max; // brightness div top minus half button height
			min = bigSlider.min; // brightness div bottom minus button height
			d3.select(this).style("top", function() { 
				by1 = parseInt(d3.select(this).style("top"));
				by2 = by1 + d3.event.dy;
				if (by2 > max && by2 < min) {
					by1 = by2;
				}
				var pct = 100 - parseInt(((by1 - max + 1)/(min - max)) * 100);
				d3.select("#fantime-slider-readout").style("top", by1 + 7 + "px");
				d3.select("#fantime-readout").text(parseInt((pct * 90 / 100), 10));
				newPerform.parameter.fan = (pct * 90 / 100) * 60 * 1000;
				return by1 + "px";
			});
			break;
		case "level-knob":
			max = 420;
			min = 105;
			d3.select(this).style("left", function() { 
				bx1 = parseInt(d3.select(this).style("left"));
				bx2 = bx1 + d3.event.dx;
				bx2 = Math.max(bx2, min);
				bx2 = Math.min(bx2, max);
				var pct = (bx2 - min)/(max - min);
				newPerform.parameter.level = parseInt((pct * 100), 10);
				return bx2 + "px";
			});
			break;
		default:
			break;
    }
    
    function angleBetweenPoints(p1, p2) {
      if (p1[0] == p2[0] && p1[1] == p2[1])
        return Math.PI / 2;
      else
        return Math.atan2(p2[1] - p1[1], p2[0] - p1[0] );
     }
}


var showPop = function(device, entry) {
  // Popover window positioning/dimensions
  var w, h, t, l;

  switch (device.deviceType.match(/\/\w*\/\w*\//)[0]) {
	case "/device/lighting/":
		w = 485, h = 497, t = 100, l = 133;
		break;
	case "/device/switch/":
		w = 485, h = 497, t = 290, l = 133;
		break;
	default:
		w = 598, h = 497, t = 100, l = 83;
		break
  }

//   console.log("showPop() for device=" + JSON.stringify(device));
//   console.log("showPop() for entry=" + JSON.stringify(entry));
   
   var deviceID = device.actor.slice(device.actor.lastIndexOf("/"));
   newPerform.path = "/api/v1/device/perform" + deviceID;
   newPerform.parameter = device.info;

   d3.select("body").append("div")
     .attr("id", "blocker")
     .style("position", "absolute")
     .style("width", "758px")
     .style("height", "758px")
     .style("top", "0px")
     .style("left", "0px")
     .style("background-image", "url(popovers/assets/blocker.svg)");
     
   var pop = d3.select("body").append("div")
     .attr("id", "pop-substrate")
     .style("left", l + "px")
     .style("top", t + "px");
   
   
   pop.append("img")
     .attr("id", "popBg")
     .attr("src", function() {return popoverBG(device);})
     .style("position", "absolute")
     .attr("width", "0")
     .attr("height", "0")
     .style("top", w / 2 + "px")
     .style("left", h / 2 + "px")
     .transition().each("end", finishPopover(device, entry))
     .duration(600)
     .attr("width", w)
     .attr("height", h)
     .style("top", "0px")
     .style("left", "0px");

	
	function popoverBG(device) {
		switch (device.deviceType.match(/\/\w*\/\w*\//)[0]) {
			case "/device/lighting/":
				return "popovers/assets/window.square.svg";
				break;
			case "/device/media/":
				return "popovers/assets/window.two-panel.bkg.svg";
				break;
			case "/device/climate/":
				return "popovers/assets/window.three-panel.bkg.svg";
				break;
			case "/device/switch/":
				return "popovers/assets/window.short.popover.svg";
				break;
			default:
				return "popovers/assets/window.two-panel.bkg.svg";
				break;
		}	
	}
    
	function finishPopover(device, entry) {
		switch (entry.pop) {
			case "lighting_pop":
				return finishLighting;
				break;
			case "media_pop":
				return finishMedia;
				break;
			case "thermostat_pop":
			    return finishClimate;
				break;
			case "switch_pop":
				return finishSwitch;
				break;
			default:
				return finishEmpty;
				break;
		}
	}
	
   function finishLighting() {
       var div, elem;
       finishCommon("done-narrow");
       finishStatus();
       
       div = pop.append("div")
         .attr("id", "on-off-slider-wrapper");
       div.append("div")
         .attr("class", "on-off-slider")
         .append("img")
           .attr("src", "popovers/assets/slider.on-off.svg")
           .on("click", toggleOnOff);
       div.append("div")
         .attr("class", "on-off-knob")
         .attr("id", "on-off-knob")
         .style("left", function() { return ((device.status === "on") ? onOffSlider.max : onOffSlider.min) + "px" })
         .on("click", toggleOnOff)
         .append("img")
           .attr("src", "popovers/assets/knob.small.svg");
       div.append("div")
         .attr("class", "on-label small-label")
         .text("ON");
       div.append("div")
         .attr("class", "off-label small-label")
         .text("OFF");
       
       var hasBrightness = device.info.hasOwnProperty("brightness");
       div = pop.append("div")
         .attr("id", "brightness-slider-wrapper");
       div.append("div")
         .attr("class", "slider-grid")
         .append("img")
           .attr("src", "popovers/assets/grid.svg");
       div.append("div")
         .attr("id", "brightness")
         .attr("class", "slider")
         .append("img")
           .attr("src", "popovers/assets/slider.large.svg");
       elem = div.append("img")
         .attr("id", "brightness-knob")
         .attr("class", "slider-knob")
         .attr("src", function() {return (hasBrightness) ? "popovers/assets/knob.large.svg" :  "popovers/assets/knob.large.off.svg"});
       if (hasBrightness) {
		   elem
			.style("left", "50px")
			.style("top", bigSlider.min + "px")
			.transition()
			.duration(600)
			.style("top", hueBrightTop(device.info.brightness));
		   elem.call(drag);
       } else {
		   elem
			.style("left", "50px")
			.style("top", bigSlider.max + "px");
       }
       div.append("div")
         .attr("class", function() {return (hasBrightness) ? "slider-label label" : "slider-label label-disabled"})
         .text("BRIGHTNESS");
       if (hasBrightness) {
		   div.append("div")
			 .attr("id", "slider-readout")
			 .attr("class", "slider-readout small-label")
			 .style("top", parseInt(hueBrightTop(device.info.brightness)) + 7 + "px")
			 .text( device.info.brightness + "%");
       } else {
       		div.append("div")
			 .attr("id", "slider-readout")
			 .attr("class", "slider-readout small-label")
			 .style("top", bigSlider.max + 7 + "px")
			 .text("100%");
       }
       newPerform.perform = device.status;
       
       ColorPickerMgr.addColorPicker(pop, device.info);
   }
   
   function finishMedia() {
     var div, elem, disabled = "-disabled";
     switch(device.status) {
    	case "playing":
    	  newPerform.perform = "play";
    	  break;
    	case "paused":
    	  newPerform.perform = "pause";
    	  break;
    	default:
    	  newPerform.perform = "stop";
    	  break;
     }
     finishCommon("done-wide");
     finishStatus();
     
     div = pop.append("div")
       .attr("id", "metadata-wrapper");
     div.append("div")
       .attr("class", "now-playing-label small-label")
       .text("NOW PLAYING");
     div.append("div")
       .attr("class", "display-album" + hasTrackProperty("album"))
       .append("span")
         .attr("id", "display-album")
         .attr("class", "label-padding")
         .text("album");
     div.append("div")
       .attr("class", "display-artist" + hasTrackProperty("artist"))
       .append("span")
         .attr("id", "display-artist")
         .attr("class", "label-padding")
         .text("artists");
     div.append("div")
       .attr("class", "display-track" + hasTrackProperty("title"))
       .append("span")
         .attr("id", "display-track")
         .attr("class", "label-padding")
         .text("track");
     
     function hasTrackProperty(property) {
       var result = "";
       if (device.info.track) {
       	 if (!device.info.track.hasOwnProperty(property)) result = "-disabled";
       }
       return result;
     }
     
     function hasTrackInfo(property, value) {
       var result = value;
       if (device.info.track) {
         if (device.info.track.hasOwnProperty(property)) {
           result = device.info.track[property];
         }
       }
       return result;
     }
     
     if (device.info.volume) {
		 div = pop.append("div")
		   .attr("id", "volume-control-wrapper");
		 div.append("div")
		   .attr("class", "volume-control-knob")
		   .append("img")
			 .attr("id", "volume-control-knob")
			 .attr("src", "popovers/assets/volume.control.bkg.svg");
		 div.append("div")
		   .attr("class", "volume-control-bkg")
		   .append("img")
			 .attr("id", "volume-control-bkg")
			 .attr("src", "popovers/assets/volume.control.svg");
		 div.append("div")
		   .attr("class", "volume-control-indicator")
		   .append("img")
			 .attr("id", "volume-control-indicator")
			 .attr("src", "popovers/assets/volume.control.indicator.png")
			 .style("transform", "rotate(" + calcVolRotation() + "deg)")
			 .style("-webkit-transform", "rotate(" + calcVolRotation() + "deg)")
			 .call(drag);
     }
     
     function calcVolRotation() {
       var result = -10; // zero point, to be corrected in art
       var number11 = 280; // Max rotation
       result += (device.info.volume / 100) * number11;
       return result;
     }
     
     if (device.info.hasOwnProperty("track") && device.info.track.hasOwnProperty("position")) {
		 div = pop.append("div")
		   .attr("id", "track-progress-wrapper");
		 div.append("div")
		   .attr("class", "track-progress")
		   .append("img")
			 .attr("id", "track-progress-knob")
			 .attr("class", "track-progress-knob")
			 .style("left", calcTrackProgress() + "px")
			 .attr("src", "popovers/assets/track-progress-knob.svg")
			 .call(drag);
		 div.append("div")
		   .attr("id", "track-progress-label")
		   .attr("class", "track-progress-label small-label")
		   .text("TRACK PROGRESS");
     }
     
     function calcTrackProgress() {
       var result = 0;
       var theEnd = 500; // Max track position
       if (parseFloat(device.info.track.duration) > 0) {
         result = (parseFloat(device.info.track.position)/parseFloat(device.info.track.duration)) * theEnd;
       }
       return result
     }

     div = pop.append("div")
       .attr("id", "media-controls-wrapper");
     div.append("div")
       .attr("class", "media-button-two")
       .append("img")
         .attr("id", "media-button-two")
         .attr("class", "media-button-big")
         .attr("src", function() {return (device.status === "playing") ? "popovers/assets/media-button-two.svg" : "popovers/assets/media-button-two-off.svg";})
         .on("click", function() {mediaPlay(event)});
     div.append("div")
       .attr("class", "media-button-three")
       .append("img")
         .attr("id", "media-button-three")
         .attr("class", "media-button-big")
         .attr("src", function() {return (device.status === "paused") ? "popovers/assets/media-button-three.svg" : "popovers/assets/media-button-three-off.svg";})
         .on("click", function() {mediaPause(event)});
     if (device.info.muted) {
		 div.append("div")
		   .attr("class", "media-button-four")
		   .append("img")
			 .attr("id", "media-button-four")
			 .attr("class", "media-button-big")
			 .attr("src", function() {return (device.info.muted === "off") ? "popovers/assets/media-button-five-on.svg" : "popovers/assets/media-button-five-off.svg";})
			 .on("click", function() {mediaToggleMute(event)});
     }
   }
   
   function finishClimate() {
     var div, div2, elem;
     newPerform.perform = "set";
     
     div = pop.append("div")
       .attr("id", "primary-controls");
     div.append("div")
       .attr("id", "actor")
       .append("img")
         .attr("src", function(d, i) {return "popovers/assets/" + entries[device.deviceType].img; })
         .attr("width", "43px");
     div.append("div")
       .attr("class", "popover-name")
       .attr("id", "popover-name")
       .text("Climate Control");
       
     if (device.info.hvac) {
		 div.append("div")
		   .attr("class", "label")
		   .append("img")
		     .attr("id", "button-one")
			 .attr("src", function() {return (device.info.hvac === "off") ? "popovers/assets/off-button.svg" : "popovers/assets/off-button-off.svg"} )
			 .attr("height", "22px")
			 .on("click", function() {climateTogglehvac(event, "off")});
		 div.append("div")
		   .attr("class", "label")
		   .append("img")
		     .attr("id", "button-two")
			 .attr("src", function() {return (device.info.hvac === "fan") ? "popovers/assets/fan-button.svg" : "popovers/assets/fan-button-off.svg"} )
			 .attr("height", "22px")
			 .on("click", function() {climateTogglehvac(event, "fan")});;
		 div.append("div")
		   .attr("class", "label")
		   .append("img")
		     .attr("id", "button-three")
			 .attr("src", function() {return (device.info.hvac === "cool") ? "popovers/assets/cool-button.svg" : "popovers/assets/cool-button-off.svg"} )
			 .attr("height", "22px")
			 .on("click", function() {climateTogglehvac(event, "cool")});;
		 div.append("div")
		   .attr("class", "label")
		   .append("img")
		     .attr("id", "button-four")
			 .attr("src", function() {return (device.info.hvac === "heat") ? "popovers/assets/heat-button.svg" : "popovers/assets/heat-button-off.svg"} )
			 .attr("height", "22px")
			 .on("click", function() {climateTogglehvac(event, "heat")});;
     }
     div.append("div")
       .attr("id", "done-climate")
       .attr("class", "label")
       .append("img")
         .attr("src", "popovers/assets/done_on.svg")
         .attr("height", "22px")
         .on("click", cancel);
     
     function climateTogglehvac(event, type) {
       elem = event.target;
       document.getElementById("button-one").src = "popovers/assets/off-button-off.svg";
       document.getElementById("button-two").src = "popovers/assets/fan-button-off.svg";
       document.getElementById("button-three").src = "popovers/assets/cool-button-off.svg";
       document.getElementById("button-four").src = "popovers/assets/heat-button-off.svg";
       elem.src = "popovers/assets/" + type + "-button.svg";
       newPerform.parameter.hvac = type;
       sendData();
     }
     
     
     div = pop.append("div")
       .attr("id", "temperature-wrapper");
     div.append("div")
       .attr("class", "temperature-label label")
       .text("TEMPERATURE SETTING");
     div2 = div.append("div")
       .attr("class", "temperature")
       .style("background-color", "#000");
     elem = div2.append("img")
         .attr("id", "temperature-knob")
         .attr("class", "temperature-knob")
         .attr("src", "popovers/assets/knob.svg");
	 elem
	     .style("position", "absolute")
	     .style("left", "0px")
         .transition()
         .duration(600)
         .style("left", goalTempLeft(device.info.goalTemperature) + "px");
     elem.call(drag);
     div2.append("div")
         .attr("id", "temperature-readout")
         .attr("class", "temperature-readout medium-label")
         .style("left", (goalTempLeft(device.info.goalTemperature) - 10) + "px")
         .text((((parseInt(device.info.goalTemperature, 10) * 9) / 5) + 32).toFixed(1) + "°F");
         
     function goalTempLeft(goalTempC) {
		var result = 0;
		var goalTempF = ((parseFloat(goalTempC) * 9) / 5) + 32;
		var elemEdges = {min: 0, max: 340};
		var tempFRange = {min: 40, max: 100};
		result = (goalTempF / (tempFRange.max + tempFRange.min)) * elemEdges.max;
		return result;
     }
     
     var timedFan = (device.info.fan && (device.info.fan !== "auto") && (device.info.fan !== "on"));
     div = pop.append("div")
       .attr("id", "fantime-slider-wrapper");
     div.append("div")
         .attr("class", function() {return (timedFan) ? "slider-label label" : "slider-label label-disabled"})
         .text("FAN TIME");
     div.append("div")
       .attr("class", "slider-grid")
       .append("img")
         .attr("src", "popovers/assets/grid.svg");
     div.append("div")
       .attr("id", "fantime")
       .attr("class", "slider")
       .append("img")
         .attr("src", "popovers/assets/slider.large.svg");
     if (timedFan) {
		 elem = div.append("img")
		   .attr("id", "fantime-knob")
		   .attr("class", "slider-knob")
		   .attr("src", "popovers/assets/knob.large.svg");
		 elem
		   .style("left", "50px")
		   .style("top", bigSlider.min + "px")
		   .transition()
		   .duration(600)
		   .style("top", fanTimeTop(device.info.fan));
		 elem.call(drag);
		 
		 elem = div.append("div")
		   .attr("id", "fantime-slider-readout")
		   .attr("class", "slider-readout")
		   .style("top", parseInt(fanTimeTop(device.info.fan)) + 7 + "px");
		 elem.append("span")
			 .attr("class", "label")
			 .attr("id", "fantime-readout")
			 .text(parseInt((device.info.fan / 60 / 1000), 10));
		 elem.append("br");
		 elem.append("span")
			 .attr("class", "small-label")
			 .text("MIN");
     } else {
		 elem = div.append("img")
		   .attr("id", "fantime-knob")
		   .attr("class", "slider-knob")
		   .attr("src", "popovers/assets/knob.large.off.svg");
		 elem
		   .style("left", "50px")
		   .style("top", bigSlider.min + "px");
		 
		 elem = div.append("div")
		   .attr("id", "fan-slider-readout")
		   .attr("class", "slider-readout")
		   .style("top", bigSlider.min + 7 + "px");
		 elem.append("span")
			 .attr("class", "label-disabled")
			 .attr("id", "fantime-readout")
			 .text("0");
		 elem.append("br");
		 elem.append("span")
			 .attr("class", "small-label")
			 .text("MIN");
     }
         
     function fanTimeTop(value) {
		var max = bigSlider.max;
		var min = bigSlider.min;
		value = parseInt((value / 1000/ 60), 10);
		var top = ((min-max) * ((100-value) / 100) + max);
		return top + "px";
     };

	 colorRange = {temp  :  [7.2, 12.8, 18.3, 23.9, 29.4, 35],
	               color :  ["#529dcc", "#43be93", "#0ea74b", "#b2cb25", "#f47f1f", "#ee3324"]};
     div = pop.append("div")
       .attr("id", "thermostat-wrapper");
     div.append("img")
         .attr("id", "thermostat-knob")
         .attr("src", "popovers/assets/thermostat.no.ring.svg")
         .attr("width", "310px");
     var canvas = div.append("svg")
       .attr("width", 310)
       .attr("height", 310)
       .style("position", "absolute")
       .style("top", "0px")
       .style("left", "0px");
     var group = canvas.append("g")
       .attr("transform", "translate(155,155)");
     var r = 110;
     var p = ((parseFloat(device.info.temperature) * 6.28) / 33.4) - 1.1; //Math.PI * 1.92;
     var arc = d3.svg.arc()
    	.innerRadius(r - 12)
    	.outerRadius(r)
    	.startAngle(-0.25)
    	.endAngle(p);
     group.append("path")
    	.style("fill", function() {
    	   var result = colorRange.color[colorRange.color.length - 1]; 
    	   for (var i = 0; i < colorRange.temp.length; i++) {
    	     if (parseFloat(device.info.temperature) > colorRange.temp[i]) {
    	       result = colorRange.color[i];
    	     }
    	   }
    	   return result;
    	 })
    	.attr("d", arc);

   }

   function finishSwitch() {
     var div, elem;
     newPerform.perform = device.status;
     finishCommon("done-narrow");
     
     var hasLevel = device.info.hasOwnProperty("level");
     div = pop.append("div")
       .attr("id", "level-status-wrapper");
     div.append("div")
       .attr("class", function() {return (hasLevel) ? "level-status-label label" : "level-status-label label-disabled"})
       .text("LEVEL");
     div.append("div")
         .attr("class", "level-status-grid")
         .append("img")
           .attr("src", "popovers/assets/grid.horizontal.svg")
           .style("height", "45px");
     div.append("div")
         .attr("class", "level-status")
         .append("img")
           .attr("src", "popovers/assets/slider.long.horizontal.svg");
     
     elem = div.append("img")
     	.attr("class", "level-knob")
        .attr("id", "level-knob")
     	.attr("src", function() {return (hasLevel) ? "popovers/assets/knob.large.svg" :  "popovers/assets/knob.large.off.svg"});
     if (hasLevel) {
		   elem
			.style("left", bigHorSlider.min + "px")
			.transition()
			.duration(600)
			.style("left", levelLeft(device.info.level));
		   elem.call(drag);
     } else {
		   elem
			.style("left", bigHorSlider.max + "px");
     
     }
// If we decide to add readout box to level slider
//      if (hasLevel) {
// 		   div.append("div")
// 			 .attr("id", "slider-readout")
// 			 .attr("class", "slider-readout small-label")
// 			 .style("left", parseInt(levelLeft(device.info.level)) + 7 + "px")
// 			 .text( device.info.level + "%");
//      } else {
//        		div.append("div")
// 			 .attr("id", "slider-readout")
// 			 .attr("class", "slider-readout small-label")
// 			 .style("top", bigHorSlider.max + 7 + "px")
// 			 .text("100%");
//      }
       
     function levelLeft(level) {
       var max = bigHorSlider.max - bigHorSlider.min;
       var level = max * (level / 100);
       return bigHorSlider.min + level;
     }
       
     div = pop.append("div")
    	 .attr("id", "on-off-slider-wrapper");
     div.append("div")
         .attr("class", "on-off-slider")
         .append("img")
           .attr("src", "popovers/assets/slider.on-off.svg")
           .on("click", toggleOnOff);
     div.append("div")
         .attr("class", "on-off-knob")
         .attr("id", "on-off-knob")
         .style("left", function() { return ((device.status === "on") ? onOffSlider.max : onOffSlider.min) + "px" })
         .on("click", toggleOnOff)
         .append("img")
           .attr("src", "popovers/assets/knob.small.svg");
     div.append("div")
         .attr("class", "on-label small-label")
         .text("ON");
     div.append("div")
         .attr("class", "off-label small-label")
         .text("OFF");

   };


   function finishEmpty() {
       var elem;
       finishCommon("done-wide");
       
       div = pop.append("span")
           .attr("id", "hard-hat-area")
           .style("background-color", "#367ad2")
           .style("position", "absolute")
           .style("left", "100px")
           .style("top", "175px")
           .style("width", "400px")
           .style("height", "150px")
           .style("text-align", "center")
		   .style("transform", "rotate(-20deg)")
		   .style("-moz-border-radius", "20px")
		   .style("-webkit-border-radius", "20px")
		   .style("border-radius", "20px")
		   .style("border", "6px solid #000");
       div.append("p")
       	   .style("color", "#fff")
       	   .style("font-size", "32pt")
       	   .style("margin", "28px 0px 28px 0px")
       	   .style("padding", "0px")
       	   .html("Coming soon!");
       div.append("p")
       	   .style("color", "#000")
       	   .style("margin", "0px")
       	   .style("padding", "0px")
           .html("(This is a developer preview, and all of our<br />features are not yet functional. Check back soon.)");
   };
   
	function finishCommon(doneClass) {
	  var div, div2;
	  div = pop.append("div")
	    .attr("id", "primary-controls");
	  div.append("div")
	    .attr("id", "actor")
	    .append("img")
	      .attr("src", function(d, i) {return "popovers/assets/" + entries[device.deviceType].img; })
	      .style("width", "43px");
	  div.append("div")
	    .attr("id", "popover-name")
	    .attr("class", "popover-name")
	    .attr("contenteditable", "true")
	    .on("blur", setDeviceName)
	    .on("keydown", setDeviceName)
        .text(device.name);
      
      pop.append("img")
        .attr("src", "popovers/assets/done_on.svg")
        .attr("id", "done")
        .attr("class", doneClass)
        .style("height", "22px")
        .on("click", cancel);
	};
	
	function finishStatus() {
	  div = pop.append("div")
        .attr("id", "device-status-wrapper");
      div.append("div")
        .attr("id", "device-status")
        .style("background-color", statusColor(device))
      div.append("div")
        .attr("id", "device-status-detail").attr("class", "small-label")
        .text(device.status);
      div.append("div")
        .attr("id", "device-status-label").attr("class", "label")
        .text("DEVICE STATUS");

    };
    
	function toggleOnOff() {
	   var endLeft
	   if (newPerform.perform === "on") {
	      newPerform.perform = "off";
	      endLeft = onOffSlider.min
	   } else {
	      newPerform.perform = "on";
	      endLeft = onOffSlider.max
	   }
	   d3.select("#on-off-knob")
	      .transition().each("end", sendData())
	      .duration(600)
	      .style("left", endLeft + "px");
	   
	};

	function mediaPlay(event) {
	  var elem = event.target;
	  if (newPerform.perform !== "play") {
	  	newPerform.perform = "play";
	  	elem.src = "popovers/assets/media-button-two.svg";
	  	document.getElementById("media-button-three").src = "popovers/assets/media-button-three-off.svg";
	  	sendData();
	  }
	};
	
	function mediaPause(event) {
	  var elem = event.target;
	  if (newPerform.perform !== "pause") {
	  	newPerform.perform = "pause";
	  	elem.src = "popovers/assets/media-button-three.svg";
	  	document.getElementById("media-button-two").src = "popovers/assets/media-button-two-off.svg";
	  	sendData();
	  }
	};
	
	function mediaToggleMute(event) {
	  var elem = event.target;
	  if (newPerform.parameter.muted === "off") {
	  	newPerform.parameter.muted = "on";
	  	elem.src = "popovers/assets/media-button-five-off.svg";
	  } else {
	  	newPerform.parameter.muted = "off";
	  	elem.src = "popovers/assets/media-button-five-on.svg";
	  }
	  sendData();
	};
	
	function makeEditable() {
	  var elem = d3.event.target;
	  elem.contentEditable = true;
	};
	
	function setDeviceName() {
	  var elem = d3.event.target;
	  if (d3.event.keyCode) {
	    if (d3.event.keyCode !== 13) {
	      return true;
	    } else {
	      d3.event.preventDefault();
	    }
	  }
	  if (elem.innerText === "" || elem.innerText === "\n") {
	    elem.innerText = device.name;
	  } else if (elem.innerText !== device.name) {
	    var cmd = { path     : newPerform.path,
	                perform  : "set",
	                requestID: "2",
	                parameter: { name : elem.innerText} };
	    cmd.parameter = JSON.stringify(cmd.parameter);
//console.log("Sending: " + JSON.stringify(cmd));
        wsSend(JSON.stringify(cmd));
        currDevice.device.name = elem.innerText;
        document.getElementById("actor-big-name").innerText = elem.innerText;
	  }
	};

	function cancel() {
     d3.select("#popBg")
      .transition().each("end", removePop())
      .duration(600)
	  .style("opacity", "0");
	};
	
	function removePop() {
	  d3.select("#blocker").remove(); 
	  pop.remove();
	};
	
};

var ColorPickerMgr = {
	addColorPicker : function(pop, info) {
	   if (info.color) {
         var color = info.color;
         switch (color.model) {
        	case 'temperature': 
        		addTemp(color.temperature);
        		break;
        	case 'cie1931':     
        		addCIE(color.cie1931.x ,color.cie1931.y);
        		break;
        	case 'hue':         
        		addHSV((color.hue, color.saturation / 100, entry.info.brightness / 100).rgb());
        		break;
        	case 'rgb':         
        		addRGB(color.rgb.r, color.rgb.g, color.rgb.b);
        		break;
        	default:            
        		break;
		 }
       } else {
         addDisabledColor();
       }
       
       function addTemp(temp) {
	     var rgb = d3.mired.rgb(temp);
	     var cp, div, div2;
	  
	     div = pop.append("div")
	        .attr("id", "colorpicker-container");
	     div.append("div")
	        .attr("id", "color-picker")
			.attr("class", "cp-skin")
			.on("click", function() { setTimeout(sendData, 50)});
         pop.append("div")
			.attr("id", "color-label").attr("class", "label colorpicker-label")
			.text("COLOR TEMPERATURE");
	  
	     newPerform.parameter.color.model = "rgb";
	     cp = ColorPicker(document.getElementById("color-picker"),

         function(hex, hsv, rgb) {
           newPerform.parameter.color.rgb = {r:rgb.r, g:rgb.g, b:rgb.b};
           delete newPerform.parameter.color.temperature;
         });
         
	     cp.setRgb({r:rgb.r, g:rgb.g, b:rgb.b});
       };
       
       function addCIE(x, y) {
		 var cie1931 = info.color.cie1931
	     var regisCoords = ColorPickerMgr.regCoords(cie1931.x, cie1931.y);
		 pop.append("canvas")
			.attr("id", "cie-gamut")
			.attr("width", "300")
			.attr("height", "300");
			//.on("click", grabColors);
	     pop.append("img")
			.attr("id", "registration").attr("src", "popovers/assets/registration.svg")
			.style("left", regisCoords.x + "px")
			.style("top", regisCoords.y + "px");
	     pop.append("img")
			.attr("id", "axis").attr("src", "popovers/assets/axis.svg")
			.on("click", passEvent);
	     pop.append("div")
			.attr("id", "color-label").attr("class", "label colorpicker-label")
			.text("COLOR TEMPERATURE");
		 var canvas = document.getElementById("cie-gamut");
		 canvas.addEventListener("click", grabColors);
		 if (canvas.getContext) {
		   var ctx = canvas.getContext("2d");
		   ctx.fillStyle = "rgb(29,29,29)";
		   ctx.fillRect(0,0,300,300);
			
		   var img = new Image();
		   img.src = "popovers/assets/cie.png";
			
		   img.onload = function () {
			 ctx.drawImage(img, 0, 0, 300, 300);
		   }
		 }
		
		 // redirect event from frontmost axis img elem to canvas
	     function passEvent() {
		   var evt = d3.event;
		   var newEvt;
		   var canvas = document.getElementById("cie-gamut");
		   newEvt = document.createEvent("MouseEvents");
		   newEvt.initMouseEvent("click", false, false, null, 0, 0, 0, evt.offsetX, evt.offsetY, false, false, false, false, 0, null);
		   canvas.dispatchEvent(newEvt);
	     }
		
	     function grabColors(evt) {
		   var result = {};
		   var canvas = document.getElementById("cie-gamut");
		   var ctx = canvas.getContext("2d");
		   var x = evt.clientX;
		   var y = evt.clientY;
		   var imgData = ctx.getImageData(x, y, 1, 1).data;
		   if (imgData[0] != 29 && imgData[1] != 29 && imgData[2] != 29) {
		     setCIECoords(evt);
		     d3.select("#registration")
			   .style("left", function() {return canvas.offsetLeft + x - 12 + "px";})
			   .style("top", function() {return canvas.offsetTop + y + "px";})
	   		 }
		 }
		
		 function setCIECoords(evt) {
		   var x = evt.clientX - 34;
		   var y = evt.clientY - 18;
		   var width = evt.target.width * 1.08;
		   var height = evt.target.height;
		   var scaleX = Math.abs(x/width);
		   var scaleY = Math.abs(0.84 - y/height);
		   var result = {"x": scaleX, "y": scaleY};
		   newPerform.parameter.color.cie1931 = result;
		   sendData();
		 }
       };
       
       function addHSV(h, s, v) {
	     var cp, div, div2;
		  
		 div = pop.append("div")
				.attr("id", "colorpicker-container");
		 div.append("div")
				.attr("id", "color-picker")
				.attr("class", "cp-skin")
				.on("click", function() { setTimeout(sendData, 50)});
		 pop.append("div")
				.attr("id", "color-label").attr("class", "label colorpicker-label")
				.text("COLOR TEMPERATURE");
		 cp = ColorPicker(document.getElementById("color-picker"),
	
		 function(hex, hsv, rgb) {
		   newPerform.parameter.color.hue = hsv.h;
		   newPerform.parameter.color.saturation = hsv.s;
		 });
		 
		 cp.setHsv({h:h, s:s, v:v});
       };
       
       function addRGB(r, g, b) {
	     var cp, div, div2;
	  
	     div = pop.append("div")
	        .attr("id", "colorpicker-container");
	     div.append("div")
	        .attr("id", "color-picker")
			.attr("class", "cp-skin")
			.on("click", function() { setTimeout(sendData, 50)});
         pop.append("div")
			.attr("id", "color-label").attr("class", "label colorpicker-label")
			.text("COLOR TEMPERATURE");
	     cp = ColorPicker(document.getElementById("color-picker"),

         function(hex, hsv, rgb) {
           newPerform.parameter.color.rgb = {r:rgb.r, g:rgb.g, b:rgb.b};
         });
         
	     cp.setRgb({r:r, g:g, b:b});
       };
       
       function addDisabledColor() {
	     var cp, div, div2;
	  
	     div = pop.append("div")
	        .attr("id", "colorpicker-container");
	     div.append("div")
	        .attr("id", "color-picker")
			.attr("class", "cp-skin");
         pop.append("div")
			.attr("id", "color-label").attr("class", "label-disabled colorpicker-label")
			.text("COLOR TEMPERATURE");
	     cp = ColorPicker(document.getElementById("color-picker"),
         function(hex, hsv, rgb) {
         });
      
         div.append("div")
           .attr("id", "blocker")
           .style("position", "absolute")
           .style("width", "298px")
           .style("height", "290px")
           .style("top", "0px")
           .style("left", "0px")
           .style("background-image", "url(popovers/assets/blocker.svg)");
	};


	},
	updateColorPicker : function(info) {
	   if (info.color) {
         var color = info.color;
         newPerform.parameter = info;
         switch (color.model) {
        	case 'temperature': 
        		updateTemp(color.temperature);
        		break;
        	case 'cie1931':     
        		updateCIE(color.cie1931.x ,color.cie1931.y);
        		break;
        	case 'hue':         
        		updateHSV((color.hue, color.saturation / 100, entry.info.brightness / 100).rgb());
        		break;
        	case 'rgb':         
        		updateRGB(color.rgb.r, color.rgb.g, color.rgb.b);
        		break;
        	default:            
        		break;
		 }
       }
       
       function updateTemp(temp) {
         if (colorModelHasChanged('temperature')) {
           removeCIEPicker();
           ColorPickerMgr.addColorPicker(d3.select("#pop-substrate"), info);
         } else {
	       var rgb = d3.mired.rgb(temp);
	       newPerform.parameter.color.model = "rgb";
           newPerform.parameter.color.rgb = {r:rgb.r, g:rgb.g, b:rgb.b};
           delete newPerform.parameter.color.temperature;
	       var cp = ColorPicker(document.getElementById("color-picker"));
	       cp.setRgb({r:rgb.r, g:rgb.g, b:rgb.b});
         }
       };
       
       function updateCIE(x, y) {
         if (colorModelHasChanged('cie1931')) {
           removeRGBPicker();
           ColorPickerMgr.addColorPicker(d3.select("#pop-substrate"), info);
         } else {
  	       var regisCoords = ColorPickerMgr.regCoords(x, y);
           d3.select("#registration")
			  .style("left", regisCoords.x + "px")
			  .style("top", regisCoords.y + "px");
		 }
       };
       
       function updateHSV(h, s, v) {
         if (colorModelHasChanged('hue')) {
           removeCIEPicker();
           ColorPickerMgr.addColorPicker(d3.select("#pop-substrate"), info);
         } else {
		   cp = ColorPicker(document.getElementById("color-picker"));
		   newPerform.parameter.color.hue = hsv.h;
		   newPerform.parameter.color.saturation = hsv.s;
		   cp.setHsv({h:h, s:s, v:v});
		 }
       };
       
       function updateRGB(r, g, b) {
         if (colorModelHasChanged('rgb')) {
           removeCIEPicker();
           ColorPickerMgr.addColorPicker(d3.select("#pop-substrate"), info);
         } else {
	       cp = ColorPicker(document.getElementById("color-picker"));
           newPerform.parameter.color.rgb = {r:rgb.r, g:rgb.g, b:rgb.b};
	       cp.setRgb({r:r, g:g, b:b});
	     }
       };
       
       function colorModelHasChanged(newModel) {
         var result = false;
         switch (newModel) {
           case 'cie1931':
              if (!document.getElementById('cie-gamut')) result = true;
              break;
           case 'temperature':
           case 'hue':
           case 'rgb':
              if (!document.getElementById('colorpicker-container')) result = true;
              break;
           default:
              break;
         }
         return result;
       }
       
       function removeCIEPicker() {
         d3.select("#cie-gamut").remove();
         d3.select("#registration").remove();
         d3.select("#axis").remove();
         d3.select("#color-label").remove();
       }
       
       function removeRGBPicker() {
         d3.select("#colorpicker-container").remove();
         d3.select("#color-label").remove();
       }
	
	},
	
	regCoords : function(x, y) {
	  var v = parseInt((x * 314.86), 10) + 169;
	  var h = 444 - parseInt((y * 316.67), 10) ;
	  return {"x": v, "y": h};
    }

};

var updatePopover = function(device, update) {
  switch (device.deviceType.match(/\/\w*\/\w*\//)[0]) {
	case "/device/climate/":
	  break;
	case "/device/indicator/":
	  break;
	case "/device/lighting/":
	  updateLightingPop();
	  break;
	case "/device/media/":
	  break;
	case "/device/motive/":
	  break;
	case "/device/presence/":
	  break;
	case "/device/sensor/":
	  break;
	case "/device/switch/":
	  break;
	case "/device/wearable/":
	  break;
	default:
	  break;
  }

  function updateLightingPop() {
	if (document.getElementById("device-status")) {
	  d3.select("#device-status")
		.style("background-color", statusColor(update));
	  d3.select("#device-status-detail")
		.text(update.status);
	}
	if (document.getElementById("on-off-knob")) {
	  d3.select("#on-off-knob")
		 .transition()
		 .duration(600)
         .style("left", function() { return ((device.status === "on") ? onOffSlider.max : onOffSlider.min) + "px" });
	}
	if (update.info.color) {
	  ColorPickerMgr.updateColorPicker(update.info);
	}
	if (device.info.hasOwnProperty("brightness")) {
	  d3.select("#brightness-knob")
		 .transition()
		 .duration(600)
		 .style("top", hueBrightTop(update.info.brightness));
	  d3.select("#slider-readout")
		 .transition()
		 .duration(600)
		 .style("top", parseInt(hueBrightTop(update.info.brightness)) + 7 + "px")
		 .text(update.info.brightness + "%");
	}
	newPerform.perform = update.status;
	newPerform.parameter = update.info;
  }

}


function hueBrightTop(value) {
	var max = bigSlider.max;
	var min = bigSlider.min;
	var top = ((min-max) * ((100-value) / 100) + max);
	return top + "px";
};


function sendData(device) {
  newPerform.parameter = JSON.stringify(newPerform.parameter);
//console.log("Sending: " + JSON.stringify(newPerform));
  wsSend(JSON.stringify(newPerform));
  newPerform.parameter = JSON.parse(newPerform.parameter);
};
	
