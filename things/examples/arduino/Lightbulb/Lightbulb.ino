#include <SD.h>
#include <Dhcp.h>
#include <Dns.h>
#include <Ethernet.h>
#include <EthernetClient.h>
#include <util.h>
#include <SPI.h>
#include <EthernetBonjour.h>
#include <Base64.h>
#include <global.h>
#include <MD5.h>
#include <sha1.h>
#include <WebSocketClient.h>

#define VERSION 0.1

#define SS_PIN 4
#define LED_PIN 8
#define BUFFER_LEN 512

// DECLARE FUNCTIONS
void getIdentity();
void writeIdentity();
const char* ip_to_str( const uint8_t* );
void serviceFound( const char* type, MDNSServiceProtocol proto, const char* name, const byte ipAddr[4], unsigned short port, const char* txtContent );

// ETHERNET
byte mac[] = { 0x90, 0xA2, 0xDA, 0x00, 0x1A, 0x08 };   
EthernetClient client;

// BONJOUR
char serviceName[] = "_wss";
WebSocketClient webSocketClient;
byte * steward;
int stoppedLooking = 0;

// SETTINGS FILE
File Settings;
String thingIdentity;
String authKey;
String totp;

// WEBSOCKET
int requestID = 1;
char packetBuffer[BUFFER_LEN];
String responseData;

// JSON FRAGMENTS
char buffer[12];
char otherBuffer[96];
PROGMEM prog_char *pair_message1 = "{\"path\":\"/api/v1/thing/pair/UUID\",\"requestID\":\"";
PROGMEM prog_char *pair_message2 = "\",\"name\":\"Arduino LED\",\"paringCode\":\"1234\"}";

PROGMEM prog_char *hello_message1 = "{\"path\":\"/api/v1/thing/hello/";
PROGMEM prog_char *hello_message2 = "\",\"requestID\":\"";
PROGMEM prog_char *hello_message3 = "\",\"response\":\"";
PROGMEM prog_char *hello_message4 = "\"}";

// MESSAGE FLAGS
int pairFlag = 0;
int pairResponse = 0;
int helloFlag = 0;
int helloResponse = 0;
int prototypeFlag = 0;
int prototypeResponse = 0;
int registerFlag = 0;
int registerResponse = 0;

unsigned long timeOfLastResponse = 0;
unsigned long epoch = 0;

// SETUP ------------------------------------------------------------------------------------
void setup() {
  
  // LED = HIGH
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
  
  // SERIAL
  Serial.begin(9600);
  while(!Serial) {  }
  Serial.flush();
  Serial.println("Waiting for key press...");
  while(!Serial.available()) { } // Wait for a character
  Serial.flush();
  Serial.print("Arduino LED v");
  Serial.println(VERSION);

  // SD CARD
  Serial.println("Initialising SD card.");
  if (!SD.begin(SS_PIN)) {
    Serial.println("Error: Failed to initialise SD card.");
    while(1) {  }
  }
  
  // DHCP
  Serial.println("Waiting for DHCP address.");
  if (Ethernet.begin(mac) == 0) {
    Serial.println(F("Error: Failed to configure Ethernet using DHCP."));
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

  // PREVIOUSLY PAIRED?
  getIdentity();
  if( thingIdentity.length() > 0 ) {  // if we have more than a null terminator in the string
    pairFlag = 1;
    pairResponse = 1;
    prototypeFlag = 1;
    prototypeResponse = 1;
    Serial.println("Already paired with steward."); 
    Serial.print("Thing ID = ");
    Serial.println( thingIdentity );
    Serial.print("Auth Key = ");
    Serial.println( authKey );
  } else {
    pairFlag = 0;
    pairResponse = 0;
    Serial.println("Not yet paired with steward.");
  }
 
  // BONJOUR
  EthernetBonjour.begin("arduino");
  EthernetBonjour.setServiceFoundCallback(serviceFound);
  if (!EthernetBonjour.isDiscoveringService()) {
    byte ipAddr[4];

    Serial.println(F("Discovering services of type '_wss' via mDNS."));
    EthernetBonjour.startDiscoveringService(serviceName, MDNSServiceTCP, 10000);
  }
 
  // LED = LOW
  digitalWrite(LED_PIN, LOW);

}

void loop() {
  
  // BONJOUR
  EthernetBonjour.run();
  
  // STOP IF NOT FOUND STEWARD AND HAVE NOW STOPPED LOOKING
  if( stoppedLooking == 1 && pairFlag == 0 ) {
    Serial.println("Timed out looking for steward.");
    while(1) {
       // Hang on failure
    }  
  }
  
  
  // SEND INITIAL PAIRING MESSAGE TO STEWARD (ONCE ONLY)
  if( steward && pairFlag == 0 ) {
    Serial.println(F("Connecting to steward..."));
    if( client.connect((char *)ip_to_str(steward),8887) ) {
      webSocketClient.path = "/manage";
      webSocketClient.host = (char *)ip_to_str(steward);
      if (webSocketClient.handshake(client)) {
        Serial.println("Handshake successful");
      } else {
        Serial.println("Handshake failed.");
        while(1) {
          // Hang on failure
        }  
      }
      strcpy(packetBuffer,(char*)pgm_read_word(&pair_message1) );
      strcat(packetBuffer, ultoa( requestID, buffer, 10) );
      strcat(packetBuffer,(char*)pgm_read_word(&pair_message2) );
      webSocketClient.sendData(packetBuffer);
      requestID = requestID + 1;   
      pairFlag = 1; 
    } else {
       Serial.println("Retrying...");
    }
    delay(1000);
  } else if ( steward && pairFlag == 1 ) {
    //Serial.println("Already paired, skipping.");
  }
  
  // SEND HELLO MESSAGE TO STEWARD
  if( steward && pairFlag == 1 && pairResponse == 1 && helloFlag == 0 ) {
      strcpy(packetBuffer,(char*)pgm_read_word(&hello_message1) );
      thingIdentity.toCharArray(buffer,12);
      strcat(packetBuffer, buffer );
      strcat(packetBuffer,(char*)pgm_read_word(&hello_message2) );
      strcat(packetBuffer, ultoa( requestID, buffer, 10) );
      strcat(packetBuffer,(char*)pgm_read_word(&hello_message3) );
      
      // HERE IS WHERE WE SEND THE KEY
      //
      //totp.toCharArray(otherBuffer,96);
      
      strcat(packetBuffer, otherBuffer ); 
      strcat(packetBuffer,(char*)pgm_read_word(&hello_message4) );
      webSocketClient.sendData(packetBuffer);
      requestID = requestID + 1;   
      helloFlag = 1;     
  }
  
  // SEND PROTOTYPE MESSAGE TO STEWARD (ONCE ONLY)
  if( steward && pairFlag == 1 && pairResponse == 1 && helloFlag == 1 && helloResponse == 1 && prototypeFlag == 0 ) {
    
  }
  
  // SEND REGISTER MESSAGE TO STEWARD
  if( steward && pairFlag == 1 && pairResponse == 1 && helloFlag == 1 && helloResponse == 1 && 
                 prototypeFlag == 1 && prototypeResponse == 1 && registerFlag == 0 ) {
    
  }
  
  
  // CHECK FOR RESPONSES & PERFORM MESSAGES
  if (client.connected()) {
     responseData = webSocketClient.getData();
     if( responseData.length() > 0 ) {
       timeOfLastResponse = millis();
       Serial.print("Received data: ");
       Serial.println( responseData );
 
       // PAIRING
       if( steward && pairFlag == 1 && pairResponse == 0 ) {
         
         // CHECK FOR ERROR
         if( responseData.indexOf("error") != -1 ) {
           Serial.println( "Error pairing with steward.");
           while(1) {
             // hang on failure
           }
         }
         
         // PARSE PAIRING MESSAGE
         int startoftag = responseData.indexOf("\"thingID\":");
         int startofquotes = responseData.indexOf(":\"", startoftag);
         int endofquotes = responseData.indexOf("\"", startofquotes+2);
         if( startoftag != -1 ) {
           Serial.print("Indexes = ");
           Serial.print(startofquotes);
           Serial.print(",");
           Serial.println(endofquotes);
           Serial.print( "ThingID = ");
           thingIdentity = responseData.substring(startofquotes+2,endofquotes);
           Serial.println( thingIdentity );
           startoftag = responseData.indexOf("\"base32\":");
           startofquotes = responseData.indexOf(":\"", startoftag);
           endofquotes = responseData.indexOf("\"", startofquotes+2);
           if( startoftag != -1 ) {
             Serial.print("Indexes = ");
             Serial.print(startofquotes);
             Serial.print(",");
             Serial.println(endofquotes);
             Serial.print( "Auth Key = ");
             authKey = responseData.substring(startofquotes+2,endofquotes);      
             Serial.println( authKey );
             
             // HERE IS WHERE WE READ THE EPOCH
             
             // when you successfully pair, record the timestamp value , and record timestamp-(seconds since boot)
             // on SD as "bootstamp". when you do a hello, add seconds since boot to bootstamp to get the time value 
             // to use for the TOTP algorithm.
             // 
             // if the hello fails, then look at the timestamp in the response. if the value is greater than what's 
             // in the file, put it in file, recalculate bootstamp and try again. if the value is less-than-or-equal 
             // to the old value, then something fishy is going on.
             
             
             // ANMD THEN GENERATE THE KEY
             //totp = totp( authKey );

             
             pairResponse = 1;
             //writeIdentity();
           }
         }
       }
       
       //HELLO
       if( steward && pairFlag == 1 && pairResponse == 1 && helloFlag == 1 && helloResponse == 0 ) {
         Serial.println("Got hello response");
         
         // CHECK FOR ERROR
         if( responseData.indexOf("error") != -1 ) {
           Serial.println( "Error pairing with steward.");
           while(1) {
             // hang on failure
           }
         }
         
         // PARSE HELLO MESSAGE
         
       }
       
       // PROTOTYPE
       
       
       //REGISTER
       
       
       //PERFORM
       
       
     }
  }  
  
} // end of loop  

