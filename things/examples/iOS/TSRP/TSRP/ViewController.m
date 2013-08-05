//
//  ViewController.m
//  TSRP
//
//  Created by Alasdair Allan on 05/08/2013.
//  Copyright (c) 2013 Babilim Light Industries. All rights reserved.
//

#import "ViewController.h"
#import "GCDAsyncUdpSocket.h"

@interface ViewController ()

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    motionManager = [[CMMotionManager alloc] init];
    motionManager.deviceMotionUpdateInterval =  1.0 / 10.0;
    [motionManager startDeviceMotionUpdates];
    if (motionManager.deviceMotionAvailable ) {
        timerView = [NSTimer scheduledTimerWithTimeInterval:0.2f target:self selector:@selector(updateView:) userInfo:nil repeats:YES];
        timerMulti = [NSTimer scheduledTimerWithTimeInterval:2.0f target:self selector:@selector(sendMulticast:) userInfo:nil repeats:YES];
    } else {
        [motionManager stopDeviceMotionUpdates];
    }
}

- (void)didReceiveMemoryWarning {
    [super didReceiveMemoryWarning];
}


- (IBAction)switched:(id)sender {
    if( self.reportSwitch.on ) {
        NSLog(@"Switched reporting on.");
    } else {
        NSLog(@"Switched reporting off.");
    }
}


- (void) updateView:(NSTimer *)timer  {
    
    CMDeviceMotion *motionData = motionManager.deviceMotion;
    
    CMAttitude *attitude = motionData.attitude;
    CMAcceleration gravity = motionData.gravity;
    CMAcceleration userAcceleration = motionData.userAcceleration;
    CMRotationRate rotate = motionData.rotationRate;
    
    
    yawLabel.text = [NSString stringWithFormat:@"%2.2f", attitude.yaw];
    pitchLabel.text = [NSString stringWithFormat:@"%2.2f", attitude.pitch];
    rollLabel.text = [NSString stringWithFormat:@"%2.2f", attitude.roll];
    
    accelIndicatorX.progress = ABS(userAcceleration.x);
    accelIndicatorY.progress = ABS(userAcceleration.y);
    accelIndicatorZ.progress = ABS(userAcceleration.z);
    accelLabelX.text = [NSString stringWithFormat:@"%2.2f",userAcceleration.x];
    accelLabelY.text = [NSString stringWithFormat:@"%2.2f",userAcceleration.y];
    accelLabelZ.text = [NSString stringWithFormat:@"%2.2f",userAcceleration.z];
    
    gravityIndicatorX.progress = ABS(gravity.x);
    gravityIndicatorY.progress = ABS(gravity.y);
    gravityIndicatorZ.progress = ABS(gravity.z);
    gravityLabelX.text = [NSString stringWithFormat:@"%2.2f",gravity.x];
    gravityLabelY.text = [NSString stringWithFormat:@"%2.2f",gravity.y];
    gravityLabelZ.text = [NSString stringWithFormat:@"%2.2f",gravity.z];
    
    rotIndicatorX.progress = ABS(rotate.x);
    rotIndicatorY.progress = ABS(rotate.y);
    rotIndicatorZ.progress = ABS(rotate.z);
    rotLabelX.text = [NSString stringWithFormat:@"%2.2f",rotate.x];
    rotLabelY.text = [NSString stringWithFormat:@"%2.2f",rotate.y];
    rotLabelZ.text = [NSString stringWithFormat:@"%2.2f",rotate.z];
    
}

- (void) sendMulticast:(NSTimer *)timer  {
    
    if ( self.reportSwitch.on ) {
    
        NSLog(@"Sending multicast.");
    
        CMDeviceMotion *motionData = motionManager.deviceMotion;
    
        CMAttitude *attitude = motionData.attitude;
        CMAcceleration gravity = motionData.gravity;
        CMAcceleration userAcceleration = motionData.userAcceleration;
        CMRotationRate rotate = motionData.rotationRate;
        
        NSUUID *uuid = [[UIDevice currentDevice] identifierForVendor];
        
        
        NSString *string = @"testing";
        NSData *data = [string dataUsingEncoding:NSUTF8StringEncoding];
    
    
        GCDAsyncUdpSocket *udpSocket = [[GCDAsyncUdpSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        [udpSocket enableBroadcast:YES error:nil];
        [udpSocket sendData:data toHost:@"224.192.32.19" port:22601 withTimeout:-1 tag:0];

    }
    
}

#pragma mark - GCDAsyncUdpSocket Methods


@end
