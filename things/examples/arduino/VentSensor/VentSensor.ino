#include <Dhcp.h>
#include <Dns.h>
#include <Ethernet.h>
#include <EthernetClient.h>
#include <EthernetServer.h>
#include <EthernetUdp.h>
#include <util.h>

#include <SPI.h>

#include "DHT.h"


unsigned long requestID = 1;
unsigned long next_heartbeat = 0;


// The MAC address of your Ethernet board (or Ethernet Shield) is located on the back of the circuit board.
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFF, 0x06 };  // Arduino Ethernet


#define Vref    4.95

// logic taken from https://github.com/bilsch/arduino_anemometer/blob/master/wind_sensor/wind_sensor.ino
#define MD550_SENSOR A0
int wind_max = 0;
int wind_min = 1023;
unsigned long calibration_time = 40000;


// logic taken from http://www.seeedstudio.com/wiki/Grove_-_Temperature_and_Humidity_Sensor_Pro
#define DHT_SENSOR   A2
#define DHT_TYPE     DHT22
DHT dht(DHT_SENSOR, DHT_TYPE);

// logic taken from http://www.seeedstudio.com/wiki/Grove_-_Dust_Sensor
#define DUST_SENSOR   8
unsigned long low_pulse_occupancy = 0;
unsigned long sample_time = 30000;


char packetBuffer[768];

PROGMEM prog_char *loopPacket1 = "{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"";
PROGMEM prog_char *loopPacket2 = "\",\"things\":{\"/device/climate/arduino/ventilation\":{\"prototype\":{\"device\":{\"name\":\"Return Ventilation Sensor Array\",\"maker\":\"Modern Device/Seed Studio\"},\"name\":\"true\",\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"flow\":\"sigmas\",\"concentration\":\"pcs/liter\",\"temperature\":\"celcius\",\"humidity\":\"percentage\"}},\"instances\":[{\"name\":\"Return Ventilation Sensor\",\"status\":\"present\",\"unit\":{\"serial\":\"";
PROGMEM prog_char *loopPacket3 = "\",\"udn\":\"195a42b0-ef6b-11e2-99d0-";
PROGMEM prog_char *loopPacket4 = "-ventilation\"},\"info\":{\"flow\":";
PROGMEM prog_char *loopPacket5 = ",\"concentration\":";
PROGMEM prog_char *loopPacket6 = ",\"temperature\":";
PROGMEM prog_char *loopPacket7 = ",\"humidity\":";
PROGMEM prog_char *loopPacket8= "},\"uptime\":";
PROGMEM prog_char *loopPacket9= "}]}}}";

// All TSRP transmissions are via UDP to port 22601 on multicast address '224.192.32.19'.
EthernetUDP udp;
IPAddress ip(224,192,32,19);
unsigned int port = 22601;

void setup() {
  int wind;
  unsigned long ctime;

  Serial.begin(9600);
  Serial.println("Starting...");
  while(!Serial) { }

  Serial.println("Iniitalizing MD550 sensor.");
  pinMode(MD550_SENSOR, INPUT);
  delay(10000);
  ctime = millis() + calibration_time;
  do {
    wind = analogRead(MD550_SENSOR);
    if (wind > wind_max) wind_max = wind;
    if (wind < wind_min) wind_min = wind;    
  } while(millis() < ctime);
  Serial.print("MD550 min: ");Serial.print(wind_min);Serial.print(", max: ");Serial.println(wind_max);

  Serial.println("Initializing DHT sensor.");
  dht.begin();

  pinMode(DUST_SENSOR, INPUT);

  Serial.println("Waiting for DHCP address.");
  if (Ethernet.begin(mac) == 0) {
    Serial.println("Error: Failed to configure Ethernet using DHCP");
    while(1) {  }
  }

  Serial.print("MAC address: ");
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
    if (mac[thisByte] < 0x0a) Serial.print("0");
    Serial.print(mac[thisByte], HEX);
    Serial.print(":");
  }
  Serial.println();

  Serial.print("IP address: ");
  for (byte thisByte = 0; thisByte < 4; thisByte++) {
    Serial.print(Ethernet.localIP()[thisByte], DEC);
    Serial.print(".");
  }
  Serial.println();

  udp.beginMulti(ip,port);

  next_heartbeat = millis() + sample_time;
}

void loop() {
  float humidity, temperature, wind;
  float ratio, concentration;
  char  buffer[24];
  unsigned long now;

  low_pulse_occupancy += pulseIn(DUST_SENSOR, LOW) + sample_time;

  now = millis();
  if (now < next_heartbeat) return;
  next_heartbeat = millis() + sample_time;

  wind = (((float) map(analogRead(MD550_SENSOR), wind_min, wind_max, 0, 255)) * Vref) / 1023;

  humidity = dht.readHumidity();
  temperature = dht.readTemperature();

  ratio = low_pulse_occupancy / (sample_time * 10.0);                       // Integer percentage 0=>100
  concentration = 1.1*pow(ratio, 3) - 3.8*pow(ratio, 2) + 520*ratio + 0.62; // using spec sheet curve
  Serial.print("Dust lpo: ");Serial.print(low_pulse_occupancy);Serial.print(", ratio: ");Serial.println(ratio);
  low_pulse_occupancy = 0;

  strcpy(packetBuffer,(char*)pgm_read_word(&loopPacket1) );
  strcat(packetBuffer, ultoa( requestID, buffer, 10) );

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket2) );
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
      sprintf(buffer, "%02x", mac[thisByte] );
      strcat(packetBuffer, buffer);
  }

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket3) );
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
      sprintf(buffer, "%02x", mac[thisByte] );
      strcat(packetBuffer, buffer);
  }

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket4) );
  strcat(packetBuffer, dtostrf(wind, 12, 4, buffer));

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
  strcat(packetBuffer, dtostrf(concentration, 12, 4, buffer));

  if (!isnan(temperature)) {
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );
    strcat(packetBuffer, dtostrf(temperature, 12, 4, buffer));
  }

  if (!isnan(humidity)) {
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket7) );
    strcat(packetBuffer, dtostrf(humidity, 12, 4, buffer));
  }

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket8) );
  strcat(packetBuffer, ultoa( now, buffer, 10) );

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket9) );

  Serial.println(packetBuffer);

  udp.beginPacket(udp.remoteIP(), udp.remotePort());
  udp.write(packetBuffer);
  udp.endPacket();
  requestID = requestID + 1;
}
