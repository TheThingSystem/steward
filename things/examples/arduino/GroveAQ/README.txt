README.txt
    
Note well: this example is NOT a replacement for a certified smoke detector installed by a licensed electrician.
It provides uncalibrated measurements which may be useful for non-essential monitoring, but is entirely inappropriate for 
a stand-alone alarm system.
    
    
Start with:

    Arduino UNO       - http://arduino.cc/en/Main/arduinoBoardUno

    Grove Shield      - http://www.seeedstudio.com/wiki/Grove_-_Base_Shield_V1.3

    Ether Shield      - http://arduino.cc/en/Main/ArduinoEthernetShield

OR

    Arduino Ethernet  - http://arduino.cc/en/Main/ArduinoBoardEthernet

    Stacking headers  - http://www.adafruit.com/products/85

    Grove Shield      - http://www.seeedstudio.com/wiki/Grove_-_Base_Shield_V1.3

AND these sensors:

    A0 - Grove Gas Sensor (MQ9)   - http://www.seeedstudio.com/wiki/Grove_-_Gas_Sensor
    A1 - Grove Gas Sensor (MQ2)   - http://www.seeedstudio.com/wiki/Grove_-_Gas_Sensor
    A2 - Grove Air Quality Sensor - http://www.seeedstudio.com/wiki/Grove_-_Air_Quality_Sensor
    D6 - Grove Flame Sensor       - http://www.seeedstudio.com/wiki/Grove_-_Flame_Sensor

This is probably overkill, and sadly, there isn't an NO2 sensor among
the bunch.

    
Next, import this library into Arduino

    http://www.seeedstudio.com/wiki/File:AirQuality_Sensor.zip

Note that when the AQ sensor starts, it takes 20 seconds before
returning control back to set-up.

    
A report via the STRP looks like the following. Note that the properties
are mostly defined as 'sigmas', which means that the sensors are
reporting uncalibrated data, and the steward will report it the current
value relative to the standard deviation of the data series.

{
  "path": "\/api\/v1\/thing\/reporting",
  "requestID": "1",
  "things": {
    "\/device\/climate\/grove\/air-quality": {
      "prototype": {
        "device": {
          "name": "Grove Air Quality Sensor Array",
          "maker": "Seeed Studio"
        },
        "name": "true",
        "status": [
          "present",
          "absent",
          "recent"
        ],
        "properties": {
          "overall": "sigmas",
          "flame": [
            "off",
            "on"
          ],
          "smoke": "sigmas",
          "co": "sigmas"
        }
      },
      "instances": [
        {
          "name": "Air Quality Sensor",
          "status": "present",
          "unit": {
            "serial": "90a2dadba9",
            "udn": "195a42b0-ef6b-11e2-99d0-90a2dadba9-air-quality"
          },
          "info": {
            "overall": 140,
            "flame": "off",
            "smoke": 0.9629,
            "co": 0
          },
          "uptime": 14815
        }
      ]
    }
  }
}

				  #######
