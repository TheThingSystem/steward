README.txt

We use an Arduino Mega 2560, an Arduino Ethernet Shield and a Wicked Devices Air Quality Sensor Shield.

The Wicked Device Sensor Shield was designed for an Uno-compatible board and the NO2 and CO sensors onboard use an 12C interface. These are on pins A3 (SDA) and A4 (SCL) on an Uno. However because of the high overhead needed for the network stack we need to use a Mega where these pins are located elsewhere. We therefore need to jumper the pins from A3 and A4 (see jumpered_wiring_1.JPG) to the SDA and SCL pins on the Mega (see jumpered_wiring_2.JPG) located on the other side of the board.