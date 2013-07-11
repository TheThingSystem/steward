
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

char *json = "{\"path\":\"/api/v1/actor/perform/device/lighting\",\"requestID\":\"1\",\"perform\":\"on\",\"parameter\":\"{\\\"brightness\\\":100}\"}";

byte mac[] = { 0x0, 0xA2, 0xDA, 0x0D, 0x90, 0xE2 };  

EthernetClient client;
WebSocketClient webSocketClient;

void setup() {
  Serial.begin(9600);
  while(!Serial) {  }

  if (Ethernet.begin(mac) == 0) {
    Serial.println("Error: Failed to configure Ethernet using DHCP");
    while(1) {  }
  } 
  
  Serial.println("Connecting to steward...");
  if( client.connect("192.168.1.91",8887) ) {
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
      webSocketClient.sendData(json);
      
  }   
}

void loop() {
  String data;
  
  if (client.connected()) {
    data = webSocketClient.getData();
    if (data.length() > 0) {
      Serial.print("Received data: ");
      Serial.println(data);
    }
  } else {
    Serial.println("Client disconnected.");
    while (1) {
      // Hang on disconnect.
    }
  }
  
  // wait to fully let the client disconnect
  delay(3000);

}

const char* ip_to_str(const uint8_t* ipAddr) {
  static char buf[16];
  sprintf(buf, "%d.%d.%d.%d\0", ipAddr[0], ipAddr[1], ipAddr[2], ipAddr[3]);
  return buf;
}

