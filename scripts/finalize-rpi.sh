#!/bin/bash

rm -f /home/pi/.gitconfig /home/pi/.bash_history
sudo rm -f /root/.bash_history
rm steward/steward/db/*
(cd steward/steward/sandbox/; rm *.crt *.xml *.sha1)

sudo bash -c "rm /var/log/steward; touch /var/log/steward"
