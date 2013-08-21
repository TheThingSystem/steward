#include <Wire.h>

#include <Dhcp.h>
#include <Dns.h>
#include <Ethernet.h>
#include <EthernetClient.h>
#include <EthernetServer.h>
#include <EthernetUdp.h>
#include <util.h>

#include <SPI.h>

#include <DHT.h>
#include <EggBus.h>

#define DHTPIN A3 //analog pin 3
#define DHTTYPE DHT22  
DHT dht(DHTPIN, DHTTYPE);
EggBus eggBus;

int requestID = 1;

byte mac[] = { 0x90, 0xA2, 0xDA, 0x00, 0x17, 0x2D };  // Arduino Ethernet Shield

char packetBuffer[768];

PROGMEM prog_char *loopPacket1 = "{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"";
PROGMEM prog_char *loopPacket2 = "\",\"things\":{\"/device/climate/arduino/sensor\":{\"prototype\":{\"device\":{\"name\":\"Arduino with EggShield\",\"maker\":\"Arduino\"},\"name\":true,\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"no2\":\"ppm\",\"co\":\"ppm\",\"temperature\":\"celsius\",\"humidity\":\"percentage\"}},\"instances\":[{\"name\":\"Air Quality\",\"status\":\"present\",\"unit\":{\"serial\":\"";
PROGMEM prog_char *loopPacket3 = "\",\"udn\":\"195a42b0-ef6b-11e2-99d0-";
PROGMEM prog_char *loopPacket4 = "-egg-shield\"},\"info\":{\"no2\":";
PROGMEM prog_char *loopPacket5 = ",\"co\":";
PROGMEM prog_char *loopPacket6 = ",\"temperature\":";
PROGMEM prog_char *loopPacket7 = ",\"humidity\":";
PROGMEM prog_char *loopPacket8 = "},\"uptime\":";
PROGMEM prog_char *loopPacket9 = "\"}]}}}";

// All TSRP transmissions are via UDP to port 22601 on multicast address '224.192.32.19'.
EthernetUDP udp;
IPAddress ip(224,192,32,19);
unsigned int port = 22601;   

void setup() {
  Serial.begin(9600);
  while(!Serial) { }
  Serial.println("Starting...");
  
  pinMode(DHTPIN, INPUT);
  Serial.println("Initialising the DHT sensor.");
  dht.begin();
   
  Serial.println("Waiting for DHCP address.");
  if (Ethernet.begin(mac) == 0) {
    Serial.println("Error: Failed to configure Ethernet using DHCP");
    while(1) {  }
  } 
  
  Serial.print("MAC address: ");
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
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

}

void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  float no2 = 0.0;
  float co = 0.0;
  
  uint8_t   egg_bus_address;
  float i_scaler = 0.0;
  uint32_t r0 = 0;
  uint32_t measured_value = 0;
  
  eggBus.init();
  
  while((egg_bus_address = eggBus.next())){
    uint8_t numSensors = eggBus.getNumSensors();
    for(uint8_t ii = 0; ii < numSensors; ii++){
 
      i_scaler = eggBus.getIndependentScaler(ii);      
      measured_value = eggBus.getSensorIndependentVariableMeasure(ii);
      r0 = eggBus.getSensorR0(ii);
      
      if (strcmp(eggBus.getSensorType(ii), "NO2")  == 0) {
          no2 = measured_value * i_scaler * r0;
      } else if (strcmp(eggBus.getSensorType(ii), "CO")  == 0) {
          co = measured_value * i_scaler * r0;
      }
    } 
  }
  h = dht.readHumidity();
  t = dht.readTemperature();
  no2 = no2/1000;
  co = co/1000;
  
  Serial.print( "t = " );
  Serial.print( t );
  Serial.print( "C, h = ");
  Serial.print( h );
  Serial.print( "%, no2 = " );  
  Serial.print( no2/1000 );
  Serial.print( "ppm, co = " );  
  Serial.print( co/1000 );
  Serial.println( "ppm" );  
  
  char buffer[24];
  strcpy(packetBuffer,(char*)pgm_read_word(&loopPacket1) );
  strcat(packetBuffer, itoa( requestID, buffer, 10) );
  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket2) );
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
      sprintf(buffer, "%x", mac[thisByte] );
      strcat(packetBuffer, buffer); 
  }   
  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket3) );
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
      sprintf(buffer, "%x", mac[thisByte] );
      strcat(packetBuffer, buffer); 
  }   
  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket4) );
  strcat(packetBuffer, dtostrf(no2,12,4,buffer));
  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
  strcat(packetBuffer, dtostrf(co,12,4,buffer));
  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );
  strcat(packetBuffer, dtostrf(t,4,2,buffer));
  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket7) );
  strcat(packetBuffer, dtostrf(h,4,2,buffer));
  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket8) );
  strcat(packetBuffer, itoa( millis(), buffer, 10) );
  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket9) );

  Serial.println(packetBuffer); 
  udp.beginPacket(udp.remoteIP(), udp.remotePort());
  udp.write(packetBuffer);
  udp.endPacket(); 
  
  requestID = requestID + 1;
  delay(2500);

}
  



