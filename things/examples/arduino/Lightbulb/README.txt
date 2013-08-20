README.txt

This is an INCOMPLETE implementation of the Simple Thing Protocol for Arduino.

It correctly sends the PAIRING message, and reads the reply. It saves the ThingID and AuthKey to SD card so we can use it next time the Arduino is booted.

The TOTP isn't generated correctly yet. Awaiting a bug fix to get the epoch of the PAIRING RESPONSE message sent as part of the message (no RTC on the Arduino so it needs the steward to tell it the time).

The code sends the HELLO message (incorrectly since there is no TOTP) and awaits for the response. It doesn't do anything with it as yet.

Hooks for the PROTOTYPE, REGISTER and PERFORM messages are present.

When it gets a PERFORM message this will eventually turn a light bulb (aka an LED) on an off.
