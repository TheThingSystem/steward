README.txt

This is an INCOMPLETE implementation of the Simple Thing Protocol for Arduino.

It correctly sends the PAIRING message, and reads the reply. It saves the ThingID, AuthKey  and BOOT TIME to SD card so we can use it next time the Arduino is booted. (currently commented out)

The TOTP isn't generated correctly yet. Instead we just pass the AUTH KEY back and send that to the steward.

The code sends the HELLO message (incorrectly since there is no TOTP) and awaits for the response. It checks to see if it has an error, if it does then it updates the BOOT TIME and resends the HELLO (because the board may have been rebooted since initial pairing).

Hooks for the PROTOTYPE, REGISTER and PERFORM messages are present.

When it gets a PERFORM message this will eventually turn a light bulb (aka an LED) on an off.

To use
------

Upload to a MEGA with an Ethernet Shield with a MS-DOS formatted SD card inserted.
It should have an LED on pin 8 (remember to use a ~220 ohm resistor inline).

Upload the sketch, and open the serial terminal. The sketch won't run until you send a character to the board (expecting 9,600 baud connection with Newline).