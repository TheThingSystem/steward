// Z-wave dimmer switches

var registrar
				, utility = require('./../../core/utility')
				;

try {
	registrar = require('./../devices-gateway/gateway-openzwave-usb');
	if (!registrar.pair)
		throw new Error('openzwave-usb gateway unable to start');
} catch (ex) {
	exports.start = function() {
	};

	return utility.logger('devices').info('failing zwave-multi sensor (continuing)', {diagnostic: ex.message});
}

var util = require('util')
				, devices = require('./../../core/device')
				, steward = require('./../../core/steward')
				, sensor = require('./../device-sensor')
				;


var logger = sensor.logger;


var ZWave_MLSensor = exports.Device = function(deviceID, deviceUID, info) {
	var self = this;

	self.whatami = info.deviceType;
	self.deviceID = deviceID.toString();
	self.deviceUID = deviceUID;
	self.name = info.device.name;
	self.getName();

	// Command Classes 
	//  Multi-Level Sensor: 0x31
	//  Battery: 0x80

	self.status = 'present';

	self.changed();
	self.driver = info.driver;
	self.peripheral = info.peripheral;
	self.info = {
		temperature: (typeof info.peripheral.classes[0x31][1].value === 'undefined') ? 0 : info.peripheral.classes[0x31][1].value,
		light: (typeof info.peripheral.classes[0x31][3].value === 'undefined') ? 0 : info.peripheral.classes[0x31][3].value,
		humidity: (typeof info.peripheral.classes[0x31][5].value === 'undefined') ? 0 : info.peripheral.classes[0x31][5].value,
		battery: (typeof info.peripheral.classes[0x80][0].value === 'undefined') ? 0 : info.peripheral.classes[0x80][0].value
	};

	utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
		if (actor !== ('device/' + self.deviceID))
			return;

		if (request === 'perform')
			return self.perform(self, taskID, perform, parameter);
	});

	self.driver.setValue(self.peripheral.nodeid, 0x31, 101, 5);
	self.driver.setValue(self.peripheral.nodeid, 0x31, 111, 1);
	//self.driver.enablePoll(self.peripheral.nodeid, 0x31);
};
util.inherits(ZWave_MLSensor, sensor.Device);


ZWave_MLSensor.prototype.update = function(self, event, comclass, value) {
	if (event === 'value added')
		event = 'value changed';

	var f = {'value changed':
						function() {

							if (!self.peripheral.classes[comclass])
								self.peripheral.classes[comclass] = {};
							self.peripheral.classes[comclass][value.index] = value;
							if ((comclass !== 0x31))
								return;

							// TBD: could do something more with this
							self.status = 'present';
							switch (comclass) {
								case 0x31:
									switch (value.index) {
										case 1:
											self.info.temperature = value.value;
											break;
										case 3:
											self.info.light = value.value;
											break;
										case 5:
											self.info.measurement = value.value;
											break;
										default:
											logger.warning('device/' + self.deviceID, {event: 'value changed', description: 'Multi-Sensor value not supported of \'' + value.label + '\' (index: ' + value.index + ')'});
											console.log(util.inspect(value));
											return;
									}
									break;
								case 0x80:
									switch (value.index) {
										case 0:
											self.info.battery = value.value;
											break;
										default:
											logger.warning('device/' + self.deviceID, {event: 'value changed', description: 'Battery value not supported of \'' + value.label + '\' (index: ' + value.index + ')'});
											console.log(util.inspect(value));
											return;
									}
									break;
								default:
									logger.warning('device/' + self.deviceID, {event: 'value changed', description: 'Command Class not supported for \'' + comclass + '\' (index: ' + value.index + ')'});
									console.log(util.inspect(value));
									return;
							}
							logger.info('device/' + self.deviceID, {event: 'value changed', command_class: comclass, label: value.label, value: value.value, index: value.index});
							self.info.lastSample = new Date().getTime();
							self.changed();
							sensor.update(self.deviceID, {lastSample: self.info.lastSample
								, temperature: self.info.temperature
								, light: self.info.light
								, humidity: self.info.humidity
								, battery: self.info.battery
							});
						}

		, 'value removed':
						function() {
							try {
								delete(self.peripheral.classes[comclass][value]);
							} catch (ex) {
							}

// TBD: something to do here?
						}
		, 'notification':
						function() {
							logger.warning('device/' + self.deviceID, {event: 'notification', value: value});

// TBD: something to do here?
						}
	};
	if (!!f[event])
		return (f[event])();

	logger.warning('device/' + self.deviceID,
					{event: event, comclass: comclass, value: value, diagnostic: 'unexpected update'});
};


ZWave_MLSensor.prototype.perform = function(self, taskID, perform, parameter) {
	var params, state;

//  TBD: Add perform for configuring device once SetConfigParam available through node-openzwave
};


var validate_perform = function(perform, parameter) {
	var params = {}
	, result = {invalid: [], requires: []}
	;

	return result;
};

exports.start = function() {
	steward.actors.device['sensor'].zwave = steward.actors.device['sensor'].zwave ||
					{$info: {type: '/device/sensor/zwave'}};

	steward.actors.device['sensor'].zwave.multilevel =
					{$info: {type: '/device/sensor/zwave/multilevel'
							, observe: []
							, perform: []
							, properties: {name: true
								, status: ['present', 'absent', 'recent']
								, lastSample: 'timestamp'
								, temperature: 'celsius'
								, humidity: 'percentage'
								, light: 'lux'
								, physical: true
								, battery: 'percentage'
							}
						}
						, $validate: {perform: validate_perform}
					};
	devices.makers['/device/sensor/zwave/multilevel'] = ZWave_MLSensor;
	registrar.pair(0x31, '/device/sensor/zwave/multilevel'); // COMMAND_CLASS_SENSOR_MULTILEVEL
};
