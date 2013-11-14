var serialport = require('../steward/node_modules/serialport');

serialport.list(function(err, info) {
  var i;

  if (!!err) return console.log('serialport: ' + err.message);

  for (i = 0; i < info.length; i++) {
    console.log('device #' + i);
    console.log(JSON.stringify(info[i]));
  }

  process.exit(0);
});
