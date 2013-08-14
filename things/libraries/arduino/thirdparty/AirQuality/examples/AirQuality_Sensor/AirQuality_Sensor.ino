/*
  AirQuality Demo V1.0.
  connect to A1 to start testing. it will needs about 20s to start 
* By: http://www.seeedstudio.com
*/
#include"AirQuality.h"
#include"Arduino.h"
AirQuality airqualitysensor;
int current_quality =-1;
void setup()
{
    Serial.begin(9600);
    airqualitysensor.init(14);
}
void loop()
{
	current_quality=airqualitysensor.slope();
    if (current_quality >= 0)// if a valid data returned.
    {
        if (current_quality==0)
            Serial.println("High pollution! Force signal active");
        else if (current_quality==1)
            Serial.println("High pollution!");
        else if (current_quality==2)
            Serial.println("Low pollution!");
        else if (current_quality ==3)
            Serial.println("Fresh air");
    }
}
ISR(TIMER2_OVF_vect)
{
	if(airqualitysensor.counter==122)//set 2 seconds as a detected duty
	{

			airqualitysensor.last_vol=airqualitysensor.first_vol;
			airqualitysensor.first_vol=analogRead(A0);
			airqualitysensor.counter=0;
			airqualitysensor.timer_index=1;
			PORTB=PORTB^0x20;
	}
	else
	{
		airqualitysensor.counter++;
	}
}
