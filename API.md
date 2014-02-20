# API

This page contains the API exposed by the ClientGear library. 

## ClientGear 

* Static Function: `ClientGear.createWorker(url, name, callback, postponeInit)`: Creates a worker and returns it. 
	* `url` to connect to (via websockify)
	* `name` of the worker. Has to be unique
	* `function callback(worker)` Callback once the worker is ready
		* `worker`, an instance of `ClientGear.Worker`
	* `postponeInit` Optional. If set to true the worker will not create a connection until the init method is called. 
* Static Function: `ClientGear.createClient(url, callback, postponeInit)`: Creates a client and'returns it. 
	* `url` to connect to (via websockify)
	* `function callback(client)` Callback once the worker is ready
		* `client`, an instance of `ClientGear.Client`
	* `postponeInit` Optional. If set to true the client will not create a connection until the init method is called. 

## ClientGear.EventEmitter

Represents an EventEmitter. It can emit and listen to events. 

* Constructor: `new ClientGear.EventEmitter(emit_errors)` Creates a new event emitter. 
	* `emit_errors` Optional. If set to false, will not emit the error event automatically. 

* Function: `.on(event, handler)`: Registers an event handler for an event. 
	* `event` to register handler for. 
	* `function handler()` Handler for the event. 
* Function: `.once(event, handler)`: Register a one-time event handler for an event. 
	* `event` to register handler for. 
	* `function handler()` Handler for the event. 
* Function: `.off(event, handler)`: Deregisters all (or one) event handlers. 
	* `event` to deregiert from. 
	* `handler` Id of handler to deregister. If not given, all will be unregistered. 
* Function: `.emit(event, args)`: Emits an event. 
	* `event` Event to trigger. 
	* `args` Arguments to pass to function. 
	* returns an array of results. 

* Event: `error (e, event, handler)`: Emitted when an error occurs while emitting an event. 
	* `e`: Exception that occured
	* `event`: Name of event that was being emitted. 
	* `handler`: Handler which caused the problem. 

## ClientGear.Client

Represents a client. Should usually only be created via the `ClientGear.createClient` function. 

Also inherits all functions from EventEmitter. 


* Constructor: `new ClientGear.Client(socket, postponeInit)`: Creates a new client. 
	* `socket` is a WebSockify websocket object that will be used for all communitcation. 
	* `postponeInit` If set to true the client will not create a connection until the init method is called. 

* Property: `._primitive`: A reference to the ClientGear.primitiveGear associated with this Client. 

* Function: `.init()`: Initialises the Client. Should be called only if postponeInit is false. 
* Function: `.initCW()`: Internal. Used to initialise shared worker and client code. 
* Function: `.createJob(type, data, priority)`: Creates a job and returns it. 
	* `type` contains the function name to perform
	* `data` to pass as argument to the worker
	* `priority` for the job. Optionally one of "LOW", "NORMAL" or "HIGH". 
* Function: `.setOption(option, callback)`: Sets an option. 
	* `option` to set. Right now, only "exceptions"
	* `function callback(success, option_or_msg)` Callback
		* `success`
		* `option_or_msg` contains the option name if successfull or a message
* Function: `.echo(payload, callback)`: Sends an echo package with the given payload. 
	* `payload` to use. Should be a string or byte array. 
	* `function callback(success)` Callback once the response package is received. 
		* `success` if the payload is successfully returned. 

* Event: `set_option(option)`: Occures when an option was successfully set. 
	* `option` that was set. 

## ClientGear.Client.Job

Represents a job in client mode. Should usually only be created via the `ClientGear.Client.createJob` function. 

Also inherits all functions from EventEmitter. 

* Constructor: `new ClientGear.Client.Job(Client, type, data, priority)`: Creates a new client side job. 
	* `client` is the associated client to this job
	* `type` contains the function name to perform
	* `data` to pass as argument to the worker. Array of strings or array of byte arrays. 
	* `priority` for the job. Optionally one of "LOW", "NORMAL" or "HIGH". Defaults to "NORMAL". 

* Property: `.uid` Assigned unique id of this job or false. 
* Property: `.submitted` Boolean indicating if this job was submitted or not. 
* Property: `.finished` Boolean indicating if this job was finished or not. 
* Property: `._type` Function name to perform
* Property: `._data` Data to pass as arguments to the worker
* Property: `._priority` Priority of this job. One of "LOW", "NORMAL" or "HIGH". 
* Property: `.Client` The client associated with this job. 

* Function: `.init()` Internal. Initialises this job. Will not submit it to the server. 
* Function: `.submit(callback)` Submits this job to the server. 
	* `function callback(data, success)` Callback once the job has finished. 
		* `data` The resulting data from the job or an error message if the job failed. 
		* `success` is true if the job was successfull. 
* Function: `.submitBackground()` Submits this job to the server in the background. 
* Function: `.abandon()` Abandons this job and discards any packages from the server regarding this job. 

* Function: `.getStatus(callback)` Asks the server for the current status of this job. Will not be available if submitted in background. 
	* `function callback(statusKnown, isRunning, completedNumerator, completedDeNumerator)` Called once the server returns the status. 

* Event: `created`: Occurs when this job is successfully created on the server. 
* Event: `finish(data, success)`: Occurs when the job finishes on the server. Will not be emitted if submitted in background. 
	* `data` The resulting data from the job or an error message if the job failed. 
	* `success` is true if the job was successfull. 
* Event: `complete(data)`: Occurs when the job completes successfully on the server. Will not be emitted if submitted in background. 
	* `data` The data returned from the server. 
* Event: `fail(msg)`: Occurs when the job fails. Will not be emitted if submitted in background. 
	* `msg` May contain a message from the server. 
* Event: `data(data)`: Occurs when the server sends data concerning the job. Will not be emitted if submitted in background. 
	* `data` send by the server
* Event: `warning(msg)`: Occurs when a warning occurs for this job. Will not be emitted if submitted in background. 
	* `msg` The message given by the warning. 
* Event: `status(num, denum)`: Occurs when a status package is received from the server. Will not be emitted if submitted in background. 
	* `num` The numerator of the status indicator. 
	* `denum` The denumerator of the status indicator. 

## ClientGear.Worker

Represents a worker. Should usually only be created via the `ClientGear.createWorker` function. 

Also inherits all functions from EventEmitter. 

* Constructor: `new ClientGear.Worker(socket, name, postponeInit)`: Creat
	* `socket` is a WebSockify websocket object that will be used for all communication. 
	* `postponeInit` If set to true the worker will not create a connection until the init method is called. 

* Property: `._primitive`: A reference to the ClientGear.primitiveGear associated with this Worker. 
* Property: `.jobs_left`: Number of jobs left to work on. 


* Function: `.init()`: Initialises the Worker. Should be called only if postponeInit is false. 
* Function: `.initCW()`: Internal. Used to initialise shared worker and client code. 
* Function: `.setName(name)`: Sets the name of this worker. This should be unique on a per-server basis. 
	* `name` to use
* Function: `.getName()`: Gets the name of this worker. 
* Function: `.echo(payload, callback)`: Sends an echo package with the given payload. 
	* `payload` to use. Should be a string or byte array. 
	* `function callback(success)` Callback once the response package is received. 
		* `success` if the payload is successfully returned. 
* Function: `.canDo(func)`: Checks if this worker can do the specefied function. 
	* `func` to check. 
* Function: `.registerFunction(func, handler, timeout)`: Registers a worker function. 
	* `func` is the name of the function to register. 
	* `function handler(data, job)` A function to handle the given job. 
		* `data` The data passed to the job. 
		* `job` is a reference to the respective `ClientGear.Worker.Job` instance. 
	* `timeout` Optional. If given, will tell the server the job will automatically be killed after `timeout` expires. 
* Function: `.deRegisterFunction(func)`: Deregisters a worker function. 
	* `func` to deregister.
* Function: `.unRegisterAll()`: Unregisters all worker functions. 
* Function: `.work([max_jobs])`: Starts working on all jobs. One way to stop working is to call `.unRegisterAll()`. 
	* `max_jobs` is the maximum number of jobs to work on. `Infinity` by default. 

* Event : `accepted(job)`: Occurs when a new job is accepted
	* `job` is an instance of `ClientGear.Worker.Job`
* Event: `pause()`: Occurs when there are no more jobs available on the server and this Worker goes into sleep. 
* Event: `resume()`: Occurs when this Worker resumes working after a sleep phase. 


## ClientGear.Worker.Job

Represents a job in worker mode. Created automatically whenever a job is accepted from a worker. 

* Constructor: `new ClientGear.Worker.Job(Worker, handle, func, uid, data)`: Creates a new object to represent a job on the server. 
	* `Worker` is the worker that is associated with this job. 
	* `handle` is the server assigned handle to the job. 
	* `func` is the function to perform
	* `uid` is a server assigned unique id
	* `data` is the data submitted along with the job

* Property: `.Worker`: A reference to the ClientGear.Worker associated with this Job. 
* Property: `.handle`: Server assigned handle to the job. 
* Property: `.uid`: Server assigned unique id to the job. 
* Property: `._func`: Name of function to perform
* Property: `._data`: Data send along the job. 

* Function: `.init()`: Initialises (starts) the job. Should not be called by hand. 
* Function: `.finish()`: Marks this job as finished. Should not be called by hand. 
* Function: `.fail()`: Marks this job as failed. 
* Function: `.complete(data)`: Marks the job as completed for the server. 
	* `data` to send along the completion. 
* Function: `.send(data)`: Passes data concerning the job to the server. 
	* `data` to send to the server
* Function: `.status(num, denum)`: Sends data concerning the job status to the server. 
	* `num` Status percentage numerator. 
	* `denum` Status percentage denumerator. 
* Function: `.warn(msg)`: Passes a warning to the server. 
	* `msg` to send to the server
* Function: `.exception(msg)`: Tells the server that the exception with the given message occured while processing this job. 
	* `msg` to give the server


## ClientGear.PrimitiveGear

Used internally only. Represents a primitive communication unit with the server. 

Also inherits all functions from EventEmitter. 

* Constructor: `new ClientGear.PrimitiveGear(socket)`: Creates a primitiveGear (communication) object. 
	* `socket` to use for communication with the server. 

* Property: `.socket` The cocket used for communication with the server. 
* Property: `.Transmitter` A ClientGear.Transmitter object used for transmitting packages. 
* Property: `.Receiver` A ClientGear.Receiver object used for receiving packages. 

* Function: `.send(method, args)`: Sends a package to the server. 
	* `method` Method name for the package. See ClientGear.Package. 
	* `args` arguments of the package to send. Either a string array of an array of byte arrays. 

* Event: `package(pack)` Occurs when a package is received from the server. 
	* `pack` is the `ClientGear.Package` that is received from the server. 
* Event: `package_out(pack)` Occurs when a package is send to the server. 
	* `pack` is the `ClientGear.Package` that is send to the server. 
* Events: $PACKAGE_TYPE(arg1, arg2, ...) Occurs when a package of the type $PACKAGE_TYPE is received. 
	* `arg1`, `arg2`, ... The arguments sent along with the package. 


## ClientGear.Transmitter

Used internally only. Represents a communication unit which can send packages to the server. 

* Constructor: `new ClientGear.Transmitter(socket)`: Creates a new Transmitter object. 
	* `socket` to use for transmittion of packages to the server. 

* Function: `.transmitPackage(method, args)`: Transmits a package to the server. 
	* `method` Method name for the package. See ClientGear.Package. 
	* `args` arguments of the package to send. Either a string array of an array of byte arrays. 

## ClientGear.Receiver

Used internally only. Represents a communication unit which can receive packages from the server. 

* Constructor: `new ClientGear.Receiver(socket, onPackage)`: Creates a new Receiver object. 
	* `socket` to use for receiving packages from the server. 
	* `function onPackage(pack)`: Called once a package is received from the server. 
		* `pack` is an instance of `ClientGear.Package` which represents the received package. 

* Function: `.onPackage(pack)`: Internal. Called whenever a package is received. 
	* `pack` is the package received. 
* Function: `.doReceive()`: Internal. Used to process incoming data from the server. 
* Function: `.requestBytes(num, callback)`: Internal. Requests bytes coming from the server. 
	* `num` Number of bytes to request from the server. 
	* `function callback(bytes)` Called once the bytes are received. 
		* `bytes` received from the server. 


## ClientGear.Package

Used internally only. Represents a package received or transmitted by the server. 

* Constructor: `new ClientGear.Package(req_or_res, method, args)`: Create a new Package object.  
	* `req_or_res` Either "req" or "res", depending on the type of the package. 
	* `method`: The method of the package. See `ClientGear.Package.packetTypes`. 
	* `args`: The arguments of the package. Either a string array or an array of byte arrays. 
* Constructor: `new ClientGear.Package(bytes, callback)`: Create a new Package object.  
	* `bytes` Array of bytes representing the package. 
	* `function callback(package)` Called once the package is decoded. Optional. 
		* `package`: A reference to the new package object. 
* Constructor: `new ClientGear.Package(byte_getter, callback)`: Create a new Package object.  
	* `function byte_getter(num, next)`: A function which gets a number of bytes and then passes it along. 
		* `num` is the number of bytes requested. 
		* `function next(bytes)` is the function which should by called. 
			* `bytes` array of exactly `num` bytes. 
	* `function callback(package)` Called once the package is decoded. Optional. 
		* `package`: A reference to the new package object. 

* Function: `.toString()`: returns a representation of the package as a string which is created directly from the byte representation. 
* Function: `.toByteArray()`: returns a representation of the package as a byte array. 
* Function: `.isRequest()`: returns if this is a request package. 
* Function: `.isResponse()`: returns if this is a response package. 
* Function: `.getPackageTypeString()`: Gets the type of this package as a string. See `ClientGear.Package.packetTypes`. 
* Function: `.getPackageTypeInt()`: Gets the type of this package as an integer. See `ClientGear.Package.packetTypes`. 
* Function: `.getArgs()`: Gets the arguments of this package as a stribng array. 

* Static Function: `ClientGear.Package.encode(req_or_res, package_type, args)`. Encodes a packge into its byte array. 
	* `req_or_res` of the package. Either "req" or "res". 
	* `package_type` Type of the package. See `ClientGear.Package.packetTypes`. 
	* `args` Arguments of the package either as a string or an array of byte arrays.
* Static Function: `ClientGear.Package.decode(byte_getter, callback)`. Decodes the binary representation of the package. 
	* `function byte_getter(num, next)`: A function which gets a number of bytes and then passes it along. 
		* `num` is the number of bytes requested. 
		* `function next(bytes)` is the function which should by called. 
			* `bytes` array of exactly `num` bytes. 
	* `function callback(package)` Called once decoding is complete. 
		* `package` An object representaing the package with the following properties: 
			* `reqres` Either "req" or "res", depending on package type. 
			* `package_type` An integer represening the package type. See `ClientGear.Package.packetTypes`. 
			* `args` Arguments of the package as a string array. 
* Static Function: `ClientGear.Package.intToBits(num)`. Turns a number into an array of bits representing into in binary form. 
	* `num` is the number to convert. 
* Static Function: `ClientGear.Package.intToBytes(num)`. Turns a package into a byte array representing its encoding. 
	* `num` is the number to convert. 
* Static Function: `ClientGear.Package.intToBEBytes(num)`. Turns a package into a byte array representing its big-endian encoding. 
	* `num` is the number to convert. 
* Static Function: `ClientGear.Package.StringToByteInt(str)`. Turns a string into one integer representing the string. 
	* `str` is the string to convert. 
* Static Function: `ClientGear.Package.BytesToInt(bytes)`. Turns a byte array into an integer. 
	* `bytes` is the byte array to convert. 
* Static Function: `ClientGear.Package.BEBytesToInt(bytes)`. Turns a big-endian encoded byte array into an integer. 
	* `bytes` is the byte array to convert. 
* Static Function: `ClientGear.Package.TypeStringToInt(str)`. Turns a package type string into an integer. 
	* `str` is the type to convert. See `ClientGear.Package.packetTypes`. 
* Static Function: `ClientGear.Package.IntToTypeString(num)`. Turns a package type integer a string. 
	* `num` is the type to convert. See `ClientGear.Package.packetTypes`. 

* Static Property: `ClientGear.Package.packetTypes`. Contains all available package types and their integer representations. 
	* CANT_DO
	* RESET_ABILITIES
	* PRE_SLEEP
	* NOOP
	* SUBMIT_JOB
	* JOB_CREATED
	* GRAB_JOB
	* NO_JOB
	* JOB_ASSIGN
	* WORK_STATUS
	* WORK_COMPLETE
	* WORK_FAIL
	* GET_STATUS
	* ECHO_REQ
	* ECHO_RES
	* SUBMIT_JOB_BG
	* ERROR
	* STATUS_RES
	* SUBMIT_JOB_HIGH
	* SET_CLIENT_ID
	* CAN_DO_TIMEOUT
	* ALL_YOURS
	* WORK_EXCEPTION
	* OPTION_REQ
	* OPTION_RES
	* WORK_DATA
	* WORK_WARNING
	* GRAB_JOB_UNIQ
	* JOB_ASSIGN_UNIQ
	* SUBMIT_JOB_HIGH_BG
	* SUBMIT_JOB_LOW
	* SUBMIT_JOB_LOW_BG
	* SUBMIT_JOB_SCHED
	* SUBMIT_JOB_EPOCH
* Static Property: `ClientGear.Package.JOBPriorities`. Contains all available job priorities. 
	* LOW
	* NORMAL
	* HIGH