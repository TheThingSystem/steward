// based on example code from https://github.com/adafruit/Adafruit_CC3000_Library (see below for "This is an example")
#include <Adafruit_CC3000.h>
#include <ccspi.h>
#include <SPI.h>
#include <string.h>
#include "utility/debug.h"
#include "utility/nvmem.h"

#include "DHT.h"


unsigned long requestID = 1;
unsigned long next_heartbeat = 0;


#define Vref    4.95

// logic taken from https://github.com/bilsch/arduino_anemometer/blob/master/wind_sensor/wind_sensor.ino
#define MD550_SENSOR A0
int wind_max = 0;
int wind_min = 1023;
unsigned long calibration_time = 40000;


// logic taken from http://www.seeedstudio.com/wiki/Grove_-_Temperature_and_Humidity_Sensor_Pro
#define DHT_SENSOR   A2
#define DHT_TYPE     DHT22
DHT dht(DHT_SENSOR, DHT_TYPE);

// logic taken from http://www.seeedstudio.com/wiki/Grove_-_Dust_Sensor
#define DUST_SENSOR   8
unsigned long low_pulse_occupancy = 0;
unsigned long sample_time = 30000;


PROGMEM prog_char *loopPacket1 = "{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"";
PROGMEM prog_char *loopPacket2 = "\",\"things\":{\"/device/climate/arduino/ventilation\":{\"prototype\":{\"device\":{\"name\":\"Return Ventilation Sensor Array\",\"maker\":\"Modern Device/Seed Studio\"},\"name\":\"true\",\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"flow\":\"sigmas\",\"concentration\":\"pcs/liter\",\"temperature\":\"celcius\",\"humidity\":\"percentage\"}},\"instances\":[{\"name\":\"Return Ventilation Sensor\",\"status\":\"present\",\"unit\":{\"serial\":\"";
PROGMEM prog_char *loopPacket3 = "\",\"udn\":\"195a42b0-ef6b-11e2-99d0-";
PROGMEM prog_char *loopPacket4 = "-ventilation\"},\"info\":{\"concentration\":";
PROGMEM prog_char *loopPacket5 = ",\"flow\":";
PROGMEM prog_char *loopPacket6 = ",\"temperature\":";
PROGMEM prog_char *loopPacket7 = ",\"humidity\":";
PROGMEM prog_char *loopPacket8= "},\"uptime\":";
PROGMEM prog_char *loopPacket9= "}]}}}";

unsigned int port = 22601;
// All TSRP transmissions are via UDP to port 22601 on multicast address '224.192.32.19'.
#define WLAN_SSID       NULL          // cannot be longer than 32 characters!
#define WLAN_PASS       "..."
#define WLAN_SECURITY   WLAN_SEC_WPA2

Adafruit_CC3000_Client udp;
byte mac[6];
char packetBuffer[768];

void setup() {
  int wind;
  unsigned long ctime;

  Serial.begin(9600);
  Serial.println("Starting...");
  while(!Serial) { }

  Serial.println("Initializing MD550 sensor.");
  pinMode(MD550_SENSOR, INPUT);
  delay(10000);
  ctime = millis() + calibration_time;
  do {
    wind = analogRead(MD550_SENSOR);
    if ((wind < 0) || (1023 < wind)) { ctime += 1000; continue; }
    if (wind > wind_max) wind_max = wind;
    if (wind < wind_min) wind_min = wind;    
  } while(millis() < ctime);
  Serial.print("MD550 min: ");Serial.print(wind_min);Serial.print(", max: ");Serial.println(wind_max);

  Serial.println("Initializing DHT sensor.");
  dht.begin();

  pinMode(DUST_SENSOR, INPUT);

  Adafruit_CC3000 *wifi = CC3000_setup(WLAN_SSID, WLAN_PASS, WLAN_SECURITY);
  uint32_t ip   = wifi->IP2U32(224,192,32,19);
  uint16_t port = 22601;
  unsigned long timeout = millis() + 15000;
  for (udp = wifi->connectUDP(ip, port); !udp.connected(); ) {
    if (millis() >= timeout) { Serial.println(F("failed to get a UDP socket from the CC3000")); for (;;); }
  }

  Serial.print("MAC address: ");
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
    if (mac[thisByte] < 0x0a) Serial.print("0");
    Serial.print(mac[thisByte], HEX);
    Serial.print(":");
  }
  Serial.println();

  next_heartbeat = millis() + sample_time;
}

void loop() {
  int wind;
  float humidity, temperature, flow, ratio, concentration;
  char  buffer[24];
  unsigned long now;

  low_pulse_occupancy += pulseIn(DUST_SENSOR, LOW) + sample_time;

  now = millis();
  if (now < next_heartbeat) return;
  next_heartbeat = millis() + sample_time;

  wind = analogRead(MD550_SENSOR);
  if ((wind < wind_min) || (wind_max < wind)) flow = -1.0;
  else flow = (((float) map(wind, wind_min, wind_max, 0, 255)) * Vref) / 1023;

  humidity = dht.readHumidity();
  temperature = dht.readTemperature();

  ratio = low_pulse_occupancy / (sample_time * 10.0);                       // Integer percentage 0=>100
  concentration = 1.1*pow(ratio, 3) - 3.8*pow(ratio, 2) + 520*ratio + 0.62; // using spec sheet curve
  Serial.print("Dust lpo: ");Serial.print(low_pulse_occupancy);Serial.print(", ratio: ");Serial.println(ratio);
  low_pulse_occupancy = 0;

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
  strcat(packetBuffer, dtostrf(concentration, 12, 4, buffer));

  if (flow >= 0.0) {
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket5) );
    strcat(packetBuffer, dtostrf(flow, 12, 4, buffer));
  }

  if (!isnan(temperature)) {
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket6) );
    strcat(packetBuffer, dtostrf(temperature, 12, 4, buffer));
  }

  if (!isnan(humidity)) {
    strcat(packetBuffer,(char*)pgm_read_word(&loopPacket7) );
    strcat(packetBuffer, dtostrf(humidity, 12, 4, buffer));
  }

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket8) );
  strcat(packetBuffer, ultoa( now, buffer, 10) );

  strcat(packetBuffer,(char*)pgm_read_word(&loopPacket9) );

  int n = strlen(packetBuffer);
  Serial.print("writing ");Serial.print(n);Serial.println(" octets");
  Serial.println(packetBuffer);

  int cc = udp.write(packetBuffer, n);
  if (cc < 0) { Serial.print("error writing packet: "); Serial.println(n);
  } else if (cc != n) {
    Serial.print("wrote "); Serial.print(cc); Serial.print(" octets, but expected to write "); Serial.println(n);
  }

  requestID = requestID + 1;
}


/*************************************************** 
  This is an example for the Adafruit CC3000 Wifi Breakout & Shield

  Designed specifically to work with the Adafruit WiFi products:
  ----> https://www.adafruit.com/products/1469

  Adafruit invests time and resources providing this open source code, 
  please support Adafruit and open-source hardware by purchasing 
  products from Adafruit!

  Written by Kevin Townsend & Limor Fried & Rick Lesniak for Adafruit Industries.  
  BSD license, all text above must be included in any redistribution
 ****************************************************/

                                  // These are the interrupt and control pins
#define ADAFRUIT_CC3000_IRQ    3  // MUST be an interrupt pin!
#define ADAFRUIT_CC3000_VBAT   5  // These can be any two pins
#define ADAFRUIT_CC3000_CS    10  //   ..
// Use hardware SPI for the remaining pins
// On an UNO, SCK = 13, MISO = 12, and MOSI = 11

#define NVMEM_USER15_FILEID    (15)
#define NVMEM_USER15_FILESIZE  (1 + 32 + 1 + 32 + 1)    // version + SSID + NUL + passphrase + NUL
#define NVMEM_USER15_FILEVRSN  ' '                      // probably will never change, but let's future-proof!


Adafruit_CC3000 *CC3000_setup(char *ssid, char *passphrase, unsigned long security)
{
  unsigned long len;
  char buffer[NVMEM_USER15_FILESIZE + 2];

  Serial.println(F("Initializing the CC3000"));
  Adafruit_CC3000 cc3000 = Adafruit_CC3000(ADAFRUIT_CC3000_CS, ADAFRUIT_CC3000_IRQ, ADAFRUIT_CC3000_VBAT, SPI_CLOCK_DIV2);

  displayFreeRAM();

  displayDriverMode();
  if (!cc3000.begin()) { Serial.println(F("Unable to initialize the CC3000! Check your wiring?")); for (;;); }

  if (!cc3000.getMacAddress(mac)) { Serial.println(F("unable to retrieve MAC address")); for (;;); }
  Serial.print("MAC address      : ");
  for (byte thisByte = 0; thisByte < 6; thisByte++) {
    if (thisByte != 0) Serial.print(":");
    if (mac[thisByte] < 0x0a) Serial.print("0");
    Serial.print(mac[thisByte], HEX);
  }
  Serial.println();
  
  uint16_t firmware = checkFirmwareVersion(&cc3000);
  if ((firmware != 0x113) && (firmware != 0x118)) { Serial.println(F("Wrong firmware version!")); for (;;); }
  
  Serial.println(F("\nDeleting old connection profiles"));
  if (!cc3000.deleteProfiles()) { Serial.println(F("unable to delete old connection profiles")); for (;;); }

  memset(buffer, 0x00, sizeof buffer);
  if (ssid == NULL) {
    if (nvmem_read(NVMEM_USER15_FILEID, NVMEM_USER15_FILESIZE, 0, (unsigned char *) buffer) != 0) {
      Serial.println(F("unable to read SSID/passphrase from NVMEM, caller MUST supply these parameters")); for (;;);
    }
    if (buffer[0] != NVMEM_USER15_FILEVRSN) {
      Serial.println(F("wrong format for SSID/passphrase from NVMEM, caller MUST supply these parameters")); for (;;);
    }

    ssid = buffer + 1;
    passphrase = ssid + strlen(ssid) + 1;
    if ((*ssid == '\0') || (*passphrase == '\0')) {
      Serial.println(F("invalid format for SSID/passphrase from NVMEM, caller MUST supply these parameters")); for (;;);
    }
    Serial.println(F("Retrieving SSID/passphrase from NVRAM"));
  }

#ifdef CC3000_TINY_DRIVER
  if (security !== WLAN_SEC_UNSEC) { Serial.print(F("Secure connections are not available in 'tiny' mode")); for (;;); }
#endif

  if (!cc3000.connectToAP(ssid, passphrase, security)) { Serial.print(F("unable to connect to access point ")); for (;;); }   
  Serial.println(F("Connected!"));  

  if ((buffer[0] == '\0') && ((1 + strlen(ssid) + strlen(passphrase) + 2) <= NVMEM_USER15_FILESIZE)) {
    char *cp = buffer;

    *cp++ = NVMEM_USER15_FILEVRSN;
    strcpy(cp, ssid);
    cp += strlen(ssid) + 1;
    strcpy(cp, passphrase);
    cp += strlen(passphrase) + 1;
    len = cp - buffer;

           if (nvmem_create_entry(NVMEM_USER15_FILEID, NVMEM_USER15_FILESIZE) != 0) {
      Serial.println(F("unable to create entry to save SSID/passphrase in NVRAM, continuing"));
    } else if (nvmem_write(NVMEM_USER15_FILEID, len, 0, (unsigned char *) buffer) != 0) {
      Serial.println(F("unable to write entry for SSID/passphrase in NVRAM, continuing"));
    } else {
      Serial.print(F("Saved SSID/passphrase to NVRAM, "));
      Serial.print(len);
      Serial.println(F(" octets"));
    }
  }

  Serial.println(F("Waiting for IP address"));
  unsigned long timeout = millis() + 20000;
  while (!cc3000.checkDHCP()) {
    if (millis() >= timeout) { Serial.println(F("failed to configure CC3000 using DHCP")); for (;;); }
    delay(100);
  }  

  /* Display the IP address DNS, Gateway, etc. */  
  while (!displayConnectionDetails(&cc3000)) delay(1000);

  return &cc3000;
}

void CC3000_finalize(Adafruit_CC3000 *cc3000)
{
  Serial.println(F("Closing the connection"));
  cc3000->disconnect();
}


void displayFreeRAM(void)
{
  Serial.print(F("Free RAM         : "));
  Serial.println(getFreeRam(), DEC);
}

/**************************************************************************/
/*!
    @brief  Displays the driver mode (tiny of normal), and the buffer
            size if tiny mode is not being used

    @note   The buffer size and driver mode are defined in cc3000_common.h
*/
/**************************************************************************/
void displayDriverMode(void)
{
  #ifdef CC3000_TINY_DRIVER
    Serial.println(F("CC3000 is configured for 'Tiny' mode"));
  #else
    Serial.print(F("TX/RX buffer size: "));
    Serial.print(CC3000_TX_BUFFER_SIZE);
    Serial.print(F(" / "));
    Serial.print(CC3000_RX_BUFFER_SIZE);
    Serial.println(F(" octets"));
  #endif
}

/**************************************************************************/
/*!
    @brief  Tries to read the CC3000's internal firmware patch ID
*/
/**************************************************************************/
uint16_t checkFirmwareVersion(Adafruit_CC3000 *cc3000)
{
  uint8_t major, minor;
  uint16_t version;
  
#ifdef CC3000_TINY_DRIVER  
  version = 0x113;
#else
  if(!cc3000->getFirmwareVersion(&major, &minor))
  {
    Serial.println(F("Unable to retrieve the firmware version!"));
    version = 0;
  }
  else
  {
    Serial.print(F("Firmware version : "));
    Serial.print(major); Serial.print(F(".")); Serial.println(minor);
    version = ((major & 0xff) << 8) | (minor & 0xff);
  }
#endif
  return version;
}

/**************************************************************************/
/*!
    @brief  Tries to read the IP address and other connection details
*/
/**************************************************************************/
bool displayConnectionDetails(Adafruit_CC3000 *cc3000)
{
  uint32_t ipAddress, netmask, gateway, dhcpserv, dnsserv;
  
  if(!cc3000->getIPAddress(&ipAddress, &netmask, &gateway, &dhcpserv, &dnsserv))
  {
    Serial.println(F("Unable to retrieve the IP Address!"));
    return false;
  }
  else
  {
    Serial.print(F("IP address       : "));   cc3000->printIPdotsRev(ipAddress);
    Serial.print(F("\nIP network mask  : ")); cc3000->printIPdotsRev(netmask);
    Serial.print(F("\nIP gateway       : ")); cc3000->printIPdotsRev(gateway);
    Serial.print(F("\nDHCP server      : ")); cc3000->printIPdotsRev(dhcpserv);
    Serial.print(F("\nDNS  server      : ")); cc3000->printIPdotsRev(dnsserv);
    Serial.println();
    return true;
  }
}
