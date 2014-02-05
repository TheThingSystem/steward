var onOffSliderPane = { "min": 7, "max": 38 };

var goApprentices = function(local) {
  var backdrop;

  if (document.getElementById("sub-pane-one")) d3.select('#sub-pane-one').remove();
  if (!document.getElementById('apprentice-backdrop')) {
    backdrop = d3.select('body')
      .append('div')
      .attr('id', 'apprentice-backdrop');
    backdrop.append('img')
      .attr('src', 'images/thing.sys.logo.black.svg')
      .style('margin-top', '8px')
      .style('cursor', 'pointer')
      .on('click', function() {exitApprentices()});
  } else {
    backdrop = d3.select('#apprentice-backdrop');
    updatePanesList();
  }

  function exitApprentices() {
    d3.select('#apprentice-backdrop').remove();
  }

  if (!local) {refreshActors(4); } else { finishApprentices(); }
}

var finishApprentices = function() {
  var backdrop, div, div2, i, panesDiv, panesList;
  backdrop = d3.select('#apprentice-backdrop');

  div = backdrop.append('div')
    .attr('id', 'settings');
  div.append('div')
    .attr('class', 'form-heading')
    .style('margin-top', '0px')
    .style('text-transform', 'capitalize')
    .html(apprentices.home.title);
  div.append('div')
    .attr('class', 'apprentice-instructions')
    .html(apprentices.home.text);
  
  panesList = livingPanes();
  
  var divLeft, divRight;
  panesDiv = div.append('div')
    .attr('class', 'panes');
  divLeft = panesDiv.append('div')
    .attr('class', 'panes-left')
  divRight = panesDiv.append('div')
    .attr('class', 'panes-right')
  for (i = 0; i < panesList.length; i++) {
    div = (i % 2 === 0) ? divLeft.append('div') : divRight.append('div');
		div.attr('class', 'display-pane')
			.attr('onclick', function() { return 'javascript:goPaneDetail(' + i + ');'; });
		div.append('div')
		  .attr('class', 'small-label on-label')
      .attr('id', function() { return 'paneLabelOn' + i })
      .html('on')
      .attr("onclick", function() { return 'javascript:togglePaneOnOff(' + i + ', event);'; });
		div.append('div')
		  .attr('class', 'small-label off-label')
      .attr('id', function() { return 'paneLabelOff' + i })
		  .html('off')
      .attr("onclick", function() { return 'javascript:togglePaneOnOff(' + i + ', event);'; });
     div.append("div")
         .attr("class", "on-off-slider")
         .append("img")
           .attr("src", "popovers/assets/slider.on-off.svg")
           .attr("onclick", function() { return 'javascript:togglePaneOnOff(' + i + ', event);'; });
     div.append("div")
         .attr("class", "on-off-knob")
         .attr("id", function() { return 'on-off-knob' + i })
         .style("left", function() { return onOffSliderPane.min + "px" })
         .attr("onclick", function() { return 'javascript:togglePaneOnOff(' + i + ', event);'; })
         .append("img")
           .attr("src", "popovers/assets/knob.small.svg");
		div.append('span')
			.attr('class', 'label-disabled')
			.attr('id', function() { return 'pane' + i });
		div.append('span')
			.attr('class', 'state-disabled')
			.attr('id', function() { return 'state' + i });
  }

  updatePanesList();
};

var updatePanesList = function() {
  var i, panesList;
  panesList = livingPanes();
  for (i = 0; i < panesList.length; i++) {
		d3.select('#pane' + i)
			.attr('class', 'label')
			.html(panesList[i].title);
		d3.select('#state' + i)
			.attr('class', 'state')
			.html(panesList[i].status);
		if (panesList[i].status === "configured") {
			if (panesList[i].active) {
				endLeft = onOffSliderPane.max;
				d3.select('#paneLabelOn' + i)
					.style('display', 'block');
				d3.select('#paneLabelOff' + i)
					.style('display', 'none');
			} else {
				endLeft = onOffSliderPane.min;
				d3.select('#paneLabelOn' + i)
					.style('display', 'none');
				d3.select('#paneLabelOff' + i)
					.style('display', 'block');
			}
		  
			d3.select('#on-off-knob' + i)
				.transition().each('end', sendApprData())
				.duration(600)
				.style('left', endLeft + 'px');
				
		} else {
			d3.select('#paneLabelOn' + i)
				.style('display', 'none');
			d3.select('#paneLabelOff' + i)
				.style('display', 'none');
		}
  }
}

var togglePaneOnOff = function(i, evt) {
	var endLeft;
	var panesList = livingPanes();
	evt.stopPropagation();
	if (panesList[i].status !== "configured") return;
	if (panesList[i].active) {
		panesList[i].active = false;
		endLeft = onOffSliderPane.min;
		d3.select('#paneLabelOn' + i)
			.style('display', 'none');
		d3.select('#paneLabelOff' + i)
			.style('display', 'block');
	} else {
		panesList[i].active = true;
		endLeft = onOffSliderPane.max;
		d3.select('#paneLabelOn' + i)
			.style('display', 'block');
		d3.select('#paneLabelOff' + i)
			.style('display', 'none');
	}
	
	d3.select('#on-off-knob' + i)
		.transition().each('end', sendApprData())
		.duration(600)
		.style('left', endLeft + 'px');
}

var goPaneDetail = function(n) {
  var div, div2, div3, div4, events, panes, tasks;
  var actorWidth = 58, actorHeight = 80, paneWidth = 802, maxIcons = 12;
  panes = livingPanes();
  
  div = d3.select('#pane' + n);
  if (div.attr('class') === 'label-disabled') return;

  if (document.getElementById("settings")) d3.select('#settings').remove();

  div = d3.select('#apprentice-backdrop')
    .append('div')
    .attr('id', 'sub-pane-one');

  if (panes[n].observations.hasOwnProperty('events')) {
    events = panes[n].observations.events[0];
    div.append('div')
      .attr('class', 'form-heading')
      .style('margin-top', '0px')
      .style('top', '-100px')
      .style('text-transform', 'capitalize')
      .html(panes[n].title);
    div.append('div')
      .attr('class', 'form-heading')
      .style('margin-top', '0px')
      .style('text-transform', 'capitalize')
      .html(events.title);
    div.append('div')
      .attr('class', 'apprentice-instructions')
      .html(events.text);

  div3 = div.append('div')
    .attr('class', 'apprentice-actors')
    .style('left', function() { var eventsCount = (events.actors.length > maxIcons) ? maxIcons : events.actors.length;
        return ((paneWidth / 2) - ((actorWidth * eventsCount) / 2)) + "px";})
    .style('width', function() { return (events.actors.length > maxIcons) ?
        (maxIcons * actorWidth) + "px" : (events.actors.length * actorWidth) + "px"});

  div4 = div3.selectAll('div')
    .data(events.actors)
    .enter().append('div')
      .attr('class', 'apprentice-actor-home')
      .style('top', function(d, i) { return (actorHeight * (Math.floor(i / maxIcons))) + 'px';})
      .style('left', function(d, i) { return (actorWidth * (i % maxIcons)) + 'px'})
      .on('click', function(d, i) { toggleEvent(i, n) });
  div4.append('p')
     .attr('class', 'actor-name')
     .attr('id', function(d, i) { return 'name_' + actor2ID(events.actors[i].device); })
     .style('color', function(d, i) { return (events.actors[i].selected) ? '#00ba00' : '#666';})
     .html(function(d, i) { return actors[events.actors[i].device].name });
  div4.append('img')
     .attr('id', function(d, i) { return 'img_' + actor2ID(events.actors[i].device); })
     .attr('src', function(d, i) { var entry = entries[actors[events.actors[i].device].deviceType] || entries.default(actors[events.actors[i].device].deviceType);
            return entry.img;})
     .style('background-color', function(d, i) { return (events.actors[i].selected) ? '#00ba00' : '#666';});
  }

// TODO: NEEDS FIXING FOR STATUS LIGHTS
  tasks = (panes[n].performances.hasOwnProperty('tasks')) ? panes[n].performances.tasks[0] : 
    (panes[n].performances.hasOwnProperty('task')) ? panes[n].performances.task[0] : [];
  div2 = div.append('div')
    .attr('id', 'sub-pane-two');
  div2.append('div')
    .attr('class', 'form-heading')
    .style('margin-top', '0px')
    .style('text-transform', 'capitalize')
    .html(tasks.title);
  div2.append('div')
    .attr('class', 'apprentice-instructions')
    .html(tasks.text);

  div3 = div2.append('div')
    .attr('class', 'apprentice-actors')
    .style('left', function() { var tasksCount = (tasks.actors.length > maxIcons) ? maxIcons : tasks.actors.length;
        return ((paneWidth / 2) - ((actorWidth * tasksCount) / 2)) + "px";})
    .style('width', function() { return (tasks.actors.length > maxIcons) ?
        (maxIcons * actorWidth) + "px" : (tasks.actors.length * actorWidth) + "px"});

  div4 = div3.selectAll('div')
    .data(tasks.actors)
    .enter().append('div')
      .attr('class', 'apprentice-actor-home')
      .style('top', function(d, i) { return (actorHeight * (Math.floor(i / maxIcons))) + 'px';})
      .style('left', function(d, i) { return (actorWidth * (i % maxIcons)) + 'px'})
      .on('click', function(d, i) { toggleTask(i, n) });
  div4.append('p')
     .attr('class', 'actor-name')
     .attr('id', function(d, i) { return 'name_' + actor2ID(tasks.actors[i].device); })
     .style('color', function(d, i) { return (tasks.actors[i].selected) ? '#00ba00' : '#666';})
     .html(function(d, i) { return actors[tasks.actors[i].device].name });
  div4.append('img')
     .attr('id', function(d, i) { return 'img_' + actor2ID(tasks.actors[i].device); })
     .attr('src', function(d, i) { var entry = entries[actors[tasks.actors[i].device].deviceType] || entries.default(actors[tasks.actors[i].device].deviceType);
            return entry.img;})
     .style('background-color', function(d, i) { return (tasks.actors[i].selected) ? '#00ba00' : '#666';});

  div3 = div2.append('div')
    .attr('class', 'action-button-group');
  div3.append('img')
    .attr('class', 'action-button')
    .attr('id', 'activator')
    .attr('src', function() { return (panes[n].active) ? 'popovers/assets/deactivate.svg' : 'popovers/assets/activate.svg'; })
    .style('opacity', function() { return (panes[n].status === 'configured') ? 1.0 : 0.4; })
    .attr('onclick', function() { return 'javascript:toggleActivate(' + n + ', event);'; });
  div3.append('img')
    .attr('class', 'action-button')
    .attr('src', 'popovers/assets/done.svg')
    .on('click', function() { goApprentices(true); });

  function toggleEvent(i, n) {
    var newColor = (events.actors[i].selected) ? '#666' : '#00ba00';
    var device = events.actors[i].device;
    events.actors[i].selected = !events.actors[i].selected;
    d3.select('#name_' + actor2ID(device))
      .style('color', newColor);
    d3.select('#img_' + actor2ID(device))
      .style('background-color', newColor);
    checkPane(panes[n]);
    updatePanesList();
    checkActivator(n);
  }

  function toggleTask(i, n) {
    var newColor = (tasks.actors[i].selected) ? '#666' : '#00ba00';
    var device = tasks.actors[i].device;
    tasks.actors[i].selected = !tasks.actors[i].selected;
    d3.select('#name_' + actor2ID(device))
      .style('color', newColor);
    d3.select('#img_' + actor2ID(device))
      .style('background-color', newColor);
    checkPane(panes[n]);
    updatePanesList();
    checkActivator(n);
  }
}

var livingPanes = function() {
  var panes = [];
  var allPanes = apprentices.home.panes;
  for (var i = 0; i < allPanes.length; i++) {
    if (allPanes[i].status !== "ignore") panes.push(allPanes[i]);
  }
  return panes;
}

var apprentices =
{ home                          :
  { title                       : 'home autonomy'
  , text                        : 'Please tell the steward your preferences for making your home autonomous.'
  , panes                       :
    [ { title                   : 'Manage Air Quality'
      , uuid                    : '749070ee-08a9-430d-8e5a-812e40a297f1'
      , text                    : 'When CO<sub>2</sub> reaches 2500ppm, circulate the air for 15min.'
                                   // or 'configured' or 'ignore' or 'incomplete'
      , status                  : 'incomplete'
      , active                  : null
      , observations            :
        { title                 : 'Monitor Air Quality'
        , uuid                  : '749070ee-08a9-430d-8e5a-812e40a297f1:events'
        , operator              : 'or'
        , text                  : ''
        , events                :
          [ { title             : 'Air Sensors'
            , uuid              : '749070ee-08a9-430d-8e5a-812e40a297f1:event:air-sensors'
            , text              : 'Please chooose one or more things to monitor for CO<sub>2</sub>.'
            , deviceType        : '^/device/climate/[^/]+/meteo$'
            , mustHave          : [ 'co2' ]
            , operator          : 'or'
            , '.condition'      : { operator: 'greater-than', operand1: '.[.co2].', operand2: 2499 }
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      , performances            :
        { title                 : 'Circulate the Air'
        , uuid                  : '749070ee-08a9-430d-8e5a-812e40a297f1:tasks'
        , operator              : 'and'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Fans'
            , uuid              : '749070ee-08a9-430d-8e5a-812e40a297f1:task:fans'
            , text              : 'Please choose one or more things to circulate the air.'
            , deviceType        : '^/device/climate/[^/]+/control$'
            , mustHave          : [ 'hvac' ]
            , operator          : 'and'
            , '.set'            : { fan: 900000 }
            , guard             : { '.condition' : { operator: 'equals', operand1: '.[.hvac].', operand2: 'off' } }
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    , { title                   : 'Status lights'
      , uuid                    : '40e40662-3bed-4a5a-968d-99e8c7d1917b:'
      , text                    : 'Select lights to report change of conditions.'
      , status                  : 'incomplete'
      , active                  : null
      , observations            :
        { title                 : ''
        , text                  : ''
        , event                 : [ { title     : 'Red alert'
                                    , uuid      : '40e40662-3bed-4a5a-968d-99e8c7d1917b:event:red alert'
                                    , actor     : 'place/1'
                                    , observe   : '.condition'
                                    , parameter : { operator: 'equals', operand1: '.[.status].', operand2: 'red' }
                                    }
                                  , { title     : 'Orange alert'
                                    , uuid      : '40e40662-3bed-4a5a-968d-99e8c7d1917b:event:orange alert'
                                    , actor     : 'place/1'
                                    , observe   : '.condition'
                                    , parameter : { operator: 'equals', operand1: '.[.status].', operand2: 'orange' }
                                    }
                                  , { title     : 'Status blue'
                                    , uuid      : '40e40662-3bed-4a5a-968d-99e8c7d1917b:event:status blue'
                                    , actor     : 'place/1'
                                    , observe   : '.condition'
                                    , parameter : { operator: 'equals', operand1: '.[.status].', operand2: 'blue' }
                                    }
                                  , { title     : 'Status green'
                                    , uuid      : '40e40662-3bed-4a5a-968d-99e8c7d1917b:event:status green'
                                    , actor     : 'place/1'
                                    , observe   : '.condition'
                                    , parameter : { operator: 'equals', operand1: '.[.status].', operand2: 'green' }
                                    }
                                  ]
        }
      , performances            :
        { title                 : 'Status lights'
        , text                  : ''
        , task                  :
          [ { title             : 'Lights'
            , uuid              : '40e40662-3bed-4a5a-968d-99e8c7d1917b:task:'
            , text              : ''
            , deviceType        : '^/device/lighting/[^/]+/[^/]+$'
            , mustHave          : [ ]
            , operator          : 'and'
            , tasks             : [ { perform   : '.on' 
                                    , parameter : { color: { model: 'rgb', rgb: { r: 255, g:   0, b:   0 }}, brightness: 50 }
                                    }
                                  , { perform   : '.on' 
                                    , parameter : { color: { model: 'rgb', rgb: { r: 255, g: 131, b:   0 }}, brightness: 25 }
                                    }
                                  , { perform   : '.on' 
                                    , parameter : { color: { model: 'rgb', rgb: { r:   0, g:   0, b: 255 }}, brightness:  5 }
                                    }
                                  , { perform   : '.on' 
                                    , parameter : { color: { model: 'rgb', rgb: { r:   0, g: 255, b:   0 }}, brightness:  5 }
                                    }
                                  ]
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    , { title                   : 'Here Comes the Sun'
      , uuid                    : 'f7063811-da36-4998-b31c-35d0a4ba88d6'
      , text                    : 'At dawn, tasks to perform.'
      , status                  : 'incomplete'
      , active                  : null
      , observations            :
        { title                 : ''
        , text                  : ''
// no events, so display only tasks...
        , event                 : { title     : 'Solar dawn'
                                  , uuid      : 'f7063811-da36-4998-b31c-35d0a4ba88d6:event:solar dawn'
                                  , actor     : 'place/1'
                                  , observe   : 'solar'
                                  , parameter : 'dawn'
                                  }
        }
      , performances            :
        { title                 : 'Dawn tasks'
        , uuid                  : 'f7063811-da36-4998-b31c-35d0a4ba88d6:tasks'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Lights at dawn'
            , uuid              : 'f7063811-da36-4998-b31c-35d0a4ba88d6:task:lights at dawn'
            , text              : 'Please choose one or more lights to go on at dawn.'
            , deviceType        : '^/device/lighting/[^/]+/[^/]+$'
            , mustHave          : [ ]
            , operator          : 'and'
            , '.on'             : { brightness: 70 }
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    , { title                   : 'There Goes the Sun'
      , uuid                    : '46da63fb-eee0-4ab3-89a8-e7693b8138d8'
      , text                    : 'At dusk, tasks to perform.'
      , status                  : 'incomplete'
      , active                  : null
      , observations            :
        { title                 : ''
        , text                  : ''
        , event                 : { title     : 'Solar dusk'
                                  , uuid      : '46da63fb-eee0-4ab3-89a8-e7693b8138d8:event:solar dusk'
                                  , actor     : 'place/1'
                                  , observe   : 'solar'
                                  , parameter : 'dusk'
                                  }
        }
      , performances            :
        { title                 : 'Dusk tasks'
        , uuid                  : '46da63fb-eee0-4ab3-89a8-e7693b8138d8:tasks'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Lights at dusk'
            , uuid              : '46da63fb-eee0-4ab3-89a8-e7693b8138d8:task:lights at dusk'
            , text              : 'Please choose one or more lights to go on at dusk.'
            , deviceType        : '^/device/lighting/[^/]+/[^/]+$'
            , mustHave          : [ ]
            , operator          : 'and'
            , '.on'             : { brightness: 70 }
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    , { title                   : 'Late at night'
      , uuid                    : 'e745eb62-ff24-444d-9a57-75b390fc3166'
      , text                    : 'At late night, tasks to perform.'
      , status                  : 'incomplete'
      , active                  : null
      , observations            :
        { title                 : ''
        , text                  : ''
        , event                 : { title     : 'Solar nadir'
                                  , uuid      : 'e745eb62-ff24-444d-9a57-75b390fc3166:event:solar nadir'
                                  , actor     : 'place/1'
                                  , observe   : 'solar'
                                  , parameter : 'nadir'
                                  }
        }
      , performances            :
        { title                 : 'Late night tasks'
        , uuid                  : 'e745eb62-ff24-444d-9a57-75b390fc3166:tasks'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Lights at late night'
            , uuid              : 'e745eb62-ff24-444d-9a57-75b390fc3166:task:lights at late night'
            , text              : 'Please choose one or more lights to turn off late at night.'
            , deviceType        : '^/device/lighting/[^/]+/[^/]+$'
            , mustHave          : [ ]
            , operator          : 'and'
            , '.off'            : ''
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    ]
  }

  // more built-in apprentices defined here, e.g., for motive...
};


var prepare = function(apprentice, actors, activities) {
  var again, d, event, group, i, j, k, l, m, n, pane, suffixes, task, uuid;
  
  again = false;

  d = organize(activities);

  for (i = apprentice.panes.length - 1; i !== -1; i--) {
    pane = apprentice.panes[i];
	pane.active = !!d.activities[pane.uuid] && d.activities[pane.uuid].active;

    if (!!pane.observations.events) for (j = pane.observations.events.length -1; j !== -1; j--) {
      event = pane.observations.events[j];
      event.actors = findActors(actors.result, new RegExp(event.deviceType.split('/').join('\\/')), event.mustHave);
      if (!d.groups[event.uuid]) continue;

      group = d.groups[event.uuid];
      for (k = 0; k < event.actors.length; k++) {
        event.actors[k].selected = group.devices.indexOf(event.actors[k].device) !== -1;
      }
    }

    suffixes = [];
    if (Array.isArray(pane.observations.event)) for (j = pane.observations.event.length -1; j !== -1; j--) {
      event = pane.observations.event[j];
      k = event.uuid.indexOf(':event:');
      if (k === -1) continue;
      suffixes.push(event.uuid.substr(k + 6));
    }

    if (!!pane.performances.tasks) for (j = pane.performances.tasks.length -1; j !== -1; j--) {
      task = pane.performances.tasks[j];
      task.actors = findActors(actors.result, new RegExp(task.deviceType.split('/').join('\\/')), task.mustHave);
      if (d.groups[task.uuid]) {
        group = d.groups[task.uuid];
        for (k = 0; k < task.actors.length; k++) task.actors[k].selected = group.devices.indexOf(task.actors[k].device) !== -1;
      }
      if (suffixes.length === 0) continue;

      for (l = 0; l < suffixes.length; l++) {
        uuid = task.uuid + suffixes[l];
        group = d.tasks[uuid] && d.tasks[uuid].actor && find(d.groups, d.tasks[uuid].actor);
        if (!group) continue;
        for (k = 0; k < task.actors.length; k++) {
          if (group.devices.indexOf(task.actors[k].device) !== -1) task.actors[k].selected = true;
        }
      }
    }

    checkPane(pane);

    again = setup(pane, d);
  }
  if (again) {
    setTimeout(function() { refreshActors(4) }, 0);
  } else {
    finishApprentices();
  }
};

var checkPane = function(pane) {
	var event, events, i, j, task, tasks;
	var result = "incomplete";
	
	if (!!pane.observations.events) for (i = 0; i < pane.observations.events.length; i++) {
		event = pane.observations.events[i]; 
		if (!!event.actors && Array.isArray(event.actors)) {
			if (event.actors.length === 0) {
				result = "ignore";
			} else if (!hasHowMany(event.actors.length, event.howMany)) {
				result = "ignore";
			} else {
				events = 0;
				for (j = 0; j < event.actors.length; j++) {
					if (event.actors[j].hasOwnProperty("selected") && event.actors[j].selected) events++;
				}
			}
		}
	}
	
	if (result !== "ignore") {
		if (!!pane.performances.tasks) for (i = 0; i < pane.performances.tasks.length; i++) {
			task = pane.performances.tasks[i]; 
			if (!!task.actors && Array.isArray(task.actors)) {
				if (task.actors.length === 0) {
					result = "ignore";
				} else if (!hasHowMany(task.actors.length, task.howMany)) {
					result = "ignore";
				} else {
					tasks = 0;
					for (j = 0; j < task.actors.length; j++) {
						if (task.actors[j].hasOwnProperty("selected") && task.actors[j].selected) tasks++;
					}
				}
			}
		}
	}
	
	if (event && task) {
	  if ((hasHowMany(events, event.howMany)) && (hasHowMany(tasks, task.howMany))) {
	    result = "configured";
	  }
	} else if ((event && hasHowMany(events, event.howMany)) || (task && hasHowMany(tasks, task.howMany))) result = "configured";

	pane.status = result;

	function hasHowMany(val, howMany) {
		var int, operand;
		int = parseInt(howMany, 10);
		operand = howMany.charAt(howMany.length - 1);
		switch (operand) {
			case "+":
				return val >= int;
				break;
			case "-":
				return val <= int;
				break;
			default:
				return val === int;
				break;
		}
	}
}

var findActors = function(actors, pattern, mustHave) {
  var actor, device, i, proto, result;

  result = [];
  for (actor in actors) {
    if ((!actors.hasOwnProperty(actor)) || (!pattern.test(actor))) continue;

    if ((!!mustHave) && (mustHave.length > 0)) {
      proto = actors.actors[actor];
      for (i = mustHave.length - 1; i !== -1; i--) if (!proto.properties[mustHave[i]]) break;
      if (i !== -1) continue;
    }

    for (device in actors[actor]) if (actors[actor].hasOwnProperty(device)) {
      result.push({ device: device, selected: false });
    }
  }
  return result;
};

var organize = function(activities) {
  var d, v, w, x, y;

  d = { activities: {}, events: {}, tasks: {}, actors: {}, groups: {}, devices: {} };
  for (x in activities.result) {
    if (!activities.result.hasOwnProperty(x)) continue;
    y = activities.result[x];

    d[x] = {};
    for (w in y) {
      if (!y.hasOwnProperty(w)) continue;
      v = y[w];

      v.id = w;
      d[x][v.uuid || w] = v;
    }
  }

  for (x in d.groups) {
    if (!d.groups.hasOwnProperty(x)) continue;
    y = d.groups[x];

    y.devices = dive(d, y.members);
  }

  return d;
};

var dive = function(d, members) {
  var actor, child, devices, i;

  devices = [];
  for (i = 0; i < members.length; i++) {
    actor = members[i].split('/');
    if (actor[0] === 'device') {
      devices.push(members[i]);
      continue;
    }
    child =   (actor[0] === 'group') ? find(d.groups, members[i])
            : (actor[0] === 'event') ? find(d.events, members[i])
            : (actor[0] === 'task')  ? find(d.tasks,  members[i])
            : null;
    if (!!child) devices = devices.concat(dive(d, (!!child.members) ? child.members : [ child.actor ]));
  }

  return devices;
};

var find = function(entities, id) {
  var x;

  for (x in entities) if ((entities.hasOwnProperty(x)) && (entities[x].id === id)) return entities[x];
};


// on a vanilla steward, this should converge after 4 calls...

var rID = 1024;

var setup = function(pane, d) {
  var event, task;

  if (!!d.activities[pane.uuid]) return;

  if (Array.isArray(pane.observations.event)) {
    if (!Array.isArray(pane.performances.task)) return;
  } else if (Array.isArray(pane.performances.task)) return;

  event = setup_observations(pane.observations, d);
  task = setup_performances(pane, pane.observations, pane.performances, d);

  if ((!event) || (!task)) return true;

//console.log('[setup] create activity ' + pane.uuid + ' event=' + event + ' task=' + task);
  wsSend(JSON.stringify({ path      : '/api/v1/activity/create/' + pane.uuid
                        , requestID : ++rID
                        , name      : pane.title
                        , event     : event
                        , task      : task
                        }));
  return false;
};

var setup_observations = function(observations, d) {
  var event, i, members;

  if (!!observations.uuid) {
    if (!!d.groups[observations.uuid]) return d.groups[observations.uuid].id;
    if (!observations.events) return;

    members = [];
    for (i = 0; i < observations.events.length; i++) {
      event = observations.events[i];
      if (!!d.groups[event.uuid]) {
        members.push(d.groups[event.uuid].id);
        continue;
      }

//console.log('[setup_observations] create group ' + event.uuid);
      wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + event.uuid
                            , requestID : ++rID
                            , name      : event.title
                            , type      : 'event'
                            , operator  : event.operator
                            , members   : []
                            }));
    }
    if (members.length === observations.events.length) {
//console.log('[setup_observations] create group ' + observations.uuid);
      wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + observations.uuid
                            , requestID : ++rID
                            , name      : observations.title
                            , type      : 'event'
                            , operator  : observations.operator
                            , members   : members
                            }));
    }

    return;
  }

  if (!observations.event) return;

  if (Array.isArray(observations.event)) {
    for (i = 0; i < observations.event.length; i++) {
      event = observations.event[i];
      if (!!d.events[event.uuid]) continue;

//console.log('[setup_observations] create event ' + event.uuid);
       wsSend(JSON.stringify({ path      : '/api/v1/event/create/' + event.uuid
                             , requestID : ++rID
                             , name      : event.title
                             , actor     : event.actor
                             , observe   : event.observe
                             , parameter : parameterize(event.parameter)
                             }));
    }

    return;
  }

  event = observations.event;
  if (!!d.events[event.uuid]) return d.events[event.uuid].id;

//console.log('[setup_observations] create event ' + event.uuid);
  wsSend(JSON.stringify({ path      : '/api/v1/event/create/' + event.uuid
                        , requestID : ++rID
                        , name      : event.title
                        , actor     : event.actor
                        , observe   : event.observe
                        , parameter : parameterize(event.parameter)
                        }));
};

var setup_performances = function(pane, observations, performances, d) {
  var event, members, i, j, suffix, task, tasks, uuid1, uuid2;

  if (!!performances.uuid) {
    if (!!d.groups[performances.uuid]) return d.groups[performances.uuid].id;
    if (!performances.tasks) return;

    members = [];
    for (i = 0; i < performances.tasks.length; i++) {
      task = performances.tasks[i];
      if (!!d.groups[task.uuid]) {
        members.push(d.groups[task.uuid].id);
        continue;
      }

//console.log('[setup_performances] create group ' + task.uuid);
      wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + task.uuid
                            , requestID : ++rID
                            , name      : task.title
                            , type      : 'task'
                            , operator  : task.operator
                            , members   : []
                            }));
    }
    if (members.length === performances.tasks.length) {
//console.log('[setup_performances] create group ' + performances.uuid);
      wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + performances.uuid
                            , requestID : ++rID
                            , name      : performances.title
                            , type      : 'task'
                            , operator  : performances.operator
                            , members   : members
                            }));
    }

    return;
  }

  if (!performances.task) return;

  if (Array.isArray(performances.task)) {
    if (performances.task.length !== 1) return;

    tasks = performances.task[0];
    for (i = 0; i < tasks.tasks.length; i++) {
      event = observations.event[i];
      task = tasks.tasks[i];

      j = event.uuid.lastIndexOf(':');
      suffix = (j !== -1) ? event.uuid.substring(j + 1) : i.toString();
      uuid1 = tasks.uuid + suffix;

      if (!!d.groups[uuid1]) {
        if (!d.events[event.uuid]) continue;
        uuid2 = pane.uuid + suffix;
        if (!!d.activities[uuid2]) continue;

//console.log('[setup_performances] create activity ' + uuid2 + ' event=' + d.events[event.uuid].id + ' task=' + d.groups[uuid1].id);
        wsSend(JSON.stringify({ path      : '/api/v1/activity/create/' + uuid2
                              , requestID : ++rID
                              , name      : event.title
                              , event     : d.events[event.uuid].id
                              , task      : d.groups[uuid1].id
                              }));
        continue;
      }

//console.log('[setup_performances] create group ' + uuid1);
       wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + uuid1
                             , requestID : ++rID
                             , name      : event.title
                             , type      : 'task'
                             , operator  : tasks.operator
                             , members   : []
                             }));
    }

    return;
  }

  task = performances.task;
  if (!!d.tasks[task.uuid]) return d.tasks[task.uuid].id;

//console.log('[setup_performances] create task ' + task.uuid);
  wsSend(JSON.stringify({ path      : '/api/v1/task/create/' + task.uuid
                        , requestID : ++rID
                        , name      : task.title
                        , actor     : task.actor
                        , perform   : task.perform
                        , parameter : parameterize(task.parameter)
                        }));
};

var parameterize = function(s) { return ((typeof s !== 'string') ? JSON.stringify(s) : s); };

if (!Array.isArray) Array.isArray = function(a) { return Object.prototype.toString.call(a) === '[object Array]'; };

var checkActivator = function(n) {
  d3.select('#activator')
    .style('opacity', function() { return (livingPanes()[n].status === 'configured') ? 1.0 : 0.4; });
}

var toggleActivate = function(n, evt) {
  var panesList = livingPanes();
  if (panesList[n].status === 'configured') {
    panesList[n].active = (panesList[n].active === true) ? false : true;
    d3.select('#activator')
      .attr('src', function() { return (panesList[n].active) ? 'popovers/assets/deactivate.svg' : 'popovers/assets/activate.svg'; });
    updatePanesList();
  }
}

var sendApprData = function() {
console.log('Sending apprentice data...');
};