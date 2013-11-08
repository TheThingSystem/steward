README.txt

Start with:

    Arduino UNO       - http://arduino.cc/en/Main/arduinoBoardUno

    Grove Shield      - http://www.seeedstudio.com/wiki/Grove_-_Base_Shield_V1.3

    Ether Shield      - http://arduino.cc/en/Main/ArduinoEthernetShield

OR

    Arduino Ethernet  - http://arduino.cc/en/Main/ArduinoBoardEthernet

    Stacking headers  - http://www.adafruit.com/products/85

    Grove Shield      - http://www.seeedstudio.com/wiki/Grove_-_Base_Shield_V1.3

AND these sensors:

    A0 - MD550 Wind Sensor   - http://moderndevice.com/product/wind-sensor/
                               GND = Ground, +V = Power, Out = pin A, RV = unused, TMP = unused
    D8 - Grove Dust Sensor   - http://www.seeedstudio.com/wiki/Grove_-_Dust_Sensor
    A2 - Grove DHT Sensor    - http://www.seeedstudio.com/wiki/Grove_-_Temperature_and_Humidity_Sensor_Pro


Next, import this library into Arduino:

    http://www.seeedstudio.com/wiki/images/archive/4/49/20130305092204%21Humidity_Temperature_Sensor.zip

Note that when the MD550 sensor starts, it takes 50 seconds before
returning control back to setup().

    
A report via the STRP looks like the following:

{
  "path": "/api/v1/thing/reporting",
  "requestID": "1",
  "things": {
    "/device/climate/arduino/ventilation": {
      "prototype": {
        "device": {
          "name": "Return Ventilation Sensor Array",
          "maker": "Modern Device/Seed Studio"
        },
        "name": "true",
        "status": [
          "present",
          "absent",
          "recent"
        ],
        "properties": {
          "flow": "sigmas",
          "concentration": "pcs/liter",
          "temperature": "celcius",
          "humidity": "percentage"
        }
      },
      "instances": [
        {
          "name": "Return Ventilation Sensor",
          "status": "present",
          "unit": {
            "serial": "deadbeefff06",
            "udn": "195a42b0-ef6b-11e2-99d0-deadbeefff06-ventilation"
          },
          "info": {
            "flow": 1.0452,
            "concentration": 1346.2656,
            "temperature": 24.5,
            "humidity": 32.1
          },
          "uptime": 82576
        }
      ]
    }
  }
}
    
    				  #######
