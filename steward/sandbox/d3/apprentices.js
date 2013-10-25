var goApprentices = function() {
  var backdrop, div, div2, i, panesList;
  
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
  }
  
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

  // TO-DO: Reduce following to d3 data loop(s) 
  panesList = div.append('div')
    .attr('class', 'panes');
  div = panesList.append('div')
    .attr('class', 'panes-left');
  div2 = div.append('div')
    .attr('class', 'display-pane')
    .on('click', function() { goPaneDetail(0); });
  div2.append('span')
    .attr('class', 'label-disabled')
    .attr('id', 'pane0');
  div2.append('span')
    .attr('class', 'state-disabled')
    .attr('id', 'state0');
  div2 = div.append('div')
    .attr('class', 'display-pane')
    .on('click', function() { goPaneDetail(2); });
  div2.append('span')
    .attr('class', 'label-disabled')
    .attr('id', 'pane2');
  div2.append('span')
    .attr('class', 'state-disabled')
    .attr('id', 'state2');
  div2 = div.append('div')
    .attr('class', 'display-pane')
    .on('click', function() { goPaneDetail(4); });
  div2.append('span')
    .attr('class', 'label-disabled')
    .attr('id', 'pane4');
  div2.append('span')
    .attr('class', 'state-disabled')
    .attr('id', 'state4');
  div = panesList.append('div')
    .attr('class', 'panes-right');
  div2 = div.append('div')
    .attr('class', 'display-pane')
    .on('click', function() { goPaneDetail(1); });
  div2.append('span')
    .attr('class', 'label-disabled')
    .attr('id', 'pane1');
  div2.append('span')
    .attr('class', 'state-disabled')
    .attr('id', 'state1');
  div2 = div.append('div')
    .attr('class', 'display-pane')
    .on('click', function() { goPaneDetail(3); });
  div2.append('span')
    .attr('class', 'label-disabled')
    .attr('id', 'pane3');
  div2.append('span')
    .attr('class', 'state-disabled')
    .attr('id', 'state3');
  div2 = div.append('div')
    .attr('class', 'display-pane')
    .on('click', function() { goPaneDetail(5); });
  div2.append('span')
    .attr('class', 'label-disabled')
    .attr('id', 'pane5');
  div2.append('span')
    .attr('class', 'state-disabled')
    .attr('id', 'state5');
    
  updatePanesList();
  
  function exitApprentices() {
    d3.select('#apprentice-backdrop').remove();
  }
};

var updatePanesList = function() {
  var i, panes;
  panes = apprentices.home.panes;
  for (i = 0; i < panes.length; i++) {
    if (panes[i].status !== "ignore") {
      d3.select('#pane' + i)
        .attr('class', 'label')
        .html(panes[i].title);
      d3.select('#state' + i)
        .attr('class', 'state')
        .html(panes[i].status);
    } else {
      d3.select('#label' + i)
        .attr('class', 'label-disabled')
        .html('');
      d3.select('#state' + i)
        .attr('class', 'state-disabled')
        .html('');    
    }
  }
}

var goPaneDetail = function(i) {
  var div, div2, div3;
  if (document.getElementById("settings")) d3.select('#settings').remove();
  
  div = d3.select('#apprentice-backdrop')
    .append('div')
    .attr('id', 'sub-pane-one');
  
  if (apprentices.home.panes[i].observations.hasOwnProperty('events')) {
    div.append('div')
      .attr('class', 'form-heading')
      .style('margin-top', '0px')
      .style('top', '-100px')
      .style('text-transform', 'capitalize')
      .html(apprentices.home.panes[i].title);
    div.append('div')
      .attr('class', 'form-heading')
      .style('margin-top', '0px')
      .style('text-transform', 'capitalize')
      .html(apprentices.home.panes[i].observations.events[0].title);
    div.append('div')
      .attr('class', 'apprentice-instructions')
      .html(apprentices.home.panes[i].observations.events[0].text);

    div.append('div')
      .attr('class', 'apprentice-actors');
  }
  
  div2 = div.append('div')
    .attr('id', 'sub-pane-two');
  div2.append('div')
    .attr('class', 'form-heading')
    .style('margin-top', '0px')
    .style('text-transform', 'capitalize')
    .html(apprentices.home.panes[i].performances.tasks[0].title);
  div2.append('div')
    .attr('class', 'apprentice-instructions')
    .html(apprentices.home.panes[i].performances.tasks[0].text);
  
  div2.append('div')
    .attr('class', 'apprentice-actors');
  
  div3 = div2.append('div')
    .attr('class', 'action-button-group');
  div3.append('img')
    .attr('class', 'action-button')
    .attr('src', 'popovers/assets/activate.svg')
    .on('click', goApprentices);
  div3.append('img')
    .attr('class', 'action-button')
    .attr('src', 'popovers/assets/done.svg')
    .on('click', goApprentices);
}


var apprentices =
{ home                          :
  { title                       : 'home autonomy'
  , text                        : 'Please tell the steward your preferences for making your home autonomous.'
  , panes                       :
    [ { title                   : 'Manage Air Quality'
      , text                    : 'When CO<sub>2</sub> reaches 1000ppm, circulate the air for 15min.'
                                   // or 'configured' or 'ignore' or 'incomplete'
      , status                  : 'active'
      , observations            :
        { title                 : 'Monitor Air Quality'
        , text                  : ''
        , events                :
          [ { title             : 'Air Sensors'
            , text              : 'Please chooose one or more things to monitor for CO<sub>2</sub>.'
            , deviceType        : '^/device/climate/[^/]+/sensor$'
            , mustHave          : [ 'co2' ]
            , operand           : 'or'
            , '.condition'      : { operator: 'greater-than', operand1: '.[.co2].', operand2: 999 }
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      , performances            :
        { title                 : 'Circulate the Air'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Fans'
            , text              : 'Please choose one or more things to circulate the air.'
            , deviceType        : '^/device/climate/[^/]+/control$'
            , mustHave          : [ 'hvac' ]
            , operand           : 'and'
            , '.set'            : { fan: 900000 }
            , guard             : { '.condition' : { operator: 'equals', operand1: '.[.hvac].', operand2: 'off' } }
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    , { title                   : 'Here Comes the Sun'
      , text                    : 'At dawn, tasks to perform.'
      , status                  : 'active'
      , observations            :
        { title                 : ''
        , text                  : ''
// no events, so display only tasks...
        , event                 : { actor: 'place/1', observe: 'solar', parameter: 'dawn' }
        }
      , performances            :
        { title                 : 'Dawn tasks'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Lights'
            , text              : 'Please choose one or more lights to go on at dawn.'
            , deviceType        : '^/device/lighting/[^/]+/[^/]+$'
            , mustHave          : [ ]
            , operand           : 'and'
            , '.on'             : { brightness: 70 }
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    , { title                   : 'There Goes the Sun'
      , text                    : 'At dusk, tasks to perform.'
      , status                  : 'active'
      , observations            :
        { title                 : ''
        , text                  : ''
        , event                 : { actor: 'place/1', observe: 'solar', parameter: 'dusk' }
        }
      , performances            :
        { title                 : 'Dawn tasks'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Lights'
            , text              : 'Please choose one or more lights to go on at dusk.'
            , deviceType        : '^/device/lighting/[^/]+/[^/]+$'
            , mustHave          : [ ]
            , operand           : 'and'
            , '.on'             : { brightness: 70 }
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    , { title                   : 'Late at night'
      , text                    : 'At late night, tasks to perform.'
      , status                  : 'active'
      , observations            :
        { title                 : ''
        , text                  : ''
        , event                 : { actor: 'place/1', observe: 'solar', parameter: 'nadir' }
        }
      , performances            :
        { title                 : 'Dawn tasks'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Lights'
            , text              : 'Please choose one or more lights to turnoff off late at night.'
            , deviceType        : '^/device/lighting/[^/]+/[^/]+$'
            , mustHave          : [ ]
            , operand           : 'and'
            , '.off'            : ''
            , actors            : {}
            , howMany           : '1+'
            }
          ]
        }
      }

    , { title                   : 'Status lights'
      , text                    : 'Select lights to report change of conditions.'
      , status                  : 'active'
      , observations            :
        { title                 : ''
        , text                  : ''
        , event                 : [ { actor     : 'place/1'
                                    , observe   : '.condition'
                                    , parameter : { operator: 'equals', operand1: '.[.status].', operand2: 'red' }
                                    }
                                  , { actor     : 'place/1'
                                    , observe   : '.condition'
                                    , parameter : { operator: 'equals', operand1: '.[.status].', operand2: 'orange' }
                                    }
                                  , { actor     : 'place/1'
                                    , observe   : '.condition'
                                    , parameter : { operator: 'equals', operand1: '.[.status].', operand2: 'blue' }
                                    }
                                  , { actor     : 'place/1'
                                    , observe   : '.condition'
                                    , parameter : { operator: 'equals', operand1: '.[.status].', operand2: 'green' }
                                    }
                                  ]
        }
      , performances            :
        { title                 : 'Status lights'
        , text                  : ''
        , tasks                 :
          [ { title             : 'Lights'
            , text              : ''
            , deviceType        : '^/device/lighting/[^/]+/[^/]+$'
            , mustHave          : [ ]
            , operand           : 'and'
            , '.on'             : [ { color: { model: 'rgb', rgb: { r: 255, g:   0, b:   0 }}, brightness: 50 }
                                  , { color: { model: 'rgb', rgb: { r: 255, g: 131, b:   0 }}, brightness: 25 }
                                  , { color: { model: 'rgb', rgb: { r:   0, g:   0, b: 255 }}, brightness:  5 }
                                  , { color: { model: 'rgb', rgb: { r:   0, g: 255, b:   0 }}, brightness:  5 }
                                  ]
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
  var event, i, j, pane, status, task;

  for (i = apprentice.panes.length - 1; i !== -1; i--) {
    pane = apprentice.panes[i];

    status = 'incomplete';

    if (!!pane.observations.events) for (j = pane.observations.events.length -1; j !== -1; j--) {
      event = pane.observations.events[j];
      event.actors = findActors(actors.result, new RegExp(event.deviceType.split('/').join('\\/')), event.mustHave);
    }

    for (j = pane.performances.tasks.length -1; j !== -1; j--) {
      task = pane.performances.tasks[j];
      task.actors = findActors(actors.result, new RegExp(task.deviceType.split('/').join('\\/')), task.mustHave);
    }

    pane.status = status;
  }
};

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
      result.push({ device: device, selected: true });
    }
  }
console.log(result);
  return result;
};
