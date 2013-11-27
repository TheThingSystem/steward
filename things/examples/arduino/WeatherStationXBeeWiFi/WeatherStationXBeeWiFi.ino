
#include <DHT.h>
#define DHTTYPE DHT22

const int dhtPin = 2;
DHT dht(dhtPin, DHTTYPE);

int requestID = 1;

char packetBuffer[512];
char incomingBuffer[64];
char mac[8];
int bufferIndex = 0;

PROGMEM prog_char *loopPacket1 = "{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"";
PROGMEM prog_char *loopPacket2 = "\",\"things\":{\"/device/climate/arduino/sensor\":{\"prototype\":{\"device\":{\"name\":\"Arduino with DHT-22\",\"maker\":\"Arduino\"},\"name\":true,\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"temperature\":\"celsius\",\"humidity\":\"percentage\"}},\"instances\":[{\"name\":\"Weather Station\",\"status\":\"present\",\"unit\":{\"serial\":\"";
PROGMEM prog_char *loopPacket3 = "\",\"udn\":\"195a42b0-ef6b-11e2-99d0-";
PROGMEM prog_char *loopPacket4 = "-dnt-22\"},\"info\":{\"temperature\":";
PROGMEM prog_char *loopPacket5 = ",\"humidity\":";
PROGMEM prog_char *loopPacket6 = "},\"uptime\":";
PROGMEM prog_char *loopPacket7 = "}]}}}";

void setup() {
  Serial.begin(9600);
  Serial1.begin(9600);
  Serial.println("Starting...");
  while(!Serial) { }

  pinMode(dhtPin, INPUT);
  Serial.println("Initialising the DHT sensor.");
  dht.begin();
  
  Serial.println("Sending command string to XBee.");
  Serial1.print("+++");
  Serial.println("Waiting for response");
  delay(2000);
  while ( Serial1.available() ) {
    incomingBuffer[bufferIndex] = Serial1.read();
    bufferIndex++;
    if (strcmp(incomingBuffer, "OK") == 0){
       Serial.println("Got 'OK'");
       Serial.println("Sending ATSL command");
       Serial1.print("ATSL\r");
       delay(200);
       Serial.print("ID is '");
       for( int i = 0; i <= 9; i++ ) {
         incomingBuffer[i] = Serial1.read();
       }
       Serial.print(incomingBuffer);
       Serial.println("'");
       strncat(mac,incomingBuffer, 8);
       Serial.println("Sending ATCN command");
       Serial1.print("ATCN\r");
    }
  }
  Serial.println("Setup complete");
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
    strcat(packetBuffer, itoa( requestID, buffer, 10) );
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket2) );
    for (byte thisByte = 1; thisByte < 9; thisByte++) {
      sprintf(buffer, "%c", incomingBuffer[thisByte] );
      strcat(packetBuffer, buffer); 
    }
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket3) );
    for (byte thisByte = 1; thisByte < 9; thisByte++) {
      sprintf(buffer, "%c", incomingBuffer[thisByte] );
      strcat(packetBuffer, buffer); 
    }  
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket4) );
    strcat(packetBuffer, dtostrf(t,4,2,buffer));
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
    strcat(packetBuffer, dtostrf(h,4,2,buffer));
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );
    strcat(packetBuffer, itoa( millis(), buffer, 10) );
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket7) );

    Serial.println(packetBuffer); 
    Serial1.println(packetBuffer);

  }
  delay(2000);
}
