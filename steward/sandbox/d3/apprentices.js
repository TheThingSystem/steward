var onOffSliderPane = { "min": 7, "max": 38 };

var goApprentices = function(local) {
  var backdrop;
  apprentices.currPaneIndex = null;

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

  if (!local) {refreshActors(10); } else { finishApprentices(); }
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
    .attr('class', 'panes')
    .attr('id', 'panes');
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
        .transition()
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
    .transition().each('end', sendPaneArmed(i, panesList[i].active))
    .duration(600)
    .style('left', endLeft + 'px');
}

var sendPaneArmed = function(paneIndex, armed) {
  var activityIDs, events, i, panesList;
  panesList = livingPanes();
  activityIDs = [ ];
  events = panesList[paneIndex].observations.event;
  
  if (Array.isArray(events)) {
    for (i = 0; i < events.length; i++) {
      activityIDs.push(apprentices.d.activities[events[i].uuid.replace(/:event:/, ':')].id.match(/\/(.+)$/)[1]);
    }
  } else {
    activityIDs.push(apprentices.d.activities[panesList[paneIndex].uuid].id.match(/\/(.+)$/)[1]);
  }
  
  for (i = 0; i < activityIDs.length; i++) {
    sendIt(JSON.stringify({ path       : '/api/v1/activity/modify/' + activityIDs[i]
                           , requestID : ++reqno
                           , armed     : armed
                           }));
  }
}

var goPaneDetail = function(n) {
  var div, div2, div3, div4, events, groupNr_event, groupNr_task, hasSubTasks, isGuardedTask, j, k, oneEvent, oneTask, oneUUID, panes, subEvents, tasks;
  var actorWidth = 58, actorHeight = 80, paneWidth = 802, maxIcons = 12;
  panes = livingPanes();
  apprentices.currPaneIndex = n;
  
  div = d3.select('#pane' + n);
  if (div.attr('class') === 'label-disabled') return;

  if (document.getElementById("settings")) d3.select('#settings').remove();

  div = d3.select('#apprentice-backdrop')
    .append('div')
    .attr('id', 'sub-pane-one');
  div2 = div.append('div')
    .attr('class', 'form-heading')
    .style('margin-top', '0px')
    .style('top', '-100px')
    .style('text-transform', 'capitalize')
    .html(panes[n].title);
  div2.append('div')
    .attr('class', 'apprentice-instructions')
    .html(panes[n].text);

  if (panes[n].observations.hasOwnProperty('events')) {
    events = panes[n].observations.events;
    for (j = 0; j < events.length; j++) {
      oneEvent = events[j];
      groupNr_event = [(apprentices.d.groups[oneEvent.uuid].id).match(/\/(.+)$/)[1]];
      div.append('div')
        .attr('class', 'form-heading')
        .style('margin-top', '0px')
        .style('text-transform', 'capitalize')
        .html(oneEvent.title);
      div.append('div')
        .attr('class', 'apprentice-instructions')
        .html(oneEvent.text);

      div3 = div.append('div')
        .attr('class', 'apprentice-actors')
        .style('left', function() { var eventsCount = (oneEvent.actors.length > maxIcons) ? maxIcons : oneEvent.actors.length;
            return ((paneWidth / 2) - ((actorWidth * eventsCount) / 2)) + "px";})
        .style('width', function() { return (oneEvent.actors.length > maxIcons) ?
            (maxIcons * actorWidth) + "px" : (oneEvent.actors.length * actorWidth) + "px"});
    
      div4 = div3.selectAll('div')
        .data(oneEvent.actors)
        .enter().append('div')
          .attr('class', 'apprentice-actor-home')
          .style('top', function(d, i) { return (actorHeight * (Math.floor(i / maxIcons))) + 'px';})
          .style('left', function(d, i) { return (actorWidth * (i % maxIcons)) + 'px'})
          .on('click', function(d, i) { toggleEvent(i, n, j-1, groupNr_event) });
      div4.append('p')
         .attr('class', 'actor-name')
         .attr('id', function(d, i) { return 'name_' + actor2ID(oneEvent.actors[i].device); })
         .style('color', function(d, i) { return (oneEvent.actors[i].selected) ? '#00ba00' : '#666';})
         .html(function(d, i) { return actors[oneEvent.actors[i].device].name });
      div4.append('img')
         .attr('id', function(d, i) { return 'img_' + actor2ID(oneEvent.actors[i].device); })
         .attr('src', function(d, i) { var entry = entries[actors[oneEvent.actors[i].device].deviceType] 
           || entries.default(actors[oneEvent.actors[i].device].deviceType);
                return entry.img;})
         .style('background-color', function(d, i) { return (oneEvent.actors[i].selected) ? '#00ba00' : '#666';});
      }
    }

    if (panes[n].performances.hasOwnProperty('tasks')) {
      tasks = panes[n].performances.tasks;
      hasSubTasks = false;
    } else {
      tasks = panes[n].performances.task;
      hasSubTasks = true;
    }
    for (j = 0; j < tasks.length; j++) {
      oneTask = tasks[j];
      isGuardedTask = (!!oneTask.guard);
      groupNr_task = [];
      if (!hasSubTasks) {
      	groupNr_task = [(apprentices.d.groups[oneTask.uuid].id).match(/\/(.+)$/)[1]];
      } else {
        subEvents = panes[n].observations.event;
        for (k = 0; k < subEvents.length; k++) {
          oneUUID = subEvents[k].uuid.replace(/\:event\:/, ':task:');
          groupNr_task.push((apprentices.d.groups[oneUUID].id).match(/\/(.+)$/)[1]);
        }
      }
      div2 = div.append('div')
        .attr('id', 'sub-pane-two');
      div2.append('div')
        .attr('class', 'form-heading')
        .style('margin-top', '0px')
        .style('text-transform', 'capitalize')
        .html(oneTask.title);
      div2.append('div')
        .attr('class', 'apprentice-instructions')
        .html(oneTask.text);

      div3 = div2.append('div')
        .attr('class', 'apprentice-actors')
        .style('left', function() { var tasksCount = (oneTask.actors.length > maxIcons) ? maxIcons : oneTask.actors.length;
            return ((paneWidth / 2) - ((actorWidth * tasksCount) / 2)) + "px";})
        .style('width', function() { return (oneTask.actors.length > maxIcons) ?
            (maxIcons * actorWidth) + "px" : (oneTask.actors.length * actorWidth) + "px"});

      div4 = div3.selectAll('div')
        .data(oneTask.actors)
        .enter().append('div')
          .attr('class', 'apprentice-actor-home')
          .style('top', function(d, i) { return (actorHeight * (Math.floor(i / maxIcons))) + 'px';})
          .style('left', function(d, i) { return (actorWidth * (i % maxIcons)) + 'px'})
          .on('click', function(d, i) { if (isGuardedTask) {
                                          toggleGuardedTask(i, n, j-1, groupNr_task) 
                                        } else if (hasSubTasks) {
                                          toggleMultiTask(i, n, j-1, groupNr_task)
                                        } else { 
                                          toggleTask(i, n, j-1, groupNr_task)
                                        }
                                      });
      div4.append('p')
         .attr('class', 'actor-name')
         .attr('id', function(d, i) { return 'name_' + actor2ID(oneTask.actors[i].device); })
         .style('color', function(d, i) { return (oneTask.actors[i].selected) ? '#00ba00' : '#666';})
         .html(function(d, i) { return actors[oneTask.actors[i].device].name });
      div4.append('img')
         .attr('id', function(d, i) { return 'img_' + actor2ID(oneTask.actors[i].device); })
         .attr('src', function(d, i) { var entry = entries[actors[oneTask.actors[i].device].deviceType] 
             || entries.default(actors[oneTask.actors[i].device].deviceType);
             return entry.img;})
         .style('background-color', function(d, i) { return (oneTask.actors[i].selected) ? '#00ba00' : '#666';});
    }
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
    .on('click', function() { goApprentices(false); });

  function toggleEvent(i, n, eventIndex, groupNr) {
    var device, event, rowID, members, newColor, uuid;
    members = [];
    device = events[eventIndex].actors[i].device;
    events[eventIndex].actors[i].selected = !events[eventIndex].actors[i].selected;
    uuid = events[eventIndex].uuid + ":" + device.replace(/\//, ":");

    if (events[eventIndex].actors[i].selected) {
      newColor = '#00ba00';
      sendIt(JSON.stringify({ path      : '/api/v1/event/create/' + uuid
                             , requestID : add_callback(function(message) { if (message.result) {onCreateEventOrTask(message, 'event', eventIndex, groupNr)} })
                             , name      : events[eventIndex].title
                             , actor     : device
                             , observe   : '.condition'
                             , parameter : parameterize(events[eventIndex]['.condition'])
                             }));
    } else {
      newColor = '#666';
      rowID = apprentices.d.events[uuid].id.match(/\/(.+)$/)[1];
      sendIt(JSON.stringify({ path      : '/api/v1/event/delete/' + rowID
                             , requestID : add_callback(function(message) { if (message.result) {onCreateEventOrTask(message, 'event', eventIndex, groupNr)} })
                            }));
    }

    d3.select('#name_' + actor2ID(device))
      .style('color', newColor);
    d3.select('#img_' + actor2ID(device))
      .style('background-color', newColor);
    checkPane(panes[n]);
    updatePanesList();
    checkActivator(n);
  }

  function toggleTask(i, n, taskIndex, groupNr) {
    var device, guardEvent = null, members, newColor, perform, rowID, task, uuid;
    members = [];
    device = tasks[taskIndex].actors[i].device;
    tasks[taskIndex].actors[i].selected = !tasks[taskIndex].actors[i].selected;
    uuid = tasks[taskIndex].uuid + ":" + device.replace(/\//, ":");

    for (task in tasks[taskIndex]) {
      if (/^\./.test(task)) {
        perform = task;
        break;
      }
    }
    if (tasks[taskIndex].actors[i].selected) {
      newColor = '#00ba00';
      if (!!tasks[taskIndex].guard && apprentices.d.events[uuid]) guardEvent = apprentices.d.events[uuid].id;
      sendIt(JSON.stringify({ path       : '/api/v1/task/create/' + uuid
                             , requestID : add_callback(function(message) { if (message.result) {onCreateEventOrTask(message, 'task', taskIndex, groupNr)} })
                             , name      : tasks[taskIndex].title
                             , actor     : device
                             , perform   : perform.match(/\.(.+)$/)[1]
                             , parameter : parameterize(tasks[taskIndex][perform])
                             , guard     : guardEvent
                             }));
    } else {
      newColor = '#666';
      rowID = apprentices.d.tasks[uuid].id.match(/\/(.+)$/)[1];
      sendIt(JSON.stringify({ path      : '/api/v1/task/delete/' + rowID
                             , requestID : add_callback(function(message) { if (message.result) {onCreateEventOrTask(message, 'task', taskIndex, groupNr)} })
                                }));
    }

    d3.select('#name_' + actor2ID(device))
      .style('color', newColor);
    d3.select('#img_' + actor2ID(device))
      .style('background-color', newColor);
    checkPane(panes[n]);
    updatePanesList();
    checkActivator(n);
  }
  
  function onToggleGuardEvent(i, n, taskIndex, groupNr) {
    sendIt(JSON.stringify({ path       : '/api/v1/activity/list/'
                           , requestID : add_callback(function(message1) { if (message1.result) {
                                            apprentices.d = organize(message1); toggleTask(i, n, taskIndex, groupNr); console.log('onToggleGuardEvent callback');
                                            console.log(message1);} })
                           , options   : { depth: 'all' }
                           }));  
  };
  
  function toggleGuardedTask(i, n, taskIndex, groupNr) {
    var device, rowID, task, uuid;
    device = tasks[taskIndex].actors[i].device;
    uuid = tasks[taskIndex].uuid + ":" + device.replace(/\//, ":");
  
    if (!tasks[taskIndex].actors[i].selected) {
      console.log('create guard event');
      sendIt(JSON.stringify({ path       : '/api/v1/event/create/' + uuid
                             , requestID : add_callback(function(message) { if (message.result) {
                                             onToggleGuardEvent(i, n, taskIndex, groupNr);
                                             console.log('toggleGuardedTask/event/create callback');
                                             console.log(message);}
                             })
                             , name      : tasks[taskIndex].title
                             , actor     : device
                             , observe   : '.condition'
                             , parameter : parameterize(tasks[taskIndex].guard['.condition'])
                             }));

    } else {
      console.log('delete guard event');
      rowID = apprentices.d.events[uuid].id.match(/\/(.+)$/)[1];
      sendIt(JSON.stringify({ path       : '/api/v1/event/delete/' + rowID
                             , requestID : add_callback(function(message) { if (message.result) {
                                             onToggleGuardEvent(i, n, taskIndex, groupNr);
                                             console.log('toggleGuardedTask/event/delete callback');}
                             })}));
    }
  }
  
  function toggleMultiTask(i, n, taskIndex, groupNr) {
    var cb, device, eventIndex, groupNr_task, guardEvent = null, members, newColor, params, perform, rowID, task, uuid;
    members = [];
    device = tasks[taskIndex].actors[i].device;
    tasks[taskIndex].actors[i].selected = !tasks[taskIndex].actors[i].selected;
    
    for (eventIndex = 0; eventIndex < subEvents.length; eventIndex++) {
      uuid = subEvents[eventIndex].uuid.replace(/:event:/, ":task:") + ":" + device.replace(/\//, ":");
      perform = tasks[taskIndex].tasks[eventIndex].perform;
      params = tasks[taskIndex].tasks[eventIndex].parameter;
      groupNr_task = groupNr[eventIndex];
      cb = (eventIndex === subEvents.length - 1) ? 
        function(message) { if (message.result) {readActivities(message, 'task', n, taskIndex, groupNr, device, newColor);} } : function(message) { };
      
      if (tasks[taskIndex].actors[i].selected) {
        newColor = '#00ba00';
        if (!!tasks[taskIndex].guard && apprentices.d.events[uuid]) guardEvent = apprentices.d.events[uuid].id;
        sendIt(JSON.stringify({ path       : '/api/v1/task/create/' + uuid
                               , requestID : add_callback(cb)
                               , name      : tasks[taskIndex].title
                               , actor     : device
                               , perform   : perform.match(/\.(.+)$/)[1]
                               , parameter : parameterize(params)
                               , guard     : guardEvent
                               }));
      } else {
        newColor = '#666';
        rowID = apprentices.d.tasks[uuid].id.match(/\/(.+)$/)[1];
        sendIt(JSON.stringify({ path       : '/api/v1/task/delete/' + rowID
                               , requestID : add_callback(cb)
                               }));
      }
    }
    
    function readActivities(message, type, n, itemIndex, groupNr, device, newColor) {
      sendIt(JSON.stringify({ path       : '/api/v1/activity/list/'
                             , requestID : add_callback(function(message1) { if (message1.result) {
                               apprentices.d = organize(message1); onCreateMultiEventOrTask(message1, 'task', n, taskIndex, groupNr, device, newColor); console.log(message1); } })
                             , options: { depth: 'all' }
                             })); 

    }
  }
}

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
    sendPaneArmed(n, panesList[n].active);
    updatePanesList();
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

var updateGroupMembers = function(groupMembers) {
  var cb, groupNr, i, max;
  
  max = 1;
  i = 1;
  if (livingPanes()[apprentices.currPaneIndex].observations.event)
    max = livingPanes()[apprentices.currPaneIndex].observations.event.length;
  for (groupID in groupMembers) {
    groupNr = groupID.match(/\/(.+)$/)[1];
    cb = (i++ < max) ? function(message) { } : function(message) { refreshApprenticeActors(message); };
    sendIt(JSON.stringify({ path      : '/api/v1/group/modify/' + groupNr
                          , requestID : add_callback(cb)
                          , members   : groupMembers[groupID].members
                          }));
  }
}

// Callback functions
var refreshApprenticeActors = function(message) {
  if (!message.result) return;
  sendIt(JSON.stringify({ path      : '/api/v1/actor/list/'
                        , requestID : add_callback(function(message1) { refreshActivities(message1) })
                        , options   : { depth: 'all' }
                        }));
}

var refreshActivities = function(message) {
  var apprenticeActors;
  if (!message.result) return;
  apprenticeActors = message;

  sendIt(JSON.stringify({ path       : '/api/v1/activity/list/'
                         , requestID : add_callback(function(message1) { if (message1.result) {
                         apprentices.d = organize(message1); console.log(message1); } })
                         , options: { depth: 'all' }
                         })); 

}

var onCreateEventOrTask = function(message, type, itemIndex, groupNr) {
  var dKey, groupID, groupMembers, items, j, members, pane, recentItem, uuid;
  if (!!message.result) recentItem = message.result;   // 'task/N'
  if (recentItem === undefined) return;
  groupMembers = { };
  groupID = 'group/' + groupNr; // 'group/N'
  groupMembers[groupID] = {members: [ ]};
  
  // Assemble members
  dKey = type + 's';
  pane = livingPanes()[apprentices.currPaneIndex];
  items = (type === "event") ? pane.observations.events[itemIndex] : pane.performances.tasks[itemIndex];
  members = [];
  
	for (j = 0; j < items.actors.length; j++) {
		if (items.actors[j].selected) {
			uuid = items.uuid + ":" + items.actors[j].device.replace(/\//, ":");
			if (apprentices.d[dKey].hasOwnProperty(uuid)) {
			  groupMembers[groupID].members.push(apprentices.d[dKey][uuid].id);
			} else {
			  groupMembers[groupID].members.push(type + '/' + recentItem[type]);
			}
    }
	}

  console.log(groupMembers);
  updateGroupMembers(groupMembers);
}

var onCreateMultiEventOrTask = function(message, type, n, itemIndex, groupNr, displayedDevice, newColor) {
  var device, dKey, eventIndex, groupID, groupMembers, groupUUID, items, j, members, pane, subEvents, taskUUID, uuid;
  groupMembers = { };
  
  // Assemble members
  dKey = type + 's';
  pane = livingPanes()[apprentices.currPaneIndex];
  subEvents = pane.observations.event;
  items = pane.performances.task[itemIndex];
  members = [];
  list_activity(ws2, '',  { depth: 'all' }, function(message) {apprentices.d = organize(message); gatherMembers(); console.log(message);});
  
  function gatherMembers() {
    for (eventIndex = 0; eventIndex < subEvents.length; eventIndex++) {
      groupUUID = subEvents[eventIndex].uuid.replace(/\:event\:/, ':task:');
      groupID = apprentices.d.groups[groupUUID].id;    // 'group/N'
      if (!groupMembers.hasOwnProperty(groupID)) groupMembers[groupID] = {members: [ ]};
    }
    
    for (j = 0; j < items.actors.length; j++) {
      if (items.actors[j].selected) {
        device = items.actors[j].device;  // 'device/N'
        for (eventIndex = 0; eventIndex < subEvents.length; eventIndex++) {
          groupUUID = subEvents[eventIndex].uuid.replace(/\:event\:/, ':task:');
          taskUUID = groupUUID + ":" + items.actors[j].device.replace(/\//, ":");  // '...:device:N'
          groupID = apprentices.d.groups[groupUUID].id;    // 'group/N'
          groupMembers[groupID].members.push(apprentices.d.tasks[taskUUID].id);  // 'task/N'
        }
      }
    }
    console.log(groupMembers); 
    updateGroupMembers(groupMembers);
  
  	d3.select('#name_' + actor2ID(displayedDevice))
  		.style('color', newColor);
  	d3.select('#img_' + actor2ID(displayedDevice))
		  .style('background-color', newColor);
	  checkPane(livingPanes()[n]);
	  updatePanesList();
	  checkActivator(n);
  }
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
            , mustHave          : [ 'brightness' ]
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
            , mustHave          : [ 'brightness' ]
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
  var again, d, event, eventIndex, group, hasSubTasks, i, j, k, l, m, n, pane, subEvents, suffixes, task, uuid;
  
  again = false;

  d = organize(activities);
  apprentices.d = d;

  for (i = apprentice.panes.length - 1; i !== -1; i--) {
    pane = apprentice.panes[i];
    hasSubTasks = pane.performances.hasOwnProperty('task');
    if (hasSubTasks) {
      subEvents = pane.observations.event;
      uuid = subEvents[0].uuid.replace(/\:event\:/, ':');
        pane.active = !!d.activities[uuid] && d.activities[uuid].armed;
    } else {
      pane.active = !!d.activities[pane.uuid] && d.activities[pane.uuid].armed;
    }
    
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
      suffixes.push(event.uuid.substr(k + 7));
    }

    if (!!pane.performances.tasks) for (j = pane.performances.tasks.length -1; j !== -1; j--) {
      task = pane.performances.tasks[j];
      task.actors = findActors(actors.result, new RegExp(task.deviceType.split('/').join('\\/')), task.mustHave);
      if (d.groups[task.uuid]) {
        group = d.groups[task.uuid];
        for (k = 0; k < task.actors.length; k++) task.actors[k].selected = group.devices.indexOf(task.actors[k].device) !== -1;
      }
      if (suffixes.length === 0) continue;
    }
    
    if (!!pane.performances.task && pane.performances.task.length === 1) {
      task = pane.performances.task[0];
      task.actors = findActors(actors.result, new RegExp(task.deviceType.split('/').join('\\/')), task.mustHave);
      if (d.groups[task.uuid + suffixes[0]]) {
        group = d.groups[task.uuid + suffixes[0]];
        for (k = 0; k < task.actors.length; k++) task.actors[k].selected = group.devices.indexOf(task.actors[k].device) !== -1;
      }
    }

    checkPane(pane);

    again = setup(pane, d);
  }
  if (again) {
    setTimeout(function() { refreshActors(10) }, 0);
  } else {
    if (!document.getElementById("sub-pane-one")) finishApprentices();
  }
};

var checkPane = function(pane) {
  var event, events, i, j, task, taskArray, tasks;
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
    taskArray = (!!pane.performances.tasks) ? pane.performances.tasks : (!!pane.performances.task) ? pane.performances.task : [ ];
    for (i = 0; i < taskArray.length; i++) {
      task = taskArray[i]; 
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

var setup = function(pane, d) {
  var event, task;

  if (!!d.activities[pane.uuid]) return;

  if (Array.isArray(pane.observations.event)) {
    if (!Array.isArray(pane.performances.task)) return;
  } else if (Array.isArray(pane.performances.task)) return;

  event = setup_observations(pane.observations, d);
  task = setup_performances(pane, pane.observations, pane.performances, d);

  if ((!event) || (!task)) return true;

  wsSend(JSON.stringify({ path      : '/api/v1/activity/create/' + pane.uuid
                        , requestID : ++reqno
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

      wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + event.uuid
                            , requestID : ++reqno
                            , name      : event.title
                            , type      : 'event'
                            , operator  : event.operator
                            , members   : []
                            }));
    }
    if (members.length === observations.events.length) {
      wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + observations.uuid
                            , requestID : ++reqno
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

       wsSend(JSON.stringify({ path      : '/api/v1/event/create/' + event.uuid
                             , requestID : ++reqno
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

  wsSend(JSON.stringify({ path      : '/api/v1/event/create/' + event.uuid
                        , requestID : ++reqno
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

      wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + task.uuid
                            , requestID : ++reqno
                            , name      : task.title
                            , type      : 'task'
                            , operator  : task.operator
                            , members   : []
                            }));
    }
    if (members.length === performances.tasks.length) {
      wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + performances.uuid
                            , requestID : ++reqno
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

        wsSend(JSON.stringify({ path      : '/api/v1/activity/create/' + uuid2
                              , requestID : ++reqno
                              , name      : event.title
                              , event     : d.events[event.uuid].id
                              , task      : d.groups[uuid1].id
                              }));
        continue;
      }

       wsSend(JSON.stringify({ path      : '/api/v1/group/create/' + uuid1
                             , requestID : ++reqno
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

  wsSend(JSON.stringify({ path      : '/api/v1/task/create/' + task.uuid
                        , requestID : ++reqno
                        , name      : task.title
                        , actor     : task.actor
                        , perform   : task.perform
                        , parameter : parameterize(task.parameter)
                        }));
};

var parameterize = function(s) { return ((typeof s !== 'string') ? JSON.stringify(s) : s); };

if (!Array.isArray) Array.isArray = function(a) { return Object.prototype.toString.call(a) === '[object Array]'; };

var sendIt = function(data) {
  console.log("Sending: " + data);
  wsSend(data);
}