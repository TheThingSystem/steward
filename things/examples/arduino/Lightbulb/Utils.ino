

// TOTP
String totp( String key ) {
  // set vars
  int length = 40;
  char *encoding = "base32";
  int step = 30;
  int initial_time = 0; 
  
  
  // you subtract (cuurent) uptime from the epoch when you receive it,
  // you know the boot time of the device.  when you calculate top, if you
  // add boot time + uptime, you have current time...
  
  // get current time in seconds since the message was recieved
  //   var time = parseInt(Date.now()/1000, 10);
  //   int time = (epoch-timeOfLastResponse)+
  int time = (int)((millis()-timeOfLastResponse)/1000.0);

  // calculate counter value
  var counter = Math.floor((time - initial_time)/ step);
  
  // pass to hotp
  var code = this.hotp({key: key, length: length, encoding: encoding, counter: counter});

  // return the code
  return(code);  
  
}


//Code to print out the free memory

struct __freelist {
  size_t sz;
  struct __freelist *nx;
};

extern char * const __brkval;
extern struct __freelist *__flp;

uint16_t freeMem(uint16_t *biggest)
{
  char *brkval;
  char *cp;
  unsigned freeSpace;
  struct __freelist *fp1, *fp2;

  brkval = __brkval;
  if (brkval == 0) {
    brkval = __malloc_heap_start;
  }
  cp = __malloc_heap_end;
  if (cp == 0) {
    cp = ((char *)AVR_STACK_POINTER_REG) - __malloc_margin;
  }
  if (cp <= brkval) return 0;

  freeSpace = cp - brkval;

  for (*biggest = 0, fp1 = __flp, fp2 = 0;
     fp1;
     fp2 = fp1, fp1 = fp1->nx) {
      if (fp1->sz > *biggest) *biggest = fp1->sz;
    freeSpace += fp1->sz;
  }

  return freeSpace;
}

uint16_t biggest;

void freeMem(char* message) {
  Serial.print(message);
  Serial.print(":\t");
  Serial.println(freeMem(&biggest));
}



