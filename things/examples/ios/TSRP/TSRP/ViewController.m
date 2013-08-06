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
    requestID = 1;
    report = false;
}

- (void)didReceiveMemoryWarning {
    [super didReceiveMemoryWarning];
}


- (IBAction)switched:(id)sender {
    if( self.reportSwitch.on ) {
        NSLog(@"Switched reporting on.");
        report = true;
    } else {
        NSLog(@"Switched reporting off.");
        report = false;
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
    
    if ( report ) {
        
        CMDeviceMotion *motionData = motionManager.deviceMotion;
        
        CMAttitude *attitude = motionData.attitude;
        CMAcceleration gravity = motionData.gravity;
        CMAcceleration userAcceleration = motionData.userAcceleration;
        CMRotationRate rotate = motionData.rotationRate;
        
        NSLog(@"Sending multicast.");
        
        NSUUID *uuid = [[UIDevice currentDevice] identifierForVendor];
        NSTimeInterval systemUptime = [[NSProcessInfo processInfo] systemUptime];
        
        NSString *string = [NSString stringWithFormat:@"{\"path\":\"/api/v1/thing/reporting\",\"requestID\":\"%d\",\"things\":{\"/device/sensor/phone/iphone\":{\"prototype\":{\"device\":{\"name\":\"iPhone\",\"maker\":\"Apple\"},\"name\":true,\"status\":[\"present\",\"absent\",\"recent\"],\"properties\":{\"roll\":\"radians\",\"pitch\":\"radians\",\"yaw\":\"radians\",\"x acceleration\":\"g\",\"y acceleration\":\"g\",\"z acceleration\":\"g\",\"x gravity\":\"g\",\"y gravity\":\"g\",\"z gravity\":\"g\",\"x rotation\":\"radians/s\",\"y rotation\":\"radians/s\",\"z rotation\":\"radians/s\"}},\"instances\":[{\"name\":\"iPhone\",\"status\":\"present\",\"unit\":{\"serial\":\"%@\",\"udn\":\"195a42b0-ef6b-11e2-99d0-%@-iphone\"},\"info\":{\"roll\":\"%f\",\"pitch\":\"%f\",\"yaw\":\"%f\",\"x acceleration\":\"%f\",\"y acceleration\":\"%f\",\"z acceleration\":\"%f\",\"x gravity\":\"%f\",\"y gravity\":\"%f\",\"z gravity\":\"%f\",\"x rotation\":\"%f\",\"y rotation\":\"%f\",\"z rotation\":\"%f\"},\"uptime\":\"%f\"}]}}}",requestID, uuid.UUIDString, uuid.UUIDString, attitude.roll, attitude.pitch, attitude.yaw, userAcceleration.x, userAcceleration.y, userAcceleration.z, gravity.x, gravity.y, gravity.z, rotate.x, rotate.y, rotate.z, systemUptime];
        NSData *data = [string dataUsingEncoding:NSUTF8StringEncoding];
    
        GCDAsyncUdpSocket *udpSocket = [[GCDAsyncUdpSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
        [udpSocket enableBroadcast:YES error:nil];
        [udpSocket sendData:data toHost:@"224.192.32.19" port:22601 withTimeout:-1 tag:0];

        requestID = requestID + 1;
    }
    
}

#pragma mark - GCDAsyncUdpSocket Methods


@end
