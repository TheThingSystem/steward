// returns an array with the most interesting devices

var ambient = 'white';

var thePlace = function(message) {
  var entry, id, result;

  result = message.result;
  if (!result) return null;

  for (id in result['/place']) if (result['/place'].hasOwnProperty(id)) break;
  entry = result['/place'][id];
  if (!entry) return null;

  ambient = d3.kelvin.solar[entry.info.solar] || 'white';

  return entry;
};

var mostDevices = function(message) {
  var actor, devices, entry, id, now, path, result;

  result = message.result;
  if (!result) return null;

  devices = [];
  for (id in result) {
    if ((!result.hasOwnProperty(id)) || (id === 'actor')) continue;

    path = id.split('/');
    if ((path[1] !== 'device') || (path[2] === 'gateway') || (path[2] === 'indicator')) continue;

    for (actor in result[id]) if (result[id].hasOwnProperty(actor)) {
      entry = result[id][actor];
      entry.actor = actor;
      entry.deviceType = id;
      devices.push(entry);
    }
  }

  now = new Date().getTime();
  devices.sort(function(a, b) {
    var au, bu;

    au = bu = now;
    if (!!a.updated) try { au = new Date(a.updated).getTime(); } catch(ex) {}
    if (!!b.updated) try { bu = new Date(b.updated).getTime(); } catch(ex) {}

    return ((au !== bu) ? (bu - au)
         : (a.name.toLowerCase() !== b.name.toLowerCase()) ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
         : a.actor.localeCompare(b.actor));
  });

  return devices;
};


// returns an object with members named by tag (e.g., "living room'), each member is an array

var allTags = function(message) {
  var actor, device, devices, entry, i, id, path, result, tag, tags;

  result = message.result;
  if (!result) return null;

  id = '/group';
  if (!result[id]) return {};

  devices = {};
  for (id in result) {
    if ((!result.hasOwnProperty(id)) || (id === 'actor')) continue;

    path = id.split('/');
    if (path[1] !== 'device') continue;

    for (actor in result[id]) if (result[id].hasOwnProperty(actor)) {
      entry = result[id][actor];
      entry.actor = actor;
      entry.deviceType = id;
      devices[actor] = entry;
    }
  }

  tags = {};
  for (actor in result[id]) {
    if (!result[id].hasOwnProperty(actor)) continue;
    tag = result[id][actor];

    tags[tag.name] = [];
    for (i = 0; i < tag.members.length; i++) {
      device = devices[tag.members[i]];
      if (!!device) tags[tag.name].push(device);
    }
    if (tags[tag.name].length < 1) delete(tags[tag.name]);
  }

  return sorted(tags);
};


// returns an object with members named by device category (e.g., 'lighting'), each member is an array

var allCategories = function(message) {
  var actor, categories, category, entry, id, path, result;

  result = message.result;
  if (!result) return null;

  categories = {};
  for (id in result) {
    if ((!result.hasOwnProperty(id)) || (id === 'actor')) continue;

    path = id.split('/');
    if (path[1] !== 'device') continue;

    category = path[2];
    if (!categories[category]) categories[category] = [];
    for (actor in result[id]) if (result[id].hasOwnProperty(actor)) {
      entry = result[id][actor];
      entry.actor = actor;
      entry.deviceType = id;
      categories[category].push(entry);
    }
  }

  return sorted(categories);
};

var sorted = function(o) {
  var a, i, prop, result;

  a = [];
  for (prop in o) if (o.hasOwnProperty(prop)) a.push({ key: prop, value: o[prop] });
  a.sort(function(a, b) { return a.key.toLowerCase().localeCompare(b.key.toLowerCase()); });

  result = {};
  for (i = 0; i < a.length; i++) result[a[i].key] = a[i].value;
  return result;
};


// returns the status color associated with a device

var statusColor = function(entry) {
  var color;

  if (!!entry.info.color) {
    if (entry.status === 'off') return ambient;
    if (entry.status === 'on') {
      color = entry.info.color;
      switch (color.model) {
        case 'temperature': return d3.mired.rgb(color.temperature);
        case 'cie1931':     return d3.cie1931.rgb(color.cie1931.x ,color.cie1931.y);
        case 'hue':         return d3.hsl(color.hue, color.saturation / 100, entry.info.brightness / 100).rgb();
        case 'rgb':         return d3.rgb(color.rgb.r, color.rgb.g, color.rgb.b);
        default:            break;
      }
    }
  }

  switch(entry.status) {
    case 'idle':
    case 'on':
    case 'paused':
    case 'playing':
    case 'present':
    case 'quiet':
    case 'ready':
    case 'green':
      return '#00ba00';

    case 'busy':
    case 'motion':
    case 'off':
    case 'recent':
    case 'blue':
      return '#006be6';

    case 'waiting':
    case 'indigo':
      return '#9b00c1';

    case 'absent':
    case 'error':
    case 'reset':
    case 'red':
      return '#ff3000';

    default:
      return 'black';
  }
};


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
        size = 10;
        if (!!entry.info.color) {
          color = entry.info.color;
          size = 10;
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
