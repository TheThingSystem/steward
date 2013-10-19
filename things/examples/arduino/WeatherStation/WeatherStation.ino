
#include <Dhcp.h>
#include <Dns.h>
#include <Ethernet.h>
#include <EthernetClient.h>
#include <EthernetServer.h>
#include <EthernetUdp.h>
#include <util.h>

#include <SPI.h>

#include <DHT.h>
#define DHTTYPE DHT22

const int dhtPin = 2;
DHT dht(dhtPin, DHTTYPE);

unsigned long requestID = 1;

// The MAC address of your Ethernet board (or Ethernet Shield) is located on the back of the circuit board.
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFF, 0x05 };  // Arduino Ethernet

char packetBuffer[512];

PROGMEM prog_char *loopPacket1 = "{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"";
PROGMEM prog_char *loopPacket2 = "\",\"things\":{\"/device/climate/arduino/sensor\":{\"prototype\":{\"device\":{\"name\":\"Arduino with DHT-22\",\"maker\":\"Arduino\"},\"name\":true,\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"temperature\":\"celsius\",\"humidity\":\"percentage\"}},\"instances\":[{\"name\":\"Weather Station\",\"status\":\"present\",\"unit\":{\"serial\":\"";
PROGMEM prog_char *loopPacket3 = "\",\"udn\":\"195a42b0-ef6b-11e2-99d0-";
PROGMEM prog_char *loopPacket4 = "-dnt-22\"},\"info\":{\"temperature\":";
PROGMEM prog_char *loopPacket5 = ",\"humidity\":";
PROGMEM prog_char *loopPacket6 = "},\"uptime\":";
PROGMEM prog_char *loopPacket7 = "}]}}}";

// All TSRP transmissions are via UDP to port 22601 on multicast address '224.192.32.20'.
EthernetUDP udp;
IPAddress ip(224,192,32,20);
unsigned int port = 22601;   

void setup() {
  Serial.begin(9600);
  Serial.println("\nStarting...");
  while(!Serial) { }
  
  pinMode(dhtPin, INPUT);
  Serial.println("Initialising the DHT sensor.");
  dht.begin();
  
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
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  if ( isnan(t) || isnan(h) ) {
    Serial.println("Error: Failed to read from DHT.");
  } else {
    requestID = requestID + 1;
    
    Serial.print( "t = " );
    Serial.print( t );
    Serial.print( "C, h = ");
    Serial.print( h );
    Serial.println( "%" );
        
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
    strcat(packetBuffer, dtostrf(t,4,2,buffer));
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
    strcat(packetBuffer, dtostrf(h,4,2,buffer));
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );
    strcat(packetBuffer, ultoa( millis(), buffer, 10) );
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket7) );

    Serial.println(packetBuffer); 
    udp.beginPacket(udp.remoteIP(), udp.remotePort());
    udp.write(packetBuffer);
    udp.endPacket();
    
  }
  
  /*
  
  // Parse and display incoming packets
  
  int packetSize = udp.parsePacket();
  if(packetSize) {
    Serial.print("Received packet of size ");
    Serial.println(packetSize);
    Serial.print("From ");
    IPAddress remote = udp.remoteIP();
    for (int i =0; i < 4; i++) {
      Serial.print(remote[i], DEC);
      if (i < 3) {
        Serial.print(".");
      }
    }
    Serial.print(", port ");
    Serial.println(udp.remotePort());

    // read the packet into packetBufffer
    udp.read(packetBuffer,512);
    Serial.println("Contents:");
    Serial.println(packetBuffer);
  }  
  */
  
  delay(2000);
}

