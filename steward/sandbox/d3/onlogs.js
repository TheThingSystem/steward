var signals = { steward    : []
              , lighting   : []
              , sensor     : []
              , plug       : []
              , presence   : []
              , herald     : []
              , gateway    : []
              , devices    : []
              , manage     : []
              , server     : []
              , discovery  : []
              };

var onlogs = function(update) {
  var category, data, datum, filler, i, j, meta, parts, prev, rows;

  update = update || {};

  for (category in update) {
    if (!update.hasOwnProperty(category)) continue;

    data = signals[category] || [];

    for (i = 0; i < update[category].length; i++) {
      datum = update[category][i];

      prev = datum.meta || {};
      meta = {};
      for (j in prev) if ((prev.hasOwnProperty(j)) && (prev[j])) meta[j] = prev[j];

      if (category === 'server') {
        parts = datum.message.split(' ');
        if ((parts.length >= 4)
              && ((parts[0] === 'http') || (parts[0] === 'https') || (parts[0] === 'ws') || (parts[0] === 'wss'))) {
          if ((!meta.path) && ((!meta.error) || (!meta.error.path))) {
            meta.path = parts[3];
          }
        }
      }

      datum.meta = meta;

      for (j = 0; j < data.length; j++) {
        prev = data[j];
        if ((prev.level === datum.level) && (prev.message === datum.message)) {
          data.splice(j, 1);
          break;
        }
      }
      data.push(datum);
      if (data.length > 5) data.splice(0, 1);
    }

    signals[category] = data;
  }

  rows = [];
  for (category in signals) {
    if (!signals.hasOwnProperty(category)) continue;

    for (i = 0; i < signals[category].length; i++) {
      datum = signals[category][i];
      rows.push([ { level: datum.level, datum: 'category',  text: (i === 0) ? category : ''               }
                , { level: datum.level, datum: 'timestamp', text: d3.timestamp.ago(datum.date)            }
                , { level: datum.level, datum: 'message',   text: pretty_msg(category, datum.message)     }
                , { level: datum.level, datum: 'metadata',  text: datum.meta ? serialize(datum.meta) : '' }
                ]);
    }
    for (; i < 5; i++) rows.push(['', '', '', '', '']);
  }

  return rows;
};


// from winston's common.js
var serialize = function (obj, key) {
  if (obj === null) {
    obj = 'null';
  }
  else if (obj === undefined) {
    obj = 'undefined';
  }
  else if (obj === false) {
    obj = 'false';
  } else if (obj === true) obj = 'true';

  if (typeof obj !== 'object') {
    return key ? key + '=' + obj : obj;
  }

  var msg = '',
      keys = Object.keys(obj),
      length = keys.length;

  for (var i = 0; i < length; i++) {
    if (Array.isArray(obj[keys[i]])) {
      msg += keys[i] + '=[';

      for (var j = 0, l = obj[keys[i]].length; j < l; j++) {
        msg += serialize(obj[keys[i]][j]);
        if (j < l - 1) {
          msg += ', ';
        }
      }

      msg += ']';
    }
    else if (obj[keys[i]] instanceof Date) {
      msg += keys[i] + '=' + obj[keys[i]];
    }
    else {
      msg += serialize(obj[keys[i]], keys[i]);
    }

    if (i < length - 1) {
      msg += ', ';
    }
  }

  return msg;
};

var pretty_msg = function(category, message) {
  var parts;

  if ((category !== 'server') && (category !== 'manage')) return message;

  parts = message.split(' ');
  if ((parts.length >= 4)
        && ((parts[0] === 'http') || (parts[0] === 'https') || (parts[0] === 'ws') || (parts[0] === 'wss'))) {
    var scheme = '      ' + parts[0]
      , host   = parts[1] + '    '
      , port   = '      ' + parts[2]
      , line   = scheme.slice(-5) + ' ' + host.slice(0,15) + ' ' + port.slice(-5);

    return line;
  }

  return message;
};
