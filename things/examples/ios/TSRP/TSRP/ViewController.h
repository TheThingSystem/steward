//
//  ViewController.h
//  TSRP
//
//  Created by Alasdair Allan on 05/08/2013.
//  Copyright (c) 2013 Babilim Light Industries. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <CoreMotion/CoreMotion.h>

@interface ViewController : UIViewController {
    
    IBOutlet UILabel *yawLabel;
    IBOutlet UILabel *pitchLabel;
    IBOutlet UILabel *rollLabel;
    
    IBOutlet UIProgressView *accelIndicatorX;
    IBOutlet UIProgressView *accelIndicatorY;
    IBOutlet UIProgressView *accelIndicatorZ;
    IBOutlet UILabel *accelLabelX;
    IBOutlet UILabel *accelLabelY;
    IBOutlet UILabel *accelLabelZ;
    
    IBOutlet UIProgressView *gravityIndicatorX;
    IBOutlet UIProgressView *gravityIndicatorY;
    IBOutlet UIProgressView *gravityIndicatorZ;
    IBOutlet UILabel *gravityLabelX;
    IBOutlet UILabel *gravityLabelY;
    IBOutlet UILabel *gravityLabelZ;
    
    IBOutlet UIProgressView *rotIndicatorX;
    IBOutlet UIProgressView *rotIndicatorY;
    IBOutlet UIProgressView *rotIndicatorZ;
    IBOutlet UILabel *rotLabelX;
    IBOutlet UILabel *rotLabelY;
    IBOutlet UILabel *rotLabelZ;
    
    CMMotionManager *motionManager;
    NSTimer *timerView;
    NSTimer *timerMulti;
    
    BOOL report;
}

@property (weak, nonatomic) IBOutlet UISwitch *reportSwitch;
- (IBAction)switched:(id)sender;

@end
