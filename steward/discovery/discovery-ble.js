var noble       = null
  , util        = require('util')
  , devices     = require('./../core/device')
  , utility     = require('./../core/utility')
  ;


var logger = utility.logger('discovery');


var advertisements = { localNames: {}, serviceUUIDs: {} };

exports.register = function(deviceType, localName, serviceUUIDs) {
  var name, uuids;

  name = (!!localName) ? localName : '';
  uuids = util.isArray(serviceUUIDs) ? serviceUUIDs.sort().join(',').toLowerCase() : '';
  if ((name === '') && (uuids === '')) return logger.error('BLE ' + deviceType + ': neither name nor UUIDs specified');

  if (!advertisements.localNames[name]) advertisements.localNames[name] = {};
  advertisements.localNames[name][uuids] = deviceType;

  if (!advertisements.serviceUUIDs[uuids]) advertisements.serviceUUIDs[uuids] = {};
  advertisements.serviceUUIDs[uuids][name] = deviceType;
};


exports.start = function() {
  var blacklist;

  blacklist = { 'bec26202a8d84a9480fc9ac1de37daa6' : 'StickNFind'
              };

  try {
    noble       = require('noble');
  } catch(ex) { logger.warning('BLE support disabled', { diagnostic: ex.message } ); }
  if (!noble) return;

  noble.on('stateChange', function(state) {
    logger.info('BLE stateChange', { state: state });

    if (state === 'poweredOn') noble.startScanning(); else noble.stopScanning();
  });

  noble.on('discover', function(peripheral) {
    var deviceType, i, info, name, uuids;

var stringify = require('json-stringify-safe');
console.log('>>> ' + stringify(peripheral.advertisement));
    uuids = peripheral.advertisement.serviceUuids;
    for (i = 0; i < uuids.length; i++) {
      if (!!blacklist[uuids[i]]) {
        return logger.warning('BLE blacklist', { type         : blacklist[uuids[i]]
                                               , uuid         : peripheral.uuid
                                               , name         : peripheral.advertisement.localName
                                               , serviceUuids : uuids
                                               });
      }
    }

    name = (!!peripheral.advertisement.localName) ? peripheral.advertisement.localName : '';
    uuids = peripheral.advertisement.serviceUuids.sort().join(',').toLowerCase();
    deviceType =   (!!advertisements.localNames[name])    ? advertisements.localNames[name][uuids]
                 : (!!advertisements.serviceUUIDs[uuids]) ? advertisements.serviceUUIDs[uuids]['']
                 : '';

    info = { source: 'ble', peripheral: peripheral };
    info.device = { url          : null
                  , name         : peripheral.advertisement.localName
                  , unit         : { udn: peripheral.uuid }
                  };
    info.url = info.device.url;
    info.deviceType = deviceType || '/device/presence/fob';
    info.id = 'uuid:' + info.device.unit.udn;
    if (devices.devices[info.id]) return;

    logger.info('BLE ' + info.device.name, { uuid: peripheral.uuid });
    devices.discover(info);
  });

  if (noble.state === 'poweredOn') noble.startScanning();
};
