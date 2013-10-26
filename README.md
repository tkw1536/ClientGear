# ClientGear

ClientGear is a Gearman Client fo the browser. Still under development. 

## How to use

1) start a GearMan server for example at  'yourgearmanserver.com:4730'
2) start websockify. Proxy connections from the Gearman server to the browser: 
	./run localhost:8080 yourgearmanserver.com:4730
3) Load the client side libraries in the browser and start working!


## Whats working

So far, primitive package encodeing and decoding works. Example: 

```js
var ws = new Websock(); //Create Socket Connection

var client = new ClientGear.primitiveGear(ws); //Create a primitive decoder / encoder

//Lets set up an event handler
client.on("ECHO_RES", function(p){
    alert(p);  
}); 

// client.on(PACKAGE_NAME, function(arg1, arg2){}) //called once a package of a certain type is received. 

ws.open("ws://localhost:8080"); //open the socket connection

client.send("ECHO_REQ", ["Hello! This should be alerted! "]); 
// client.send(PACKAGE_NAME, ARGUMENTS) //sends a package to the server
```