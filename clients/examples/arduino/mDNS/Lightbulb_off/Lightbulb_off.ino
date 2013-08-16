
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

PROGMEM prog_char *json_off = "{\"path\":\"/api/v1/actor/perform/device/lighting\",\"requestID\":\"4\",\"perform\":\"off\",\"parameter\":\"\"}";

byte mac[] = { 0x90, 0xA2, 0xDA, 0x00, 0x1A, 0x08 };   

byte * steward;
int flag = 0;

const char* ip_to_str(const uint8_t*);
void serviceFound(const char* type, MDNSServiceProtocol proto,
                  const char* name, const byte ipAddr[4], unsigned short port,
                  const char* txtContent);

char serviceName[] = "_wss";

EthernetClient client;
WebSocketClient webSocketClient;

void setup() {
  Serial.begin(9600);
  while(!Serial) {  }

  Serial.println("Waiting for DHCP address.");
  if (Ethernet.begin(mac) == 0) {
    Serial.println(F("Error: Failed to configure Ethernet using DHCP"));
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

  EthernetBonjour.begin("arduino");
  EthernetBonjour.setServiceFoundCallback(serviceFound);

  if (!EthernetBonjour.isDiscoveringService()) {
    byte ipAddr[4];

    Serial.println(F("Discovering services of type '_wss' via mDNS."));
    EthernetBonjour.startDiscoveringService(serviceName, MDNSServiceTCP, 10000);
  }
}

void loop() {
  EthernetBonjour.run();
  
  if( steward && flag == 0 ) {
    Serial.println(F("Connecting to steward..."));
    if( client.connect((char *)ip_to_str(steward),8887) ) {
      Serial.println(F("Connected"));
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
      webSocketClient.sendData((char*)pgm_read_word(&json_off));
      flag = 1;
      
    } else {
      Serial.println("Retrying...");
    }
    delay(1000);
  } else {
    Serial.println("Waiting...");
    delay(2000);  
  }
}

void messageReceived( WebSocketClient client, String data) {  
  Serial.println("Data Arrived: " + data);
}

