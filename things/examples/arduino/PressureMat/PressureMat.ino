#include <Dhcp.h>
#include <Dns.h>
#include <Ethernet.h>
#include <EthernetClient.h>
#include <EthernetServer.h>
#include <EthernetUdp.h>
#include <util.h>

#include <SPI.h>

void send_packet( char * state );

unsigned long requestID = 1;
unsigned long lastCallbackTime = 0;// the last time the data was written

// The MAC address of your Ethernet board (or Ethernet Shield) is located on the back of the circuit board.
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFF, 0x03 };  // Arduino Ethernet

char packetBuffer[512];

PROGMEM prog_char *loopPacket1 = "{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"";
PROGMEM prog_char *loopPacket2 = "\",\"things\":{\"/device/sensor/arduino/seated-mat\":{\"prototype\":{\"device\":{\"name\":\"7-10# Chair Occupancy Sensor Mat\",\"maker\":\"RECORA\"},\"name\":\"true\",\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"contact\":[\"detected\",\"absent\"]}},\"instances\":[{\"name\":\"Pressure Mat\",\"status\":\"present\",\"unit\":{\"serial\":\"";
PROGMEM prog_char *loopPacket3 = "\",\"udn\":\"195a42b0-ef6b-11e2-99d0-";
PROGMEM prog_char *loopPacket4 = "-mat\"},\"info\":{\"contact\":\"";
PROGMEM prog_char *loopPacket5 = "\"},\"uptime\":";
PROGMEM prog_char *loopPacket6 = "}]}}}";

// All TSRP transmissions are via UDP to port 22601 on multicast address '224.192.32.19'.
EthernetUDP udp;
IPAddress ip(224,192,32,19);
unsigned int port = 22601;   

const int buttonPin = 7;
int buttonState;             
int lastButtonState = LOW;
int sentPacket = 0;

long lastDebounceTime = 0;  
long debounceDelay = 50; 

void setup() {
  pinMode(buttonPin, INPUT);
  
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
  int reading = digitalRead(buttonPin);
  
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  } 
  if ((millis() - lastDebounceTime) > debounceDelay) {
    buttonState = reading;
    //Serial.print( "Button state = " );
    //Serial.println( buttonState );
    if ( buttonState && !sentPacket ) {
       Serial.println("Sending contact = detected");  
       send_packet( "detected" );       
       sentPacket = 1;
      
    } else if ( !buttonState && !sentPacket ) {
       Serial.println("Sending contact = absent"); 
       send_packet( "absent" );       
       sentPacket = 1;    
    }
  }
  
  if ( lastButtonState != reading ) {
     sentPacket = 0; 
  }  
  lastButtonState = reading;
  
  if ((millis() - lastCallbackTime) > 45000) {
      if ( buttonState ) {
         Serial.println("Sending heartbeat (detected)");    
         send_packet( "detected" );       
         sentPacket = 1;
      } else {
         Serial.println("Sending heartbeat (absent)");               
         send_packet( "absent" );       
         sentPacket = 1;     
     }
     lastCallbackTime = millis();
  }
  
}
  
void send_packet( char * state ) {
  
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
   strcat(packetBuffer, state);
   strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
   strcat(packetBuffer, ultoa( millis(), buffer, 10) );
   strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );

   Serial.println(packetBuffer); 
   udp.beginPacket(udp.remoteIP(), udp.remotePort());
   udp.write(packetBuffer);
   udp.endPacket();       
   requestID = requestID + 1;
       
}

  

