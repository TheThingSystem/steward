#include <Dhcp.h>
#include <Dns.h>
#include <Ethernet.h>
#include <EthernetClient.h>
#include <EthernetServer.h>
#include <EthernetUdp.h>
#include <util.h>

#include <SPI.h>

int requestID = 1;
unsigned long lastCallbackTime = 0;// the last time the data was written

// The MAC address of your Ethernet board (or Ethernet Shield) is located on the back of the curcuit board.
byte mac[] = { 0x90, 0xA2, 0xDA, 0x0D, 0xBA, 0x09 };  // Arduino Ethernet

#define WATER_SENSOR 7

char packetBuffer[512];

PROGMEM prog_char *loopPacket1 = "{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"";
PROGMEM prog_char *loopPacket2 = "\",\"things\":{\"/device/sensor/arduino/water\":{\"prototype\":{\"device\":{\"name\":\"Grove Water Sensor\",\"maker\":\"Seeed Studio\"},\"name\":\"true\",\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"water\":[\"present\",\"absent\"]}},\"instances\":[{\"name\":\"Water Sensor\",\"status\":\"present\",\"unit\":{\"serial\":\"";
PROGMEM prog_char *loopPacket3 = "\",\"udn\":\"195a42b0-ef6b-11e2-99d0-";
PROGMEM prog_char *loopPacket4 = "-water\"},\"info\":{\"water\":\"";
PROGMEM prog_char *loopPacket5 = "\"},\"uptime\":";
PROGMEM prog_char *loopPacket6 = "}]}}}";

// All TSRP transmissions are via UDP to port 22601 on multicast address '224.192.32.19'.
EthernetUDP udp;
IPAddress ip(224,192,32,19);
unsigned int port = 22601;   

void setup() {
  pinMode(WATER_SENSOR, INPUT);
  
  Serial.begin(9600);
  Serial.println("Starting...");
  while(!Serial) { }
  
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
  int reading = digitalRead(WATER_SENSOR);

  if( isExposedToWater() ) {
     char buffer[12];
     strcpy(packetBuffer,(char*)pgm_read_word(&loopPacket1) );
     strcat(packetBuffer, ultoa( requestID, buffer, 10) );
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
     strcat(packetBuffer, "detected");
     strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
     strcat(packetBuffer, ultoa( millis(), buffer, 10) );
     strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );

     Serial.println(packetBuffer); 
     udp.beginPacket(udp.remoteIP(), udp.remotePort());
     udp.write(packetBuffer);
     udp.endPacket();      
     requestID = requestID + 1;   
    
    
  } else {
    if ((millis() - lastCallbackTime) > 60000) {
      callback();
      lastCallbackTime = millis();
    }
  }
  
  delay(1000);

}

void callback() {
     char buffer[12];
     strcpy(packetBuffer,(char*)pgm_read_word(&loopPacket1) );
     strcat(packetBuffer, ultoa( requestID, buffer, 10) );
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
     strcat(packetBuffer, "absent");
     strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
     strcat(packetBuffer, ultoa( millis(), buffer, 10) );
     strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );

     Serial.println(packetBuffer); 
     udp.beginPacket(udp.remoteIP(), udp.remotePort());
     udp.write(packetBuffer);
     udp.endPacket();      
     requestID = requestID + 1;
}

boolean isExposedToWater() {
	if(digitalRead(WATER_SENSOR) == LOW)
		return true;
	else return false;
}
