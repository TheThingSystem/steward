
void serviceFound(const char* type, MDNSServiceProtocol proto,
                  const char* name, const byte ipAddr[4],
                  unsigned short port, const char* txtContent) {
                    
  if (NULL == name) {
    Serial.println(F("Finished discovering services"));
    stoppedLooking = 1;
  } else {
    Serial.print(F("Found: '"));
    Serial.print(name);
    Serial.print(F("' at "));
    Serial.print(ip_to_str(ipAddr));
    Serial.print(F(", port "));
    Serial.print(port);
    Serial.println(F(" (TCP)"));

    if (txtContent) {
      Serial.print(F("\ttxt record: "));
      
      char buf[256];
      char len = *txtContent++, i=0;;
      while (len) {
        i = 0;
        while (len--)
          buf[i++] = *txtContent++;
        buf[i] = '\0';
        Serial.print(buf);
        len = *txtContent++;
        
        if (len)
          Serial.print(", ");
        else
          Serial.println();
      }
    }
  
    if ( strcmp( name, "steward" ) == 0 ) {
       Serial.print(F("Found the 'steward' at "));
       Serial.print(ip_to_str(ipAddr));
       Serial.println(".");
       steward = (byte*)ipAddr;
    }  
  }
}

const char* ip_to_str(const uint8_t* ipAddr) {
  static char buf[16];
  sprintf(buf, "%d.%d.%d.%d\0", ipAddr[0], ipAddr[1], ipAddr[2], ipAddr[3]);
  return buf;
}
