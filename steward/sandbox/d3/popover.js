var bigSliderKnob = { "diam": 22 };
var bigSlider = { "min": 310, "max": 39 };
var bigHorSlider = { "min": 64, "max": 264 };
var onOffKnob = { "diam": 18 };
var onOffSlider = { "min": 25, "max": 71 - onOffKnob.diam };
var onOffSliderMotive = { "min": 53, "max": 99 - onOffKnob.diam };
var newPerform = { "path":"", "requestID":"2", "perform":"", "parameter":{} };
var performParams = { 'perform':'', 'parameter':{} };

// d3 drag functions
var drag = d3.behavior.drag()
    .origin(Object)
    .on("dragstart", clearPerformParams)
    .on("drag", dragmove)
    .on("dragend", sendPerform);

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
				performParams = { perform:'on', parameter: {brightness : pct} };
				return by1 + "px";
			});
			break;
    case "volume-control-indicator":
			var currAngle = 0;
			elem = d3.event.sourceEvent.target;
			var exy = [d3.event.sourceEvent.offsetX, d3.event.sourceEvent.offsetY];
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
			performParams = { perform:'set', parameter: {volume : rotateAngle} };
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
			  performParams = { perform:'set', parameter: {'track' : newPerform.parameter.track} };
				return bx2 + "px";
			});
			break;
		case "temperature-knob":
      var isMetric = isPlaceMetric();
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
				d3.select("#temperature-readout")
				  .html(function() { return (isMetric) ? cels.toFixed(1) + "&deg;C" : fahr.toFixed(1) + "&deg;F" })
				  .style("left", bx2 - 5 + "px");
				newPerform.parameter.goalTemperature = cels;
			  performParams = { perform:'set', parameter: {'goalTemperature' : cels} };
				return bx2 + "px";
			});
			break;
		case "temperature-knob-motive":
      var isMetric = isPlaceMetric();
      var tempFRange = {min: 40, max: 100};
      var offset = parseInt(d3.select("#temperature-motive").style("left"), 10);
			max = 116;
			min = 0;
			d3.select(this).style("left", function() { 
				bx1 = parseInt(d3.select(this).style("left"));
				bx2 = bx1 + d3.event.dx;
				bx2 = Math.max(bx2, min);
				bx2 = Math.min(bx2, max);
				var pct = bx2/(max - min);
				var fahr = (pct * (tempFRange.max - tempFRange.min)) + tempFRange.min;
				var cels = ((fahr - 32) * 5) / 9;
				d3.select("#temperature-readout-motive")
				  .html(function() { return (isMetric) ? cels.toFixed(1) + "&deg;C" : fahr.toFixed(1) + "&deg;F" })
				  .style("left", bx2 - 5 + offset + "px");
				newPerform.parameter.hvac = cels;
			  performParams = { perform:'hvac', parameter: {'hvac' : cels} };
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
			  performParams = { perform:'set', parameter: {'fan' : newPerform.parameter.fan} };
				return by1 + "px";
			});
			break;
		case "level-knob":
		  if (newPerform.perform !== "on") return;
			max = 264;
			min = 64;
			d3.select(this).style("left", function() { 
				bx1 = parseInt(d3.select(this).style("left"));
				bx2 = bx1 + d3.event.dx;
				bx2 = Math.max(bx2, min);
				bx2 = Math.min(bx2, max);
				var pct = (bx2 - min)/(max - min);
				newPerform.parameter.level = parseInt((pct * 100), 10);
			  performParams = { perform:'set', parameter: {'level' : newPerform.parameter.level} };
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


var showPop = function(device) {
  // Popover window positioning/dimensions
  var w, h, t, l;
  var entry = entries[device.deviceType] || entries.default(device.deviceType);

  switch (device.deviceType.match(/\/\w*\/\w*\//)[0]) {
	case "/device/climate/":
	  if (!device.deviceType.match("/control")) {
		  w = 485, h = 497, t = 290, l = 133;
		} else {
		  w = 598, h = 497, t = 100, l = 83;
		}
		  break;
	case "/device/lighting/":
		w = 485, h = 497, t = 100, l = 133;
		break;
	case "/device/media/":
		w = 598, h = 497, t = 100, l = 83;
		break;
	case "/device/motive/":
		w = 598, h = 407, t = 170, l = 80;
		break;
	case "/device/switch/":
		w = 485, h = 497, t = 290, l = 133;
		break;
	case "/device/presence/":
		if (hasAlertPerform()) {
		  w = 420, h = 340, t = 215, l = 165;
		} else {
		  w = 485, h = 497, t = 290, l = 133;
		}
		break;
	case "/device/wearable/":
		w = 420, h = 340, t = 215, l = 165;
		break;
	case "/device/sensor/":
		w = 485, h = 497, t = 290, l = 133;
		break
	default:
		w = 485, h = 497, t = 290, l = 133;
		break
  }

   var deviceID = device.actor.slice(device.actor.lastIndexOf("/") + 1);
   newPerform.path = "/api/v1/device/perform/" + deviceID;
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
			case "/device/climate/":
	            if (device.deviceType.match("/control")) {
				  return "popovers/assets/window.three-panel.bkg.svg";
				} else {
				  return "popovers/assets/window.short.popover.svg";
				}
				break;
			case "/device/lighting/":
				return "popovers/assets/window.square.svg";
				break;
			case "/device/media/":
				return "popovers/assets/window.two-panel.bkg.svg";
				break;
			case "/device/motive/":
				return "popovers/assets/motive.alert.bkg.svg";
				break;
			case "/device/switch/":
				return "popovers/assets/window.short.popover.svg";
				break;
			case "/device/presence/":
			  if (hasAlertPerform()) {
				  return "popovers/assets/wearable-popover.svg";
			  } else {
				  return "popovers/assets/window.short.popover.svg";
			  }
			  break;
			case "/device/wearable/":
				return "popovers/assets/wearable-popover.svg";
				break;
			default:
				return "popovers/assets/window.short.popover.svg";
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
			case "motive_pop":
				return finishMotive;
				break;
			case "presence_pop":
			case "wearable_pop":
				return finishPresence;
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
       d3.select("#popover-name").style("width", "210px");
       finishStatus();
       
       div = pop.append("div")
         .attr("id", "on-off-slider-wrapper");
       div.append("div")
         .attr("class", "on-off-slider")
         .append("img")
           .attr("src", "popovers/assets/slider.on-off.svg")
           .on("click", function() { toggleOnOff("lighting"); });
       div.append("div")
         .attr("class", "on-off-knob")
         .attr("id", "on-off-knob")
         .style("left", function() { return ((device.status === "on") ? onOffSlider.max : onOffSlider.min) + "px" })
         .on("click", function() { toggleOnOff("lighting"); })
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
         .text(function() {return device.info.track.album || "album"});
     div.append("div")
       .attr("class", "display-artist" + hasTrackProperty("artist"))
       .append("span")
         .attr("id", "display-artist")
         .attr("class", "label-padding")
         .text(function() {return device.info.track.artist || "artist"});
     div.append("div")
       .attr("class", "display-track" + hasTrackProperty("title"))
       .append("span")
         .attr("id", "display-track")
         .attr("class", "label-padding")
         .text(function() {return device.info.track.title || "track"});
     
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
			 .style("transform", "rotate(" + calcVolRotation(device.info.volume) + "deg)")
			 .style("-webkit-transform", "rotate(" + calcVolRotation(device.info.volume) + "deg)")
			 .call(drag);
     }
     
     if (device.info.hasOwnProperty("track") && device.info.track.hasOwnProperty("position")) {
		 div = pop.append("div")
		   .attr("id", "track-progress-wrapper");
		 div.append("div")
		   .attr("class", "track-progress")
		   .append("img")
			 .attr("id", "track-progress-knob")
			 .attr("class", "track-progress-knob")
			 .style("left", calcTrackProgress(device.info.track) + "px")
			 .attr("src", "popovers/assets/track-progress-knob.svg")
			 .call(drag);
		 div.append("div")
		   .attr("id", "track-progress-label")
		   .attr("class", "track-progress-label small-label")
		   .text("TRACK PROGRESS");
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
   
   function finishMotive() {
     var div, div2, elem, disabled = "-disabled", offset;
     finishCommon("done-wide");
     d3.select("#done").attr("id", "done-motive");
     
     if (device.info.hvac) {
			 div = pop.append("div")
				 .attr("id", "hvac-wrapper-motive");
			 div.append("div")
				 .attr("id", "on-off-slider-motive")
				 .append("img")
					 .attr("src", "popovers/assets/slider.on-off.svg")
					 .on("click", function() { toggleOnOff("motiveTemp"); });
			 div.append("div")
				 .attr("id", "on-off-knob")
				 .style("left", function() { return ((device.info.hvac === "off") ? onOffSliderMotive.min : onOffSliderMotive.max) + "px" })
				 .on("click", function() { toggleOnOff("motiveTemp"); })
				 .append("img")
					 .attr("src", "popovers/assets/knob.small.svg");
			 div.append("div")
				 .attr("class", "small-label")
				 .attr("id", "on-label-motive")
				 .text("ON");
			 div.append("div")
				 .attr("class", "small-label")
				 .attr("id", "off-label-motive")
				 .text("OFF");
				 
			 div.append("div")
			 .attr("class", "label")
			 .attr("id", "hvac-bracket")
			 .append("img")
					.attr("src", "popovers/assets/hvac.bracket.svg")
				.attr("height", "21px");
				
		 div2 = div.append("div")
			 .attr("class", "temperature-motive")
			 .attr("id", "temperature-motive")
			 .style("background-image", function() { return ((device.info.hvac === "off") ? 
					 "url(\'popovers/assets/slider.transparent.short.off.svg\')" :
						 "url(\'popovers/assets/slider.transparent.short.svg\')")});
			 elem = div2.append("img")
				 .attr("id", "temperature-knob-motive")
				 .attr("class", "temperature-knob-motive")
				 .attr("src", function() { return ((device.info.hvac === "off") ?
						 "popovers/assets/knob.small.off.svg" :
						 "popovers/assets/knob.svg");})
		 elem
			 .style("left", "0px")
				 .transition()
				 .duration(600)
				 .style("left", motiveGoalTempLeft(device.info) + "px");
			 elem.call(drag);
			 
			 offset = parseInt(d3.select("#temperature-motive").style("left"), 10);
	
			 elem = div.append("div")
					 .attr("class", "temperature-readout-motive")
					 .attr("id", "temperature-readout-motive")
					 .style("color", function() { return ((device.info.hvac === "off") ? "#444" : "#fff") } )
					 .style("left", (motiveGoalTempLeft(device.info) - 10) + offset + "px");
			 elem.append("span")
					.attr("class", "temp-label")
					.text(motiveGoalTempText(device.info));
     }
     
     if (device.info.sunroof && device.info.sunroof !== "none") {
       div2 = pop.append("div")
         .attr("id", "sunroof-wrapper");
			 div2.append("div")
				 .attr("class", "label")
				 .append("img")
					 .attr("id", "button-one")
				 .attr("src", function() {return (device.info.sunroof === "open") ? "popovers/assets/open-button.svg" : "popovers/assets/open-button-off.svg"} )
				 .attr("height", "20px")
				 .on("click", function() {motiveToggleSunroof(event, "open")});
			 div2.append("div")
				 .attr("class", "label")
				 .append("img")
					 .attr("id", "button-two")
				 .attr("src", function() {return (device.info.sunroof === "comfort") ? "popovers/assets/comfort-button.svg" : "popovers/assets/comfort-button-off.svg"} )
				 .attr("height", "20px")
				 .on("click", function() {motiveToggleSunroof(event, "comfort")});
			 div2.append("div")
				 .attr("class", "label")
				 .append("img")
					 .attr("id", "button-three")
				 .attr("src", function() {return (device.info.sunroof === "vent") ? "popovers/assets/vent-button.svg" : "popovers/assets/vent-button-off.svg"} )
				 .attr("height", "20px")
				 .on("click", function() {motiveToggleSunroof(event, "vent")});
			 div2.append("div")
				 .attr("class", "label")
				 .append("img")
					 .attr("id", "button-four")
				 .attr("src", function() {return (device.info.sunroof === "closed") ? "popovers/assets/closed-button.svg" : "popovers/assets/closed-button-off.svg"} )
				 .attr("height", "20px")
				 .on("click", function() {motiveToggleSunroof(event, "closed")});
			 div2.append("div")
				 .attr("class", "label")
				 .attr("id", "sunroof-bracket")
				 .append("img")
				 .attr("src", "popovers/assets/sunroof.bracket.svg")
				 .attr("height", "21px");
			 d3.select("#popover-name").style("width", "230px");
     }
     
     div = pop.append("div")
         .attr("id", "big-button-wrapper-motive");
         
     if (hasLockPerform) {
			 div2 = div.append("div")
				 .attr("class", "label")
				 .attr("id", "big-button-two-motive")
				 .style("text-align", "center");
			 div2.append("img")
				 .attr("id", "vehicleLocks")
				 .attr("src", function() { return (device.status === "locked") ? "popovers/assets/lock-on.svg" : "popovers/assets/lock-off.svg"} )
				 .attr("height", "152px")
				 .style("margin-bottom", "12px")
				 .on("click", function() {motiveCommand(event, "locks")});
			 div2.append("span")
					 .attr("id", "vehicleLockAction")
					 .text(function() { return (device.status === "locked") ? "UNLOCK" : "LOCK"});
     } else {
			 div2 = div.append("div")
				 .attr("class", "label")
				 .attr("id", "big-button-one-motive")
				 .style("text-align", "center");
			 div2.append("img")
				 .attr("src", "popovers/assets/headlights-on.svg")
				 .attr("height", "152px")
				 .style("margin-bottom", "12px")
				 .on("click", function() {motiveCommand(event, "lights")});
			 div2.append("span")
				 .text("HEADLIGHTS");
			 div2 = div.append("div")
				 .attr("class", "label")
				 .attr("id", "big-button-two-motive")
				 .style("text-align", "center");
			 div2.append("img")
				 .attr("src", "popovers/assets/horn-on.svg")
				 .attr("height", "152px")
				 .style("margin-bottom", "12px")
				 .on("click", function() {motiveCommand(event, "horn")});
			 div2.append("span").text("HORN");
			 div2 = div.append("div")
				 .attr("class", "label")
				 .attr("id", "big-button-three-motive")
				 .style("text-align", "center");
			 div2.append("img")
				 .attr("id", "doorLocks")
				 .attr("src", function() { return (device.info.doors === "locked") ? "popovers/assets/lock-on.svg" : "popovers/assets/lock-off.svg"} )
				 .attr("height", "152px")
				 .style("margin-bottom", "12px")
				 .on("click", function() {motiveCommand(event, "doors")});
			 div2.append("span")
				 .attr("id", "doorLockAction")
				 .text(function() { return (device.info.doors === "locked") ? "UNLOCK DOORS" : "LOCK DOORS"});
     }
     function motiveToggleSunroof(event, type) {
       elem = event.target;
       document.getElementById("button-one").src = "popovers/assets/open-button-off.svg";
       document.getElementById("button-two").src = "popovers/assets/comfort-button-off.svg";
       document.getElementById("button-three").src = "popovers/assets/vent-button-off.svg";
       document.getElementById("button-four").src = "popovers/assets/closed-button-off.svg";
       elem.src = "popovers/assets/" + type + "-button.svg";
       newPerform.perform = "sunroof";
       newPerform.parameter.sunroof = type;
       clearPerformParams();
       performParams = {perform:'sunroof', parameter:newPerform.parameter.sunroof};
     }
     
     function motiveCommand(event, type) {
       clearPerformParams();
       switch(type) {
         case "lights":
           newPerform.perform = "lights";
           performParams.perform = "lights";
           break;
         case "horn":
           newPerform.perform = "horn";
           performParams.perform = "horn";
           break;
         case "doors":
           newPerform.perform = "doors"
           performParams.perform = "doors";
           if (event.target.src.indexOf("lock-on") !== -1) {
             event.target.src = "popovers/assets/lock-off.svg";
             newPerform.parameter.doors = "unlock";
             performParams.parameter.doors = "unlock";
             event.target.nextSibling.textContent = "LOCK DOORS"
           } else {
             event.target.src = "popovers/assets/lock-on.svg";
             newPerform.parameter.doors = "lock";
             performParams.parameter.doors = "lock";
             event.target.nextSibling.textContent = "UNLOCK DOORS"
           }
           break;
         case "locks":
           if (event.target.src.indexOf("lock-on") !== -1) {
             event.target.src = "popovers/assets/lock-off.svg";
             newPerform.perform = "unlock";
             performParams.perform = "unlock";
             event.target.nextSibling.textContent = "LOCK"
           } else {
             event.target.src = "popovers/assets/lock-on.svg";
             newPerform.perform = "lock";
             performParams.perform = "lock";
             event.target.nextSibling.textContent = "UNLOCK"
           }
           break;
         default:
           break;
       }
       sendPerform();
     }
     
     function hasLockPerform() {
       var performs = stack[0].message.result.actors[currDevice.device.deviceType].perform;
       return (performs[0] === "lock" || performs[0] === "unlock")
     }
   }
   
   function finishPresence() {
     var div, div2, elem;
     newPerform.perform = "alert";

     div = pop.append("div")
       .attr("id", "primary-controls");
     div.append("div")
       .attr("id", "actor")
       .append("img")
         .attr("src", function(d, i) {return "popovers/assets/" + entry.img; })
         .attr("width", "43px");
     div.append("div")
       .attr("class", "popover-name")
       .attr("id", "popover-name-wear")
	   .attr("contenteditable", "true")
	   .on("blur", setDeviceName)
	   .on("keydown", setDeviceName)
       .text(device.name);
     
     if (hasAlertPerform()) {
			 div = pop.append("div")
					 .attr("id", "big-button-wrapper-wear");
			 div2 = div.append("div")
				 .attr("class", "label")
				 .attr("id", "big-button-one-wear")
				 .style("text-align", "center");
			 div2.append("img")
				 .attr("id", "big-button-one-img-wear")
				 .attr("src", function() { return (device.status === "present") ? "popovers/assets/alert-on.svg" : "popovers/assets/alert-off.svg" })
				 .attr("height", "152px")
				 .style("margin-bottom", "12px")
				 .on("click", function() {presenceCommand(event, "mild")});
			 div2.append("span")
				 .attr("id", "alert-button-one-label")
				 .style("color", function() { return (device.status === "present") ? "#fff" : "#444" })
				 .text("SEND ALERT");
			 div2 = div.append("div")
				 .attr("class", "label")
				 .attr("id", "big-button-two-wear")
				 .style("text-align", "center");
			 div2.append("img")
				 .attr("id", "big-button-two-img-wear")
				 .attr("src", function() { return (device.status === "present") ? "popovers/assets/alert-urgent-on.svg" : "popovers/assets/alert-urgent-off.svg" })
				 .attr("height", "152px")
				 .style("margin-bottom", "12px")
				 .on("click", function() {presenceCommand(event, "high")});
			 div2.append("span")
				 .attr("id", "alert-button-two-label")
				 .style("color", function() { return (device.status === "present") ? "#fff" : "#444" })
				 .text("SEND URGENT ALERT");
			 pop.append("img")
					.attr("src", "popovers/assets/done_on.svg")
					.attr("id", "done-wear")
					.style("height", "22px")
					.on("click", cancel);
		 } else {
			 pop.append("img")
					.attr("src", "popovers/assets/done_on.svg")
					.attr("class", "done-narrow")
					.style("height", "22px")
					.on("click", cancel);
		 }		 
        
     function presenceCommand(event, type) {
       if (newPerform.status === "present") {
         switch(type) {
           case "mild":
             newPerform.parameter.level = type;
             break;
           case "high":
             newPerform.parameter.level = type;
             break;
           default:
             newPerform.parameter.level = "none";
             break;
         }
         sendData();
       } else {
         notify("Device is out of range for alerts.");
       }
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
         .attr("src", function(d, i) {return "popovers/assets/" + entry.img; })
         .attr("width", "43px");
     div.append("div")
       .attr("class", "popover-name")
       .attr("id", "popover-name")
	   .attr("contenteditable", "true")
	   .on("blur", setDeviceName)
	   .on("keydown", setDeviceName)
       .text(device.name);
       
     if (device.info.hvac) {
		 div.append("div")
		   .attr("class", "label")
		   .append("img")
		     .attr("id", "button-one-climate")
			 .attr("src", function() {return (device.info.hvac === "off") ? "popovers/assets/off-button.svg" : "popovers/assets/off-button-off.svg"} )
			 .attr("height", "22px")
			 .on("click", function() {climateTogglehvac(event, "off")});
		 div.append("div")
		   .attr("class", "label")
		   .append("img")
		     .attr("id", "button-two-climate")
			 .attr("src", function() {return (device.info.hvac === "fan") ? "popovers/assets/fan-button.svg" : "popovers/assets/fan-button-off.svg"} )
			 .attr("height", "22px")
			 .on("click", function() {climateTogglehvac(event, "fan")});
		 div.append("div")
		   .attr("class", "label")
		   .append("img")
		     .attr("id", "button-three-climate")
			 .attr("src", function() {return (device.info.hvac === "cool") ? "popovers/assets/cool-button.svg" : "popovers/assets/cool-button-off.svg"} )
			 .attr("height", "22px")
			 .on("click", function() {climateTogglehvac(event, "cool")});
		 div.append("div")
		   .attr("class", "label")
		   .append("img")
		     .attr("id", "button-four-climate")
			 .attr("src", function() {return (device.info.hvac === "heat") ? "popovers/assets/heat-button.svg" : "popovers/assets/heat-button-off.svg"} )
			 .attr("height", "22px")
			 .on("click", function() {climateTogglehvac(event, "heat")});
		 d3.select("#popover-name").style("width", "230px");
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
       document.getElementById("button-one-climate").src = "popovers/assets/off-button-off.svg";
       document.getElementById("button-two-climate").src = "popovers/assets/fan-button-off.svg";
       document.getElementById("button-three-climate").src = "popovers/assets/cool-button-off.svg";
       document.getElementById("button-four-climate").src = "popovers/assets/heat-button-off.svg";
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
         .text(function() { return renderTemperature(device.info.goalTemperature); });
         
     var timedFan = (device.info.fan && (device.info.fan !== "auto") && (device.info.fan !== "on"));
     div = pop.append("div")
       .attr("id", "fantime-slider-wrapper");
     div.append("div")
         .attr("id", "fantime-slider-label")
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
		   .style("top", parseInt(fanTimeTop(device.info.fan), 10) + 7 + "px");
		 elem.append("span")
			 .attr("id", "fantime-readout")
			 .attr("class", "label")
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
		   .attr("id", "fantime-slider-readout")
		   .attr("class", "slider-readout")
		   .style("top", bigSlider.min + 7 + "px");
		 elem.append("span")
			 .attr("id", "fantime-readout")
			 .attr("class", "label-disabled")
			 .text("0");
		 elem.append("br");
		 elem.append("span")
			 .attr("class", "small-label")
			 .text("MIN");
     }
         
     drawTemperatureArc(pop, device.info.temperature);
   }

   function finishSwitch() {
     var div, elem;
     newPerform.perform = device.status;
     finishCommon("done-switch");
     
     if (hasNoPerform()) return;
     
     var hasLevel = device.info.hasOwnProperty("level");
     div = pop.append("div")
       .attr("id", "level-status-wrapper-switch");
     div.append("div")
       .attr("class", function() {return (hasLevel) ? "small-label level-status-label" : "small-label level-status-label-disabled"})
       .text("LEVEL");
     div.append("div")
         .attr("class", "level-status-grid")
         .append("img")
           .attr("src", "popovers/assets/grid.horizontal.svg")
           .style("height", "32px");
     div.append("div")
         .attr("class", "level-status")
         .append("img")
           .attr("src", "popovers/assets/slider.long.horizontal.svg")
           .style("height", "19px");
     
     elem = div.append("img")
     	.attr("class", "level-knob")
      .attr("id", "level-knob")
     	.attr("src", "popovers/assets/knob.large.off.svg");
     elem.call(drag);
     if (hasLevel) {
       if (device.status === "on") {
		     elem
		       .attr("src", "popovers/assets/knob.large.svg");
		   } 
		   elem
			   .style("left", bigHorSlider.min + "px")
			   .transition()
			   .duration(600)
			   .style("left", levelLeft(device.info.level) + "px");
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
       
     div = pop.append("div")
    	 .attr("id", "on-off-slider-wrapper-switch");
     div.append("div")
         .attr("class", "on-off-slider")
         .append("img")
           .attr("src", "popovers/assets/slider.on-off.svg")
           .on("click", function() { toggleOnOff("switch") });
     div.append("div")
         .attr("class", "on-off-knob")
         .attr("id", "on-off-knob")
         .style("left", function() { return ((device.status === "on") ? onOffSlider.max : onOffSlider.min) + "px" })
         .on("click", function() { toggleOnOff("switch") })
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
       finishCommon("done-narrow");
   };
   
	function finishCommon(doneClass) {
	  var div, div2;
	  div = pop.append("div")
	    .attr("id", "primary-controls");
	  div.append("div")
	    .attr("id", "actor")
	    .append("img")
	      .attr("src", function(d, i) {return "popovers/assets/" + entry.img; })
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
    
	function toggleOnOff(type) {
	   var endLeft;
	   if (!type) return;
	   switch(type) {
	     case "lighting":
	       if (newPerform.perform === "on") {
	         newPerform.perform = "off";
	         endLeft = onOffSlider.min;
	       } else {
	         newPerform.perform = "on";
	         endLeft = onOffSlider.max;
	         if (newPerform.parameter.hasOwnProperty("color") &&
	            newPerform.parameter.color.hasOwnProperty("rgb") &&
	            objEquals(newPerform.parameter.color.rgb, {r:0, g:0, b:0})) {
	              newPerform.parameter.color.rgb = {r:255, g:255, b:255};
	         }
	       }
	       break;
	     case "motiveTemp":
	       newPerform.perform = "hvac";
	       if (newPerform.parameter.hvac === "off") {
	         newPerform.parameter.hvac = "on";
	         endLeft = onOffSliderMotive.max;
	         d3.select("#temperature-motive")
	           .style("background-image", "url(\'popovers/assets/slider.transparent.short.svg\')");
	         d3.select("#temperature-knob-motive")
	           .attr("src", "popovers/assets/knob.svg");
	         d3.select("#temperature-readout-motive")
	           .style("color", "#fff");
	           // SET READOUT & SLIDER to newPerform.parameter.intTemperature
	       } else {
	         newPerform.parameter.hvac = "off";
	         endLeft = onOffSliderMotive.min;
	         d3.select("#temperature-motive")
	           .style("background-image", "url(\'popovers/assets/slider.transparent.short.off.svg\')");
	         d3.select("#temperature-knob-motive")
	           .attr("src", "popovers/assets/knob.small.off.svg");
	         d3.select("#temperature-readout-motive")
	           .style("color", "#444");
	         // EMPTY READOUT & DEACTIVATE SLIDER
	       }
	       break;
	     case "switch":
	       if (newPerform.perform === "on") {
	         newPerform.perform = "off";
	         endLeft = onOffSlider.min;
	         d3.select("#level-knob")
	           .attr("src", "popovers/assets/knob.large.off.svg");
	       } else {
	         newPerform.perform = "on";
	         endLeft = onOffSlider.max;
	         if (newPerform.parameter.hasOwnProperty("level")) 
	           d3.select("#level-knob")
	             .attr("src", "popovers/assets/knob.large.svg");
	       }	       
	       break;
	     default:
	       break;
	    }
	   d3.select("#on-off-knob")
	      .transition().each("end", sendData())
	      .duration(600)
	      .style("left", endLeft + "px");
	   
	   function objEquals(sample, model) {
	     for (var prop in model) {
	       if (sample.hasOwnProperty(prop)) {
	         if (sample[prop] != model[prop]) return false;
	       }
	     }
	     return true;
	   }
	};

	function mediaPlay(event) {
	  var elem = event.target;
	  if (newPerform.perform !== "play") {
	  	newPerform.perform = "play";
	  	perform_device(ws2, deviceID, newPerform.perform, '', function(message) { 
	  	  if (!!message.result && !!message.result.status && message.result.status === 'success') {
    	  	elem.src = "popovers/assets/media-button-two.svg";
	  	    document.getElementById("media-button-three").src = "popovers/assets/media-button-three-off.svg";	  		  	  
	  	  }
	    });
	  }
	};
	
	function mediaPause(event) {
	  var elem = event.target;
	  if (newPerform.perform !== "pause") {
	  	newPerform.perform = "pause";
	  	perform_device(ws2, deviceID, newPerform.perform, '', function(message) { 
	  	  if (!!message.result && !!message.result.status && message.result.status === 'success') {
	  	    elem.src = "popovers/assets/media-button-three.svg";
	  	    document.getElementById("media-button-two").src = "popovers/assets/media-button-two-off.svg";
	  	  }
      });
	  }
	};
	
	function mediaToggleMute(event) {
	  var elem = event.target;
	  var isMuted = (newPerform.parameter.muted === "on");
	  if (!isMuted) {
	  	newPerform.parameter.muted = "on";
	  	newPerform.perform = "set";
	  } else {
	  	newPerform.parameter.muted = "off";
	  	newPerform.perform = "set";
	  }
	  perform_device(ws2, deviceID, newPerform.perform, {muted: newPerform.parameter.muted}, function(message) { 
	  	if (!!message.result && !!message.result.status && message.result.status === 'success') {
        elem.src = (newPerform.parameter.muted === 'on') ? "popovers/assets/media-button-five-off.svg" : "popovers/assets/media-button-five-on.svg";
      }
    });
	};
	
	function setDeviceName() {
	  var elem = d3.event.target;
	  if (entry.norename) {
	    notify("\"" + currDevice.device.name + "\" cannot be renamed from the steward.");
	    elem.textContent = currDevice.device.name;
	    elem.blur();
	    return;
	  }
	  if (d3.event.keyCode) {
	    if (d3.event.keyCode !== 13) {
	      return true;
	    } else {
	      d3.event.preventDefault();
	    }
	  }
	  if (elem.textContent === "" || elem.textContent === "\n") {
	    elem.textContent = device.name;
	  } else if (elem.textContent !== device.name) {
  	  perform_device(ws2, deviceID, 'set', { name : elem.textContent }, function(message) {});
	    elem.scrollLeft = 0;
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
        		addHSV((color.hue, color.saturation / 100, currDevice.device.info.brightness / 100));
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
		   newEvt.initMouseEvent("click", false, false, null, 0, 0, 0, (evt.clientX - evt.target.offsetWidth), (evt.clientY - evt.target.offsetHeight - 10), false, false, false, false, 0, null);
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
		   var scaleX = Math.abs(x/width) + 0.02;
		   var scaleY = Math.abs(0.84 - y/height) - 0.02;
		   var result = {"x": scaleX, "y": scaleY};
		   newPerform.parameter.color.cie1931 = result;
		   sendData();
		 }
       };
       
       function addHSV(h, s, v) {
	     var cp, div, div2;
		 if (!h) h = 0;
		 if (!s) s = 0;
		 if (!v) v = 1;
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
           .attr("id", "color-blocker")
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
        		updateHSV((color.hue, color.saturation / 100, currDevice.device.info.brightness / 100));
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
	       var cp = ColorPicker(document.getElementById("color-picker"),
             function(hex, hsv, rgb) {
               newPerform.parameter.color.rgb = {r:rgb.r, g:rgb.g, b:rgb.b};
               delete newPerform.parameter.color.temperature;
             });
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
		   cp = ColorPicker(document.getElementById("color-picker"),
		     function(hex, hsv, rgb) {
		       newPerform.parameter.color.hue = hsv.h;
		       newPerform.parameter.color.saturation = hsv.s;
		     });
		   cp.setHsv({h:h, s:s, v:v});
		 }
       };
       
       function updateRGB(r, g, b) {
         if (colorModelHasChanged('rgb')) {
           removeCIEPicker();
           ColorPickerMgr.addColorPicker(d3.select("#pop-substrate"), info);
         } else {
	       cp = ColorPicker(document.getElementById("color-picker"), 
	         function(hex, hsv, rgb) {
               newPerform.parameter.color.rgb = {r:rgb.r, g:rgb.g, b:rgb.b};
             });
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
	  if (device.deviceType.match("/control")) updateThermostatPop();
	  break;
	case "/device/indicator/":
	  break;
	case "/device/lighting/":
	  updateLightingPop();
	  break;
	case "/device/media/":
	  updateMediaPop();
	  break;
	case "/device/motive/":
	  updateMotivePop();
	  break;
	case "/device/presence/":
	case "/device/wearable/":
	  updatePresencePop();
	  break;
	case "/device/sensor/":
	  break;
	case "/device/switch/":
	  updateSwitchPop();
	  break;
	default:
	  break;
  }

  function updateThermostatPop() {
    if (update.info.hasOwnProperty("hvac")) {
      d3.select("#button-one-climate")
        .attr("src", function() {return (update.info.hvac === "off")  ? "popovers/assets/off-button.svg"  : "popovers/assets/off-button-off.svg"} );
      d3.select("#button-two-climate")
        .attr("src", function() {return (update.info.hvac === "fan")  ? "popovers/assets/fan-button.svg"  : "popovers/assets/fan-button-off.svg"} );
      d3.select("#button-three-climate")
        .attr("src", function() {return (update.info.hvac === "cool") ? "popovers/assets/cool-button.svg" : "popovers/assets/cool-button-off.svg"} );
      d3.select("#button-four-climate")
        .attr("src", function() {return (update.info.hvac === "heat") ? "popovers/assets/heat-button.svg" : "popovers/assets/heat-button-off.svg"} );
    }
    if (update.info.hasOwnProperty("goalTemperature")) {
      d3.select("#temperature-knob")
        .transition()
        .duration(600)
        .style("left", goalTempLeft(update.info.goalTemperature) + "px");
      d3.select("#temperature-readout")
        .transition()
        .duration(600)
        .style("left", (goalTempLeft(update.info.goalTemperature) - 10) + "px")       
        .text(function() { return renderTemperature(update.info.goalTemperature); });
    }
    var timedFan = (update.info.hasOwnProperty("fan") && (update.info.fan !== "auto") && (update.info.fan !== "on"));
    if (timedFan) {
      var top = parseInt(fanTimeTop(update.info.fan), 10);
      d3.select("#fantime-slider-label")
        .attr("class", "slider-label label");
      d3.select("#fantime-knob")
		.attr("src", "popovers/assets/knob.large.svg")
		.call(drag)
		.transition()
		.duration(600)
		.style("top", top + "px");
      d3.select("#fantime-slider-readout")
		.transition()
		.duration(600)
		.style("top", top + 7 + "px");
	  d3.select("#fantime-readout")
	    .attr("class", "label")
		.text(parseInt((update.info.fan / 60 / 1000), 10));
    } else {
      d3.select("#fantime-slider-label")
        .attr("class", "slider-label label-disabled");
      d3.select("#fantime-knob")
		.attr("src", "popovers/assets/knob.large.off.svg")
		.transition()
		.duration(600)
		.style("top", bigSlider.min + "px");
      d3.select("#fantime-slider-readout")
		.transition()
		.duration(600)
		.style("top", bigSlider.min + 7 + "px");
	  d3.select("#fantime-readout")
	    .attr("class", "label-disabled")
		.text("0");
		
    }
    
    drawTemperatureArc(d3.select("#pop-substrate"), update.info.temperature);
    
    newPerform.parameter = update.info;
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
  
  function updateMediaPop() {
    var anchor;
	  if (document.getElementById("device-status")) {
	    d3.select("#device-status")
		    .style("background-color", statusColor(update));
	    d3.select("#device-status-detail")
		    .text(update.status);
	  }
//     if (update.info.volume) {
// 	    d3.select("#volume-control-indicator")
// 		    .style("transform", "rotate(" + calcVolRotation(update.info.volume) + "deg)")
// 		    .style("-webkit-transform", "rotate(" + calcVolRotation(update.info.volume) + "deg)");
//     }
    if (update.info.track) {
      if (!!update.info.track.title && update.info.track.title.indexOf('http') === 0) {
        anchor = document.createElement('a');
        anchor.href = update.info.track.title;
        update.info.track.title = decodeURIComponent(anchor.pathname.replace(/(^\/?)/,''))
      }
      d3.select("#display-album")
        .text(function() {return update.info.track.album || "album"});
      d3.select("#display-artist")
        .text(function() {return update.info.track.artist || "artist"});
      d3.select("#display-track")
        .text(function() {return update.info.track.title || "title"});
    }
	  if (update.info.hasOwnProperty("track") && update.info.track.hasOwnProperty("position")) {
      d3.select("#track-progress-knob")
        .transition()
        .duration(300)
        .style("left", calcTrackProgress(update.info.track) + "px");
	  }
	  d3.select("#media-button-two")
	    .attr("src", function() {return (update.status === "playing") ? "popovers/assets/media-button-two.svg" : "popovers/assets/media-button-two-off.svg";});
	  d3.select("#media-button-three")
      .attr("src", function() {return (update.status === "paused") ? "popovers/assets/media-button-three.svg" : "popovers/assets/media-button-three-off.svg";});
    if (update.info.muted) {
      d3.select("#media-button-four")
        .attr("src", function() {return (update.info.muted === "off") ? "popovers/assets/media-button-five-on.svg" : "popovers/assets/media-button-five-off.svg";});
    }

	  newPerform.perform = update.status;
//	  newPerform.parameter = update.info;
  }
  
  function updateMotivePop() {
    if (update.info.sunroof !== "none") {
      d3.select("#button-one")
        .attr("src", function() {return (update.info.sunroof === "open")  ? "popovers/assets/open-button.svg"  : "popovers/assets/open-button-off.svg"} );
      d3.select("#button-two")
        .attr("src", function() {return (update.info.sunroof === "comfort")  ? "popovers/assets/comfort-button.svg"  : "popovers/assets/comfort-button-off.svg"} );
      d3.select("#button-three")
        .attr("src", function() {return (update.info.sunroof === "vent") ? "popovers/assets/vent-button.svg" : "popovers/assets/vent-button-off.svg"} );
      d3.select("#button-four")
        .attr("src", function() {return (update.info.sunroof === "closed") ? "popovers/assets/closed-button.svg" : "popovers/assets/closed-button-off.svg"} );
    }
    
    if (update.info.hvac) {
			d3.select("#on-off-knob")
				.transition()
				.duration(600)
				.style("left", function() { return ((update.info.hvac === "off") ? onOffSliderMotive.min : onOffSliderMotive.max) + "px"});
				
			d3.select("#temperature-motive")
				.style("background-image", function() { return ((update.info.hvac === "off") ? 
					 "url(\'popovers/assets/slider.transparent.short.off.svg\')" :
						 "url(\'popovers/assets/slider.transparent.short.svg\')")});
			d3.select("#temperature-knob-motive")
				.attr("src", function() { return ((update.info.hvac === "off") ?
						 "popovers/assets/knob.small.off.svg" :
						 "popovers/assets/knob.svg");})
				.transition()
				.duration(600)
				.style("left", motiveGoalTempLeft(update.info) + "px");
	
			offset = parseInt(d3.select("#temperature-motive").style("left"), 10);
	
			d3.select("#temperature-readout-motive")
				.style("color", function() { return ((update.info.hvac === "off") ? "#444" : "#fff") } )
				.transition()
				.duration(600)
				.style("left", (motiveGoalTempLeft(update.info) - 10) + offset + "px")
				.text(motiveGoalTempText(update.info));
    }
    
    if (update.info.doors) {
			d3.select("#doorLocks")
				.attr("src", function() { return (update.info.doors === "locked") ? "popovers/assets/lock-on.svg" : "popovers/assets/lock-off.svg" });
			d3.select("#doorLockAction")
				.text(function() { return (update.info.doors === "locked") ? "UNLOCK DOORS" : "LOCK DOORS" });
    }
    
    if (update.status === "locked" || update.status === "unlocked") {
			d3.select("#vehicleLocks")
				.attr("src", function() { return (update.status === "locked") ? "popovers/assets/lock-on.svg" : "popovers/assets/lock-off.svg" });
			d3.select("#vehicleLockAction")
				.text(function() { return (update.status === "locked") ? "UNLOCK" : "LOCK" });
			newPerform.perform = (update.status === "locked") ? "lock" : "unlock";
    }
    newPerform.parameter = update.info;
  }
  
  function updatePresencePop() {
    if (hasAlertPerform()) {
			d3.select("#big-button-one-img-wear")
				.attr("src", function() { return (update.status === "present") ? "popovers/assets/alert-on.svg" : "popovers/assets/alert-off.svg"});
			d3.select("#big-button-two-img-wear")
				.attr("src", function() { return (update.status === "present") ? "popovers/assets/alert-urgent-on.svg" : "popovers/assets/alert-urgent-off.svg"});
			d3.select("#alert-button-one-label")
				.style("color", function() { return (update.status === "present") ? "#fff" : "#444" });
			d3.select("#alert-button-two-label")
				.style("color", function() { return (update.status === "present") ? "#fff" : "#444" });
	
			newPerform.parameter = update.info;
			newPerform.status = update.status;
		}
  }
  
  function updateSwitchPop() {
  	if (document.getElementById("on-off-knob")) {
	    d3.select("#on-off-knob")
        .transition()
  		  .duration(600)
        .style("left", function() { return ((update.status === "on") ? onOffSlider.max : onOffSlider.min) + "px" });
	  }
	  if (update.info.hasOwnProperty("level")) {
      d3.select("#level-knob")
        .attr("src", function() { return (update.status === "on") ? "popovers/assets/knob.large.svg" : "popovers/assets/knob.large.off.svg"; });
	    d3.select("#level-knob")
		   .transition()
		   .duration(600)
		   .style("left", levelLeft(update.info.level) + "px");
// If we decide to add readout box to level slider
// 	  d3.select("#slider-readout")
// 		 .transition()
// 		 .duration(600)
// 		 .style("left", parseInt(levelLeft(update.info.level)) + 7 + "px")
// 		 .text(update.info.level + "%");
 	  }
    newPerform.perform = update.status;
	  newPerform.parameter = update.info;
  }

}

// Popover control setters (initial and update)
function hueBrightTop(value) {
  var max = bigSlider.max;
  var min = bigSlider.min;
  var top = ((min-max) * ((100-value) / 100) + max);
  return top + "px";
};

function goalTempLeft(goalTempC) {
  var result = 0;
  var isMetric = isPlaceMetric();
  var elemEdges = {min: 0, max: 340};
  
  var tempRange = (isMetric) ? {min: 4, max: 38} : {min: 40, max: 100};
  var goalTemp = (isMetric) ? goalTempC : ((parseFloat(goalTempC) * 9) / 5) + 32;
  result = ((goalTemp - tempRange.min) / (tempRange.max - tempRange.min)) * elemEdges.max;
  return result;
};
     
function fanTimeTop(value) {
  var max = bigSlider.max;
  var min = bigSlider.min;
  value = parseInt((value / 1000/ 60), 10);
  var top = ((min-max) * ((100-value) / 100) + max);
  return top + "px";
};

function drawTemperatureArc(pop, temp) {
  var div;
  var colorRange = {temp  :  [4.0, 11.6, 16.9, 22.8, 28.5, 35],
	            color :  ["#529dcc", "#43be93", "#0ea74b", "#b2cb25", "#f47f1f", "#ee3324"]};
  if (document.getElementById("thermostat-wrapper")) {
  	document.getElementById("thermostat-wrapper").removeChild(document.getElementById("tempArcCanvas"));
    div = d3.select("#thermostat-wrapper");
  } else {
    div = pop.append("div")
      .attr("id", "thermostat-wrapper");
    div.append("img")
      .attr("id", "thermostat-knob")
      .attr("src", function () { return (isPlaceMetric()) ? "popovers/assets/thermostat.celsius.svg" : "popovers/assets/thermostat.fahrenheit.svg" })
      .attr("width", "310px");
  }
  var canvas = div.append("svg")
    .attr("width", 310)
    .attr("height", 310)
    .attr("id", "tempArcCanvas")
    .style("position", "absolute")
    .style("top", "0px")
    .style("left", "0px");
  var group = canvas.append("g")
    .attr("transform", "translate(155,155)");
  var r = 110;
  var p = ((parseFloat(temp) * 6.28) / 33.4) - 1.1; //Math.PI * 1.92;
  var arc = d3.svg.arc()
    .innerRadius(r - 12)
    .outerRadius(r)
    .startAngle(-0.25)
    .endAngle(p);
  group.append("path")
    .style("fill", function() {
    	   var result = colorRange.color[colorRange.color.length - 1]; 
    	   for (var i = 0; i < colorRange.temp.length; i++) {
    	     if (parseFloat(temp) > colorRange.temp[i]) {
    	       result = colorRange.color[i];
    	     }
    	   }
    	   return result;
     })
    .attr("d", arc);
}

function calcVolRotation(volume) {
  var result = -10; // zero point, to be corrected in art
  var number11 = 280; // Max rotation
  result += (volume / 100) * number11;
  return result;
}
     

function calcTrackProgress(trackInfo) {
  var result = 0;
  var theEnd = 500; // Max track position
  if (parseFloat(trackInfo.duration) > 0) {
   result = (parseFloat(trackInfo.position)/parseFloat(trackInfo.duration)) * theEnd;
  }
  return result;
}

function levelLeft(level) {
  var max = bigHorSlider.max - bigHorSlider.min;
  level = max * (level / 100);
  return bigHorSlider.min + level;
}
       
function motiveGoalTempLeft(info) {
  var result = 0;
  var goalTemp = (isPlaceMetric()) ? motiveGoalTemp(info) : asFahrenheit(motiveGoalTemp(info));
  var isMetric = isPlaceMetric();
  var elemEdges = {min: 0, max: 115};
  var tempRange = (isMetric) ? {min: 4, max: 38} : {min: 40, max: 100};
  if (isNaN(goalTemp)) return elemEdges.min;
  
  if (goalTemp <= tempRange.min) return elemEdges.min;
  if (goalTemp >= tempRange.max) return elemEdges.max;
  result = ((goalTemp - tempRange.min) / (tempRange.max - tempRange.min)) * elemEdges.max;
  return result;
}
     
function motiveGoalTemp(info) {
  var goalTemp;
  var intTemperature = (info.hasOwnProperty("intTemperature")) ? parseInt(info.intTemperature, 10) : "- -";
  if (info.hvac === "off" || info.hvac === "on") {
    goalTemp = intTemperature;
  } else {
    goalTemp = parseInt(info.hvac, 10);
  }
  return goalTemp;
}

function motiveGoalTempText(info) {
  var temp = motiveGoalTemp(info);
  var rangeTemp = (isPlaceMetric()) ? motiveGoalTemp(info) : asFahrenheit(motiveGoalTemp(info));
  var isMetric = isPlaceMetric();
  var tempRange = (isMetric) ? {min: 4, max: 38} : {min: 40, max: 100};
  if (rangeTemp > tempRange.max) temp = "> " + tempRange.max; 
  if (rangeTemp < tempRange.min) temp = "< " + tempRange.min; 
  if (isNaN(temp)) {
    return "";
  } else {
    return renderTemperature(temp);
  }
}

function isPlaceMetric() {
  return (place_info.displayUnits === "metric");
}

function asFahrenheit(celsius) {
  return ((celsius * 9) / 5) + 32;
}

function renderTemperature(temperature) {
  return isPlaceMetric() ? parseInt(temperature, 10).toFixed(1) + "°C" : asFahrenheit(parseInt(temperature, 10)).toFixed(1) + "°F";
}
	
function hasAlertPerform() {
	var performs = stack[0].message.result.actors[currDevice.device.deviceType].perform.toString();
	(/\balert\b/.test(performs));
}

function hasNoPerform() {
	return (stack[0].message.result.actors[currDevice.device.deviceType].perform.toString() === '');
}

function clearPerformParams() {
  performParams = { 'perform':'', 'parameter':{} };
}

function sendPerform() {
  var deviceID = currDevice.actor.slice(currDevice.actor.lastIndexOf("/") + 1);
	perform_device(ws2, deviceID, performParams.perform, performParams.parameter, function(message) {});
}

function sendData(device) {
  newPerform.parameter = JSON.stringify(newPerform.parameter);
//  console.log("Sending: " + JSON.stringify(newPerform));
  wsSend(JSON.stringify(newPerform));
  newPerform.parameter = JSON.parse(newPerform.parameter);
};
	
