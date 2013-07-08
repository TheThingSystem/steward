//
//  ViewController.h
//  HelloLightbulb
//
//  Created by Alasdair Allan on 06/07/2013.
//  Copyright (c) 2013 Babilim Light Industries. All rights reserved.
//

#import <UIKit/UIKit.h>
#import "SRWebSocket.h"

@interface ViewController : UIViewController <SRWebSocketDelegate> {
    NSURLRequest *wssRequest;
    SRWebSocket *websocket;
    
}

@property (weak, nonatomic) IBOutlet UISwitch *lightswitch;
- (IBAction)switched:(id)sender;

@end
