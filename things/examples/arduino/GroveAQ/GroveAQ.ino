#include <Dhcp.h>
#include <Dns.h>
#include <Ethernet.h>
#include <EthernetClient.h>
#include <EthernetServer.h>
#include <EthernetUdp.h>
#include <util.h>

#include <SPI.h>

#include "AirQuality.h"


unsigned long requestID = 1;
unsigned long next_heartbeat = 0;


// The MAC address of your Ethernet board (or Ethernet Shield) is located on the back of the circuit board.
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFF, 0x01 };  // Arduino Ethernet


// logic taken from http://www.seeedstudio.com/wiki/Grove_-_Flame_Sensor
#define FLAME_SENSOR  6
int previous_flame = -1;
unsigned long debounce_flame = 0;

#define Vref         4.95

// logic taken from http://www.seeedstudio.com/wiki/Grove_-_HCHO_Sensor
#define HCHO_SENSOR  A4
float previous_hcho  = -1;

#define NO2_SENSOR   A3
float previous_no2 = -1;

// logic taken from http://www.seeedstudio.com/wiki/Grove_-_Air_Quality_Sensor
#define AQ_SENSOR    A2
int previous_aq    = -1;
AirQuality AQsensor;

// logic taken from http://www.seeedstudio.com/wiki/Grove_-_Gas_Sensor
#define MQ2_SENSOR   A1
float previous_mq2 = -1;

// logic taken from http://www.seeedstudio.com/wiki/Grove_-_Gas_Sensor
#define MQ9_SENSOR   A0
float previous_mq9 = -1;


char packetBuffer[768];

PROGMEM prog_char *loopPacket1 = "{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"";
PROGMEM prog_char *loopPacket2 = "\",\"things\":{\"/device/climate/grove/air-quality\":{\"prototype\":{\"device\":{\"name\":\"Grove Air Quality Sensor Array\",\"maker\":\"sensors from Seeed Studio\"},\"name\":\"true\",\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"airQuality\":\"sigmas\",\"flame\":[\"detected\",\"absent\"],\"smoke\":\"sigmas\",\"co\":\"sigmas\",\"no2\":\"sigmas\",\"hcho\":\"sigmas\"}},\"instances\":[{\"name\":\"Air Quality Sensor\",\"status\":\"present\",\"unit\":{\"serial\":\"";
PROGMEM prog_char *loopPacket3 = "\",\"udn\":\"195a42b0-ef6b-11e2-99d0-";
PROGMEM prog_char *loopPacket4 = "-air-quality\"},\"info\":{\"airQuality\":";
PROGMEM prog_char *loopPacket5 = ",\"flame\":\"";
PROGMEM prog_char *loopPacket6 = "\",\"smoke\":";
PROGMEM prog_char *loopPacket7 = ",\"co\":";
PROGMEM prog_char *loopPacket8 = ",\"no2\":";
PROGMEM prog_char *loopPacket9 = ",\"hcho\":";
PROGMEM prog_char *loopPacket10= "},\"uptime\":";
PROGMEM prog_char *loopPacket11= "}]}}}";

// All TSRP transmissions are via UDP to port 22601 on multicast address '224.0.9.1'.
EthernetUDP udp;
IPAddress ip(224,0,9,1);
unsigned int port = 22601;

void setup() {
  pinMode(FLAME_SENSOR, INPUT);

  Serial.begin(9600);
  Serial.println("\nStarting...");
  while(!Serial) { }

  Serial.println("Initializing AQ sensor.");
  AQsensor.init(14);

  Serial.println("Waiting for DHCP address.");
  if (Ethernet.begin(mac) == 0) {
    Serial.println("Error: Failed to configure Ethernet using DHCP");
    while(1) {  }
  }

  Serial.print("MAC address: ");
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
    if (thisByte != 0) Serial.print(":");
    if (mac[thisByte] < 0x0a) Serial.print("0");
    Serial.print(mac[thisByte], HEX);
  }
  Serial.println();

  Serial.print("IP address: ");
  for (byte thisByte = 0; thisByte < 4; thisByte++) {
    Serial.print(Ethernet.localIP()[thisByte], DEC);
    Serial.print(".");
  }
  Serial.println();

  udp.beginMulti(ip,port);
}


void loop() {
  int   aq, flame;
  float hcho, mq2, mq9, no2;
  char  buffer[24];
  unsigned long now;

  now = millis();

  flame = digitalRead(FLAME_SENSOR) == LOW;

// keep reporting leak for 30 seconds after condition clears, during that time, report once every 5 seconds
  if (flame) debounce_flame = now + 30000; else if (now <= debounce_flame) flame = 1;

  aq = AQsensor.slope();
  if (aq > 0) aq = AQsensor.first_vol;

  hcho = (((float) analogRead(HCHO_SENSOR)) * Vref) / 1023;

  mq2 = (((float) analogRead(MQ2_SENSOR)) * Vref) / 1023;

  mq9 = (((float) analogRead(MQ9_SENSOR)) * Vref) / 1023;

  no2 = (((float) analogRead(NO2_SENSOR)) * Vref) / 1023;

  if ((flame == previous_flame)
        && (!flame)
        && ((aq < 0) || (aq == previous_aq))
        && (hcho == previous_hcho)
        && (mq2 == previous_mq2)
        && (mq9 == previous_mq9)
        && (no2 == previous_no2)
        && (now <  next_heartbeat)) {
    delay (100);
    return;
  }

  if (aq > 0) previous_aq = aq; else aq = previous_aq;
  previous_hcho = hcho;
  previous_mq2 = mq2;
  previous_mq9 = mq9;
  previous_no2 = no2;
  next_heartbeat = now + 45000;

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
  if (aq > 0) strcat(packetBuffer, itoa( aq, buffer, 10) ); else strcat(packetBuffer, "\"\"");

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
  strcat(packetBuffer,flame ? "detected" : "absent");

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );
  strcat(packetBuffer, dtostrf((double) mq2, 12, 4, buffer));

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket7) );
  strcat(packetBuffer, dtostrf((double) mq9, 12, 4, buffer));

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket8) );
  strcat(packetBuffer, dtostrf((double) no2, 12, 4, buffer));

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket9) );
  strcat(packetBuffer, dtostrf((double) hcho, 12, 4, buffer));

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket10) );
  strcat(packetBuffer, ultoa( now, buffer, 10) );

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket11) );

  sendit();

  delay(previous_flame ? 5000 : 100);
  previous_flame = flame;
}

void sendit() {
  Serial.println(packetBuffer);

  udp.beginPacket(udp.remoteIP(), udp.remotePort());
  udp.write(packetBuffer);
  udp.endPacket();
  requestID = requestID + 1;
}


ISR(TIMER2_OVF_vect) {
  //set 2 seconds as a detected duty
  if (AQsensor.counter==122) {
    AQsensor.last_vol    = AQsensor.first_vol;
    AQsensor.first_vol   = analogRead(AQ_SENSOR);
    AQsensor.counter     = 0;
    AQsensor.timer_index = 1;
    PORTB = PORTB ^ 0x20;
  } else {
    AQsensor.counter++;
  }
}
