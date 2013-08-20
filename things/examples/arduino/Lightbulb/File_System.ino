

void writeIdentity() {
 // Open the settings file for writing
 if (SD.exists("SETTINGS.TXT")) {
    SD.remove("SETTINGS.TXT");
 }
 Settings = SD.open("SETTINGS.TXT", FILE_WRITE);
 Serial.println(F("Writing to SETTINGS.TXT"));
 Settings.print("thingid=");
 Settings.println(thingIdentity);
 Settings.print("authkey=");
 Settings.println(authKey);
 Settings.print("boottime=");
 Settings.println(boottime);
 Settings.close();
 Serial.println(F("Closing SETTINGS.TXT"));
}

void getIdentity() {
 // Open the settings file for reading:
  Settings = SD.open("SETTINGS.TXT");
  Serial.println(F("Reading from SETTINGS.TXT"));
  char character;
  String description = "";
  String value = "";
  boolean valid = true;
  
  // read from the file until there's nothing else in it
  while (Settings.available()) {
     character = Settings.read();
     if(character == '/') {
       
        // Comment - ignore this line
        while(character != '\n'){
           character = Settings.read();
        };
      } else if(isalnum(character)) {  // Add a character to the description
        description.concat(character);
        
      } else if(character =='=') {  
        
         //Serial.print( "Description = " );
         //Serial.println( description );
          
         // start checking the value for possible results
         // First going to trim out all trailing white spaces
         do {
            character = Settings.read();
         } while(character == ' ');
        
         while(character != '\n') {
            if(isalnum(character)) {
                value.concat(character);
             }
             character = Settings.read();            
         };
        
         //Serial.print( "Value = " );
         //Serial.println( value );
         
         if ( description  == "thingid" ) {
           //thingid = (char*)malloc( (value.length()+1) *sizeof(char));
           //value.toCharArray(thingid, (value.length()+1));
           thingIdentity = value;
           description = "";
           value = "";
         }
         if ( description  == "authkey" ) {
           //authkey = (char*)malloc( (value.length()+1) *sizeof(char));
           //value.toCharArray(authkey, (value.length()+1));
           authKey = value;
           description = "";
           value = "";
         }
         if ( description  == "epoch" ) {
           epoch = value;
           description = "";
           value = "";
         }


      } else {
        // Ignore this character (could be space, tab, newline, carriage return or something else)
      }
    
    }
    // close the file:
    Settings.close();
    Serial.println(F("Closing SETTINGS.TXT"));
    
}

