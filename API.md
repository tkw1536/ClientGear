# API

This file documents the basic API. It does not include parameters only used for debugging. It is not yet complete. 

Note that you do not have to use any constructors (`new`` keyword), they are all created for you. 

* `ClientGear`: Namespace. 
	* `ClientGear.createWorker(url, name, callback)`: Creates a worker
		* `url` to connect to (via websockify)
		* `name` of the worker. Has to be unique
		* `function callback(worker)` Callback once the worker is ready
			* `worker`, an instance of `ClientGear.Worker`
	* `ClientGear.createClient(url, callback)`: Creates a client
		* `url` to connect to (via websockify)
		* `function callback(client)` Callback once the worker is ready
			* `client`, an instance of `ClientGear.Client`

	* Class: `ClientGear.Client` Represents a Client
		* `.createJob(type, data, priority)`: Creates a job
			* `type` contains the function name to perform
			* `data` to pass as argument to the worker
			* `priority` for the job. Optionally one of "LOW", "NORMAL" or "HIGH".  
			* returns an instance of `ClientGear.Client.Job`

		* `.setOption(option, callback)`: Sets an option. 
			* `option` to set. Right now, only "exceptions"
			* `function callback(success, option_or_msg)` Callback
				* `success`
				* `option_or_msg` contains the option name if successfull or a message