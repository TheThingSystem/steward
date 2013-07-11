
#include <Dhcp.h>
#include <Dns.h>
#include <Ethernet.h>
#include <EthernetClient.h>
#include <util.h>
#include <SPI.h>

#include <Base64.h>
#include <global.h>
#include <MD5.h>
#include <sha1.h>
#include <WebSocketClient.h>

const char *server = "192.168.1.91";

const int buttonPin = 7;
const int ledPin = 6;

int ledState = LOW;         
int buttonState;             
int lastButtonState = LOW;
int sentPacket = 0;

long lastDebounceTime = 0;  
long debounceDelay = 50; 

char *jsonOff = "{\"path\":\"/api/v1/actor/perform/device/lighting\",\"requestID\":\"2\",\"perform\":\"off\",\"parameter\":\"\"}";
//char *jsonOn = "{\"path\":\"/api/v1/actor/perform/device/lighting\",\"requestID\":\"1\",\"perform\":\"on\",\"parameter\":\"{\\\"brightness\\\":100,\\\"color\\\":{\\\"model\\\":\\\"rgb\\\",\\\"rgb\\\":{\\\"r\\\":255,\\\"g\\\":255,\\\"b\\\":255}}}\"}";
char *jsonOn = "{\"path\":\"/api/v1/actor/perform/device/lighting\",\"requestID\":\"1\",\"perform\":\"on\",\"parameter\":\"{\\\"brightness\\\":100}\"}";
byte mac[] = { 0x0, 0xA2, 0xDA, 0x0D, 0x90, 0xE2 };  

EthernetClient client;
WebSocketClient webSocketClient;

void setup() {
  pinMode(buttonPin, INPUT);
  pinMode(ledPin, OUTPUT);  
  
  Serial.begin(9600);
  while(!Serial) {  }

  if (Ethernet.begin(mac) == 0) {
    Serial.println("Error: Failed to configure Ethernet using DHCP");
    while(1) {  }
  } 
  Serial.print("IP address: ");
  for (byte thisByte = 0; thisByte < 4; thisByte++) {
    Serial.print(Ethernet.localIP()[thisByte], DEC);
    Serial.print("."); 
  }
  Serial.println();
}

void loop() {
  String data;
  int reading = digitalRead(buttonPin);
  
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  } 
  if ((millis() - lastDebounceTime) > debounceDelay) {
    buttonState = reading;
    //Serial.print( "Button state = " );
    //Serial.println( buttonState );
    if ( buttonState && !sentPacket ) {
       if ( ledState ) {
          Serial.println( "Turning lights off.");
          Serial.println("Connecting to steward...");
          if( client.connect(server,8887) ) {
            Serial.println("Connected");
            webSocketClient.path = "/manage";
            webSocketClient.host = "dastardly.local";
            if (webSocketClient.handshake(client)) {
              Serial.println("Handshake successful");
            } else {
              Serial.println("Handshake failed.");
              while(1) {
                // Hang on failure
              }  
            }
            webSocketClient.sendData(jsonOff);
          }          

       } else {       
          Serial.println( "Turning lights on.");
          Serial.println("Connecting to steward...");
          if( client.connect(server,8887) ) {
            Serial.println("Connected");
            webSocketClient.path = "/manage";
            webSocketClient.host = "dastardly.local";
            if (webSocketClient.handshake(client)) {
              Serial.println("Handshake successful");
            } else {
              Serial.println("Handshake failed.");
              while(1) {
                // Hang on failure
              }  
            }
            webSocketClient.sendData(jsonOn);
          }                    
          
       }
       sentPacket = 1;
    }
  }
  
  if (client.connected()) {
    data = webSocketClient.getData();
    if (data.length() > 0) {
      Serial.print("Received data: ");
      Serial.println(data);
      client.stop();
      if ( ledState ) {
          digitalWrite(ledPin, LOW);
          ledState = LOW;       
      } else {
          digitalWrite(ledPin, HIGH);
          ledState = HIGH;       
      }
    }
  }
  
  if ( lastButtonState != reading ) {
     sentPacket = 0; 
  }  
  lastButtonState = reading;
}

