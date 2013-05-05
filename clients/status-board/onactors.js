var onactors = function(message) {
  var actor, ambient, child, color, colour, depth, entity, entry, i, id, j, json, loopP, name, parent, path, result, size, tail;

  result = message.result;
  if (!result) return null;

  for (id in result['/place']) if (result['/place'].hasOwnProperty(id)) break;
  entry = result['/place'][id];
  json = { name     : entry.name
         , children : [ ]
         , info     : { id      : id
                      , updated : (!!entry.updated) ? d3.timestamp.ago(entry.updated, true) : ''
                      }
         };
  ambient = d3.kelvin.solar[entry.info.solar] || 'white';

  depth = 0;
  loopP = true;
  while (loopP) {
    depth++;
    loopP = false;

    for (id in result.actors) {
      if ((!result.actors.hasOwnProperty(id)) || (id === '/clipboard') || (id === '/group') || (id === '/place')) continue;
      path = id.substr(1).split('/');
      if (path.length !== depth) continue;
      loopP = true;

      parent = json;
      for (i = 0; i < (path.length - 1); i++) {
        parent = parent.children;
        child = null;
        for (j = 0; j < parent.length; j++) {
          tail = parent[j].name.split('/');
          if (tail[tail.length - 1] === path[i]) { child = parent[j]; break; }
        }
        if (!child) {
        }
        parent = child;
      }

      child = { name: id.split('/').pop() };
      for (actor in result[id]) {
        if (!result[id].hasOwnProperty(actor)) continue;

        entry = result[id][actor];
        entry.status = entry.status || entry.info.value || 'on';
        colour = d3.rgb.status[entry.status] || '#d3d3d3';
        size = 3;
        if (!!entry.info.color) {
          color = entry.info.color;
          size = 1;
          switch (color.model) {
            case 'temperature':
              colour = d3.mired.rgb(color.temperature);
              break;

            case 'cie1931':
              colour = d3.cie1931.rgb(color.cie1931.x ,color.cie1931.y);
              break;

            case 'hue':
              colour = d3.hsl(color.hue, color.saturation / 100, entry.info.brightness / 100).rgb();
              break;

            case 'rgb':
              colour = d3.rgb(color.rgb.r, color.rgb.g, color.rgb.b);
              break;

            default:
              break;
          }
          if (entry.status === 'off') colour = ambient;
        }
        name = entry.name;
        if (!({ connected  : true
              , on         : true
              , off        : true
              , ready      : true
              , paired     : true
              , present    : true
              , quiet      : true
              , refreshing : true
              }[entry.status])) name += ' [' + entry.status + ']';
        entity = { name   : name
                 , colour : colour
                 , size   : size
                 , info   : { id      : actor
                            , status  : entry.status
                            , updated : (!!entry.updated) ? d3.timestamp.ago(entry.updated, true) : ''
                            }
                 };

        if (!child.children) child.children = [];
        child.children.push(entity);
      }

      if (!parent.children) parent.children = [];
      parent.children.push(child);
    }
  }

  return json;
};
