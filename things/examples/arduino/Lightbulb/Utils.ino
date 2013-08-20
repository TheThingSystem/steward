
// TOTP
String generate_totp( ) {
  Serial.println(F("Generating TOTP"));
  int length = 40;
  int step = 30;
  int initial_time = 0; // intial time = 0 means UNIX epoch
  unsigned long time = boottime + (unsigned long)(millis()/1000.0);

  // calculate counter value
  int counter = floor( (time - initial_time)/step );
  Serial.print(F("Counter: "));
  Serial.println( counter );

  // return the code
  return( generate_hotp( length, counter) );  
  
}

String generate_hotp( int length, int counter) {
  
  // we have encoding of "base32" and the key is stored as a string in "authKey" variable
  
  return authKey; // temperaory placeholder to see if it compiles 
}





// DEBUGGING - Code to print out the free memory

/*
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
*/


