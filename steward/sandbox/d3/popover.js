var bigSliderKnob = { "diam": 22 };
var bigSlider = { "min": 465 - bigSliderKnob.diam, "max": 178 - (bigSliderKnob.diam / 2) };
var onOffKnob = { "diam": 18 };
var onOffSlider = { "min": 339, "max": 385 - onOffKnob.diam };
var newPerform = { "path":"", "requestID":"2", "perform":"", "parameter":{} };

var drag = d3.behavior.drag()
    .origin(Object)
    .on("drag", dragmove)
    .on("dragend", sendData);

function dragmove(d) {
	var max, min, by1, by2;
	var elemID = d3.select(this).attr("id");
	if (elemID === "brightness-knob" || elemID === "brightness") {
		max = bigSlider.max; // brightness div top minus half button height
		min = bigSlider.min; // brightness div bottom minus button height
		d3.select(this).style("top", function() { 
		    by1 = parseInt(d3.select(this).style("top"));
		    by2 = by1 + d3.event.dy;
		    if (by2 > max && by2 < min) {
				by1 = by2;
			}
			var pct = 100 - parseInt(((by1 - max + 1)/(min - max)) * 100);
			d3.select("#brightness-readout").text(pct + "%").style("top", by1 + 7 + "px");
			newPerform.parameter.brightness = pct;
			return by1 + "px";
		});
    }
}


var showPop = function(device, entry) {

   var w = 598, h = 497, t = 100, l = 83;
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
   .attr("id", "pop-substrate");
   
   
   pop.append("img")
     .attr("id", "popBg")
     .attr("src", "popovers/assets/window.bkg.svg")
     .style("position", "absolute")
     .attr("width", "0")
     .attr("height", "0")
     .style("top", w / 2 + "px")
     .style("left", h / 2 + "px")
     .transition().each("end", carryonFunc(device))
     .duration(600)
     .attr("width", "598")
     .attr("height", "497")
     .style("top", "0px")
     .style("left", "0px");

   function carryonHue() {
       var elem;
       carryonCommon();
       
	   pop.append("img")
		 .attr("id", "brightness-grid").attr("src", "popovers/assets/grid.svg");
	   pop.append("img")
		 .attr("id", "brightness").attr("src", "popovers/assets/slider.large.svg")
	   pop.append("div")
		 .attr("id", "brightness-label").attr("class", "label")
		 .text("BRIGHTNESS");
       elem = pop.append("img")
		.attr("id", "brightness-knob").attr("src", "popovers/assets/knob.large.svg");
	   elem
		.style("left", "62px")
		.style("top", bigSlider.min + "px")
		.transition()
		.duration(600)
		.style("top", hueBrightTop(device.info.brightness));
       elem.call(drag);
       
	   pop.append("div")
		 .attr("id", "brightness-readout").attr("class", "small-label")
		 .style("top", parseInt(hueBrightTop(device.info.brightness)) + 7 + "px")
		 .text( device.info.brightness + "%");
         
       pop.append("img")
         .attr("id", "on-off-slider").attr("src", "popovers/assets/slider.on-off.svg")
         .on("click", toggleOnOff);
       pop.append("div")
         .attr("id", "on-label").attr("class", "small-label")
         .text("ON");
       pop.append("div")
         .attr("id", "off-label").attr("class", "small-label")
         .text("OFF");
       pop.append("img")
         .attr("id", "on-off-knob").attr("src", "popovers/assets/knob.small.svg")
         .style("left", function() { return ((device.status === "on") ? onOffSlider.max : onOffSlider.min) + "px" })
         .on("click", toggleOnOff);
         
       if ((device.status === "on") || (device.status === "off")) newPerform.perform = device.status;
    
       var color = device.info.color;
       switch (color.model) {
        	case 'temperature': 
        		addTemp(color.temperature);
        		break;
        	case 'cie1931':     
        		addCIE(color.cie1931.x ,color.cie1931.y);
        		break;
        	case 'hue':         
        		addHSL((color.hue, color.saturation / 100, entry.info.brightness / 100).rgb());
        		break;
        	case 'rgb':         
        		addRGB(color.rgb.r, color.rgb.g, color.rgb.b);
        		break;
        	default:            
        		break;

       }
   }

   function carryonEmpty() {
       var elem;
       carryonCommon();
   }
   
   
	function carryonCommon() {
	   pop.append("div")
         .attr("id", "popover-name").attr("class", "popover-name")
         .text(device.name);
       pop.append("img")
         .attr("id", "actor").attr("src", "popovers/assets/hue.svg")
         .style("width", "43px");
       pop.append("div")
         .attr("id", "device-status")
         .style("background-color", statusColor(device))
         .append("img")
           .attr("src", "popovers/assets/slider.transparent.svg");
       pop.append("div")
         .attr("id", "device-status-detail").attr("class", "small-label")
         .text(device.status);
       pop.append("div")
         .attr("id", "device-status-label").attr("class", "label")
         .text("DEVICE STATUS");
         
//        pop.append("img")
//          .attr("id", "send").attr("src", "popovers/assets/send.svg")
//          .attr("class", "label")
//          .style("height", "22px")
//          .on("click", sendData);
       pop.append("img")
         .attr("id", "done").attr("src", "popovers/assets/done_on.svg")
         .attr("class", "label")
         .style("height", "22px")
         .on("click", cancel);

	}
	
	// Append model-specific color temperature pickers
	function addTemp(temp) {
	
	}
	
	function addCIE(x, y) {
		var cie1931 = device.info.color.cie1931
	    var regisCoords = regCoords(cie1931.x, cie1931.y);
//	    console.log(regisCoords);
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
			.attr("id", "cie-label").attr("class", "label")
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
//				console.log("x=" + (canvas.offsetLeft + x - 12) + "  /  y=" + (canvas.offsetTop + y - 12));
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
//			console.log("X=" + scaleX + "   /   Y=" + scaleY);
		}
		
		function regCoords(x, y) {
			v = parseInt((x * 220) / 0.735) + 170;
			h = parseInt((y * 250) / 0.84) + 225;
			return {"x": v, "y": h};
		}

	}
	
	function addHSL(color) {
	
	}
	
	function addRGB(r, g, b) {
	
	}
	
	var currSheet;
	
	function findSheet(d) {
		currSheets = {"knob": null, "space": null};
		var found1 = false, found2 = false;
		
		var lookup = [ {target: "brightness-knob", rel: "brightness"},
					   {target: "transition-knob", rel: "transition"}
					 ];
		for (var i = 0; i < lookup.length; i++) {
			if (d3.event.target.id === lookup[i].target) {
				var sheets = document.styleSheets;
				for (var j = 0; j < sheets.length; j++) {
					if (sheets[j].href && sheets[j].href.indexOf("popovers") != -1) {
						var rules = sheets[j].cssRules;
						for (var k = 0; k < rules.length; k++) {
							if (rules[k].selectorText === "#" + lookup[i].target) {
							   currSheets.knob = rules[k];
							   found1 = true;
							}
							if (rules[k].selectorText === "#" + lookup[i].rel) {
								currSheets.space = rules[k];
								found2 = true;
							}
							if (found1 && found2) return;
						}
					}
				}
			}
		}       
	}
	
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
	   
	}
	
	function carryonFunc(device) {
		switch (device.deviceType) {
			case "/device/lighting/hue/bloom":
			case "/device/lighting/hue/bulb":
			case "/device/lighting/hue/lightstrip":
				return carryonHue;
			default:
				return carryonEmpty;
		}
	}

	function cancel() {
     d3.select("#popBg")
      .transition().each("end", removePop())
      .duration(600)
	  .style("opacity", "0");
	}
	
	function removePop() {
		d3.select("#blocker").remove(); 
		pop.remove();
	}
	


}

function hueBrightTop(value) {
	var max = bigSlider.max;
	var min = bigSlider.min;
	var top = ((min-max) * ((100-value) / 100) + max);
	return top + "px";
}


function sendData(device) {
  newPerform.parameter = JSON.stringify(newPerform.parameter);
//console.log("Sending: " + JSON.stringify(newPerform));
  wsSend(JSON.stringify(newPerform));
  newPerform.parameter = JSON.parse(newPerform.parameter);
}
	
