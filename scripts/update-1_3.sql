UPDATE devices SET deviceType='/device/climate/koubachi/soil'
             WHERE deviceType='/device/climate/koubachi/sensor';
UPDATE devices SET deviceType='/device/climate/netatmo/meteo'
             WHERE deviceType='/device/climate/netatmo/sensor';
UPDATE devices SET deviceType='/device/climate/oregon-scientific/meteo'
             WHERE deviceType='/device/climate/oregon-scientific/sensor';
UPDATE devices SET deviceType='/device/climate/owl/meteo'
             WHERE deviceType='/device/climate/owl/sensor';

UPDATE devices SET deviceType='/device/indicator/mqtt/text'
             WHERE deviceType='/device/indicator/text/mqtt';
UPDATE devices SET deviceType='/device/indicator/prowl/text'
             WHERE deviceType='/device/indicator/text/prowl';
UPDATE devices SET deviceType='/device/indicator/xively/sensor'
             WHERE deviceType='/device/indicator/text/xively';

UPDATE devices SET deviceType='/device/indicator/hue/uplight'
             WHERE deviceType='/device/indicator/hue/bloom';
UPDATE devices SET deviceType='/device/lighting/insteon/bulb'
             WHERE deviceType='/device/lighting/insteon/led';
UPDATE devices SET deviceType='/device/lighting/robosmart/bulb'
             WHERE deviceType='/device/lighting/robosmart/led';
UPDATE devices SET deviceType='/device/lighting/tabu/bulb'
             WHERE deviceType='/device/lighting/tabu/lumen';
UPDATE devices SET deviceType='/device/lighting/tcpi/bulb'
             WHERE deviceType='/device/lighting/tcpi/led';

UPDATE devices SET deviceType='/device/presence/ble/fob'
             WHERE deviceType='/device/presence/fob/ble';
UPDATE devices SET deviceType='/device/presence/hone/fob'
             WHERE deviceType='/device/presence/fob/hone';
UPDATE devices SET deviceType='/device/presence/inrange/fob'
             WHERE deviceType='/device/presence/fob/inrange';
UPDATE devices SET deviceType='/device/presence/mqtt/mobile'
             WHERE deviceType='/device/presence/mobile/mqtt';
UPDATE devices SET deviceType='/device/presence/mqttitude/mobile'
             WHERE deviceType='/device/presence/mobile/mqttitude';
UPDATE devices SET deviceType='/device/presence/reelyactive/fob'
             WHERE deviceType='/device/presence/reelyactive/tag';

UPDATE devices SET deviceType='/device/wearable/ble/watch'
             WHERE deviceType='/device/wearable/watch/ble';
UPDATE devices SET deviceType='/device/wearable/cookoo/watch'
             WHERE deviceType='/device/wearable/watch/cookoo';
UPDATE devices SET deviceType='/device/wearable/metawatch/watch'
             WHERE deviceType='/device/wearable/watch/metawatch';
