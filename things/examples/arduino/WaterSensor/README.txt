README.txt
    
Start with:
    
    Arduino UNO       - http://arduino.cc/en/Main/arduinoBoardUno
    
    Grove Shield      - http://www.seeedstudio.com/wiki/Grove_-_Base_Shield_V1.3
    
    Ether Shield      - http://arduino.cc/en/Main/ArduinoEthernetShield
    
and this sensor:

    D7 - Grove Water Sensor  - http://www.seeedstudio.com/wiki/Grove_-_Water_Sensor

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
          "uptime": -14815
        }
      ]
    }
  }
}

				  #######
