//
//  ViewController.m
//  HelloLightbulb
//
//  Created by Alasdair Allan on 06/07/2013.
//  Copyright (c) 2013 Babilim Light Industries. All rights reserved.
//

#import "ViewController.h"

@interface ViewController ()

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    wssRequest = [NSURLRequest requestWithURL:[NSURL URLWithString:@"wss://192.168.1.106:8888/manage"]];

}

- (void)didReceiveMemoryWarning {
    [super didReceiveMemoryWarning];

}

#pragma mark - Light Switch

- (IBAction)switched:(id)sender {
    
    websocket = [[SRWebSocket alloc] initWithURLRequest:wssRequest];
    websocket.delegate = self;
    [websocket open];
    
}

#pragma mark - SRWebSocketDelegate Methods

- (void)webSocket:(SRWebSocket *)webSocket didReceiveMessage:(id)message {
    NSLog(@"webSocket:didRecieveMessage: %@", message);
    [websocket close];

}

#pragma mark Optional Methods

- (void)webSocketDidOpen:(SRWebSocket *)webSocket {
    NSLog(@"webSocketDidOpen:");
    if( self.lightswitch.on ) {
        NSLog(@"Switching light on");
        NSString *json = @"{\"path\":\"/api/v1/actor/perform/device/lighting\",\"requestID\":\"1\",\"perform\":\"on\",\"parameter\":\"{\\\"brightness\\\":100,\\\"color\\\":{\\\"model\\\":\\\"rgb\\\",\\\"rgb\\\":{\\\"r\\\":255,\\\"g\\\":255,\\\"b\\\":255}}}\"}";
        
        [websocket send:json];
    } else {
        NSLog(@"Switching light off");
        NSString *json = @"{\"path\":\"/api/v1/actor/perform/device/lighting\",\"requestID\":\"2\",\"perform\":\"off\",\"parameter\":\"\"}";

        [websocket send:json];
        
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didFailWithError:(NSError *)error {
    NSLog(@"webSocket:didFailWithError:%@", error);
    [websocket close];
}

- (void)webSocket:(SRWebSocket *)webSocket didCloseWithCode:(NSInteger)code reason:(NSString *)reason wasClean:(BOOL)wasClean {
    NSLog(@"webSocket:didCloseWithCode:%d reason:'%@' wasClean:%d", code, reason, wasClean);
 
}

@end
