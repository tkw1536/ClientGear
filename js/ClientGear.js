ClientGear = (function(){

	var self = {}

	/*
		Wrappers
	*/

	self.createWorker = function(url, name, callback, postponeInit){
		//create a worker connecting to websocket url.  
		var callback = (typeof callback == "function")?callback:function(){};
		var socket = new Websock();
		socket.on("open", function(){
			var worker = new self.Worker(socket, name, postponeInit); 
			callback(worker); 
		});
		socket.open(url); 
		return socket; 
	};

	self.createClient = function(url, callback, postponeInit){
		var callback = (typeof callback == "function")?callback:function(){};
		var socket = new Websock();
		socket.on("open", function(){
			var client = new self.Client(socket, postponeInit); 
			callback(client); 
		});
		socket.open(url); 
		return socket; 
	}


	/*
		primitiveGear
	*/
	self.primitiveGear = function(socket){
		var me = this; 

		self.EventEmitter.apply(this);

		this.socket = socket; //store the socket (Later: create object here)

		this.Transmitter = new self.Transmitter(socket); 
		this.Receiver = new self.Receiver(socket, function(pack){
			me.emit("package", [pack]); 
			me.emit(pack.getPackageTypeString(), pack.getArgs()); 
		}); 
	};

	self.primitiveGear.prototype.send = function(type, args){
		var pack = this.Transmitter.transmitPackage(type, args); 
		this.emit("package_out", [pack]); 
	}

	/*
		============
		Client
		============
	*/

	self.Client = function(socket, postponeInit){
		//Initalise primtive & EventEmitter
		this._primitive = new self.primitiveGear(socket);
		self.EventEmitter.call(this, false);

		if(postponeInit !== true){
			this.init();
		}
	}

	self.Client.prototype.init = function(){
		this.initCW(); 
	}

	self.Client.prototype.createJob = function(type, data, priority){
		return new self.Client.Job(this, type, data, priority); 
	}

	self.Client.prototype.setOption = function(option, callback){
		var callback = (typeof callback == "function")?callback:function(){};

		var me = this; 

		if(["exceptions"].indexOf(option) == -1){
			callback(false, "Unknown Option");  
		} else {
			var unregister = function(){
				me._primitive.off(on_error);
				me._primitive.off(on_ok); 
			}

			var on_error = me._primitive.on("ERROR", function(id, msg){
				unregister(); 
				callback(false, msg); 
			});

			var on_ok = me._primitive.on("OPTION_RES", function(){
				unregister(); 
				me.emit("set_option", option); 
				callback(true, option); 
			});

			me._primitive.send("OPTION_REQ", [option]); 
		}
	}

	/*
		=============
		Client Job
		(asked for a job)
		=============
	*/
	self.Client.Job = function(Client, type, data, priority){
		this.uid = false; 
		this._handlers = []; 
		this.submitted = false;
		this.finished = false; 

		if(!Client instanceof self.Client){
			throw new Error(); 
		}
		this.Client = Client; 

		this._type = type; 
		this._data = data; 
		this._priority = (typeof priority == "string")?priority:"NORMAL";

		this.init(); 
	}

	self.Client.Job.prototype.init = function(){
		
		var me = this; 
		var primitive = this.Client._primitive;

		me._handlers.push(primitive.on("WORK_DATA", function(uid, data){
			if(uid == me.uid){
				me.emit("data", [data]); 
			}
		})); 

		me._handlers.push(primitive.on("WORK_WARNING", function(uid, data){
			if(uid == me.uid){
				me.emit("warning", [data]); 
			}
		}));

		me._handlers.push(primitive.on("WORK_STATUS", function(uid, num, denum){
			if(uid == me.uid){
				me.emit("status", 
					self.Package.StringToByteInt(num), 
					self.Package.StringToByteInt(denum)); 
			}
		}));

		me._handlers.push(primitive.on("WORK_COMPLETE", function(uid, data){
			if(uid == me.uid){
				console.log(data); 
				me.emit("complete", [data]); 
			}
		}));

		me._handlers.push(primitive.on("WORK_EXCEPTION", function(uid, msg){
			if(uid == uid){
				me.emit("fail", [msg]); //Failed with message
			}
		}));

		me._handlers.push(primitive.on("WORK_FAIL", function(uid){
			if(uid == me.uid){
				me.emit("fail"); //Failed without message
			}
		}));

	}; 

	self.Client.Job.prototype.submit = function(callback){
		var me = this; 


		var type = this._type; 
		var data = this._data; 
		var priority = this._priority; 

		priority = self.Package.JOBPriorities[priority.toUpperCase()]; 

		if(typeof priority == "undefined"){
			return false; 
		}

		callback = (typeof callback == "function")?callback:function(){}; 

		me.on("finish", callback); 

		//submit with given priority
		if(this.submitted){
			return false; 
		} else {
			this.submitted = true; 


			me.Client._primitive.once("JOB_CREATED", function(uid){
				me.uid = uid; //store the uid
				me.emit("created", []); 
			})

			me.Client._primitive.send(priority, 
				[
					type, 
					"job:"
						+(Math.floor((Math.random()*100)+1)).toString()
						+":"
						+(new Date()).getTime().toString(), 
					data
				]
			)

			//register finish handlers
			var unregister = function(){
				me.off(on_finish); 
				me.off(on_fail); 
				me.abandon(); //remove all handlers
			}

			var on_finish = me.on("complete", function(data){
				unregister(); 
				me.emit("finish", [data, true]); 
			}); 

			var on_fail = me.on("fail", function(msg){
				unregister(); 
				me.emit("finish", [msg, false]); 
			}); 
		}
		return true; 
	};

	self.Client.Job.prototype.submitBackground = function(){
		var type = this._type; 
		var data = this._data; 
		var priority = this._priority; 

		priority = self.Package.JOBPriorities[priority.toUpperCase()]; 

		if(typeof priority == "undefined"){
			return false; 
		}

		callback = (typeof callback == "function")?callback:function(){}; 

		me.on("finish", callback)

		//submit with given priority
		if(this.submitted){
			return false; 
		} else {
			this.submitted = true; 


			me.Client._primitive.once("JOB_CREATED", function(uid){
				me.uid = uid; //store the uid
				me.abandon(); //forget the job 
			})

			me.Client._primitive.send(priority+"_BG", 
				[
					type, 
					"job:"
						+(Math.floor((Math.random()*100)+1)).toString()
						+":"
						+(new Date()).getTime().tpoString(), 
					data
				]
			)

		}
		return true; 
	};

	self.Client.Job.prototype.abandon = function(){
		//abondon the job, forget it. 
		//unregister event handlers
		var me = this; 

		this.finished = true; 
		this.submitted = true; 

		me._handlers.map(function(h){
			me.Client._primitive.off(h);
		});
	}



	/*
		get the status of a JOB. 
	*/
	self.Client.Job.prototype.getStatus = function(callback){
		//send a status

		var me = this; 

		var callback = (typeof callback == "function")?callback:function(){}; 

		var handle = this.Client._primitive.on("STATUS_RES", function(uid, knownStatus, runningStatus, completedNumerator, completedDeNumerator){
			if(uid === me.uid){
				me.Client._primitive.off(handle); 

				callback(
					self.Package.StringToByteInt(knownStatus) == 1, 
					self.Package.StringToByteInt(runningStatus) == 1, 
					self.Package.StringToByteInt(completedNumerator), //0 .. 255
					self.Package.StringToByteInt(completedDeNumerator)
				); 
			}
		});
	}

	/*
		============
		Worker
		============
	*/

	self.Worker = function(socket, name, postponeInit){
		//Initalise primtive & EventEmitter
		this._primitive = new self.primitiveGear(socket); 
		self.EventEmitter.call(this, false);  

		this._jobs = {};

		this._name = name; 

		if(postponeInit !== true){
			this.init();
		}
		 
	}

	self.Worker.prototype.init = function(){
		this.initCW(); 

		this.setName(this._name); //set this name
		this.max_jobs = 0; 
	}

	self.Worker.prototype.setName = function(name){
		this._primitive.send("SET_CLIENT_ID", name); 
		this._name = name; 
	}

	self.Worker.prototype.getName = function(){
		return this._name; 
	}

	self.Worker.prototype.canDo = function(func){
		return this._jobs.hasOwnProperty(func); 
	}

	self.Worker.prototype.registerFunction = function(func, handler, timeout){
		if(typeof timeout == "number" && timeout > 0){
			 
			this._primitive.send("CAN_DO_TIMEOUT", 
				[
					func, 
					self.Package.intToBEBytes(timeout)
				]
			);

		} else {
			this._primitive.send("CAN_DO", [func]);
		}
		this._jobs[func] = handler; 
	}

	self.Worker.prototype.deRegisterFunction = function(func){
		this._primitive.send("CANT_DO", [func]); 
	}

	self.Worker.prototype.unRegisterAll = function(func){
		this._primitive.send("RESET_ABILITIES", []); 
	}

	self.Worker.prototype.work = function(max_jobs){
		if(typeof max_jobs == "undefined"){
			var max_jobs = Infinity; 
		}
		this.jobs_left = max_jobs; 

		if(this.jobs_left == 0){
			//do not work!
			return; 
		}
		var me = this; 
		var no_job = this._primitive.once("NO_JOB", function(){
			me.emit("pause", []); 
			me._primitive.off(job_assign); 

			me._primitive.once("NOOP", function(){
				me.emit("resume", []); 
				me.work(me.jobs_left); 
			}); 

			me._primitive.send("PRE_SLEEP", []); 
		});
		var job_assign = this._primitive.once("JOB_ASSIGN_UNIQ", function(handle, func, uid, data){
			me._primitive.off(no_job); 
			
			var workjob = new self.Worker.Job(me, handle, func, uid, data); 
			me.emit("accepted", workjob); 
			workjob.init(); //initialise the work job
		}); 

		this._primitive.send("GRAB_JOB_UNIQ", []); //get a job
	}

	/*
		=============
		Worker Job
		(given from server)
		=============
	*/
	self.Worker.Job = function(Worker, handle, func, uid, data){
		this.Worker = Worker; 
		this.handle = handle; 
		this.uid = uid; 

		this._func = func; 
		this._data = data; 

		this.started = false; 
		this.finished = false; 
	}

	self.Worker.Job.prototype.init = function(){
		if(this.started){
			return; 
		}
		this.started = true; 

		var work_func = this.Worker._jobs[this._func]; 

		try{
			work_func.apply(this.Worker, [this._data, this]); 
		} catch(e){
			this.exception(e.message); //We have failed
		}
	}

	self.Worker.Job.prototype.finish = function(){
		if(this.finished){
			return; 
		}
		this.finished = true;  
		this.Worker.jobs_left--; 
		this.Worker.work(this.Worker.jobs_left); 
	}

	self.Worker.Job.prototype.fail = function(){
		this.Worker._primitive.send("WORK_FAIL", [this.handle]); 
		this.finish(); 
	}

	self.Worker.Job.prototype.exception = function(msg){
		this.Worker._primitive.send("WORK_EXCEPTION", [this.handle, msg]); 
		this.finish(); 
	}

	self.Worker.Job.prototype.warn = function(msg){
		this.Worker._primitive.send("WORK_WARNING", [this.handle, msg]); 
	}

	self.Worker.Job.prototype.send = function(data){
		this.Worker._primitive.send("WORK_DATA", [this.handle, data]); 
	}

	self.Worker.Job.prototype.status = function(num, denum){
		this.Worker._primitive.send("WORK_STATUS", [this.handle, 
			self.Package.intToBEBytes(num), 
			self.Package.intToBEBytes(denum)
		]); 
	}

	self.Worker.Job.prototype.complete = function(data){
		this.Worker._primitive.send("WORK_COMPLETE", [this.handle, data]); 
		this.finish(); 
	}


	/*
		============
		Shared Client / Worker Code
		============
	*/

	/*
		Shared Initialisation
	*/
	self.Client.prototype.initCW = self.Worker.prototype.initCW = function(){
		var me = this; 

		this._primitive.on("ECHO_RES", function(payload){
			me.emit("echo", [payload]); 
		}); 

		this._primitive.on("ERROR", function(code, string){
			me.emit("error", [code, string]); 
		}); 
	}

	/*
		Sends an echo package. 
	*/
	self.Client.prototype.echo = self.Worker.prototype.echo = function(payload, callback){
		var callback = (typeof callback == "function")?callback:function(){}; 

		this.once("echo", function(pl){
			callback.call(this, pl == payload); //echk if it suceeded and echoed the payload
		}); 

		this._primitive.send("ECHO_REQ", [payload]); //send the echo request
	}


	/*
		=============
		EVENT EMITTER
		=============
	*/
	self.EventEmitter = function(error_evt){
		this._handlers = {}; //handler
		this._counter = 0; //id counter. 
		this._emitErrors = (typeof error_evt == "boolean")?error_evt:false; 
	}

	self.EventEmitter.prototype.on = function(evt, handler){
		var count = this._counter++; 
		this._handlers[evt] = this._handlers[evt] || []; 
		this._handlers[evt].push([count, handler]); 
		return count; 
	}

	self.EventEmitter.prototype.once = function(evt, handler){
		var me = this; 

		var handle = this.on(evt, function(){
			me.off(handle); 
			try{
				handler.apply(this, arguments); 
			} catch(e){
				if(evt != "error" && me._emitErrors){
					me.emit("error", [e, evt, handler]); 
				}
			}
		});

		return handle; 
	}

	self.EventEmitter.prototype.emit = function(evt, args){
		var me = this; 

		return (me._handlers[evt] || []).map(function(h){
			try{
				h[1].apply(me, args); 
			} catch(e){
				if(evt != "error" && me._emitErrors){
					me.emit("error", [e, evt, h]); 
				}
			}
		}); 
	}

	self.EventEmitter.prototype.off = function(id){
		if(typeof id == "string"){
			try{
				delete this._handlers[id]; 
			} catch(e){}
		} else {
			for(var key in this._handlers){
				this._handlers[key] = this._handlers[key].filter(function(e){
					return (e.indexOf(id) == -1); 
				})
			}
		}
	}

	/*
		=============
		Transmitter
		=============
	*/
	self.Transmitter = function(socket){
		this.socket = socket; 
	}

	self.Transmitter.prototype.transmitPackage = function(method, args){
		var pack = new self.Package("req", method, args); //send a request
		this.socket.send(pack.toByteArray()); //send the package
		return pack; 
	}

	/*
		=============
		Receiver
		=============
	*/
	self.Receiver = function(socket, onPackage){
		var me = this; 

		this.socket = socket; 	
		this.socket.on("message", function(){
			me.doReceive();	
		})
		this.onPackage = onPackage; //what to do when we get a package
		this.requests = []; 
		this.cache = []; 
		this.receiving = false; 
		this.packaging = false; 
	}

	self.Receiver.prototype.doReceive = function(){
		var me = this; 

		if(this.receiving){
			return; 
		}

		this.receiving = true; 

		//add bytes to the cache
		while(this.socket.rQlen() != 0){
			this.cache.push(this.socket.rQshift8()); 
		}

		

		//preocess requests
		while(this.requests.length > 0){
			if(this.cache.length >= this.requests[0][0]){
				var req = this.requests.pop(); 
				req[1].call(this, this.cache.splice(0, req[0]))
			} else {
				break; 
			}
		}

		

		//we will add new packages now if they are long enough
		
		if(this.cache.length>=12){ //package header received
			if(!this.packaging){
				this.packaging = true; 
				var pack = new self.Package(function(b, next){
					me.requestBytes(b, next); 
				}, function(){
					me.onPackage(pack); //package is done
					me.packaging = false; 
				})
			}
			
		}

		this.receiving = false; //stop receiving

		if(this.requests.length > 0){
			//we have more stuff to do
			setTimeout(function(){
				me.doReceive(); 
			}, 100); 
		}

	}


	self.Receiver.prototype.requestBytes = function(num, callback){
		//request i bytes from the callback
		//call callback with bytes once done
		this.requests.push([num, callback]); 
		this.doReceive(); //receive if you are not yet doing stuff
	}

	/*
		=============
		Package
		=============
	*/


	/*
		a package, a package representation. 
	*/
	self.Package = function(desc, method, args){
		if(arguments.length == 1 || arguments.length == 2){
			var me = this; 

			if(typeof desc == "string"){
				//make desc a bin array
				var oldDesc = desc; 
				desc = []; 
				for(var i=0;i<oldDesc.length;i++){
					desc.push(oldDesc.charCodeAt(i)); //we encode it here
				}
			}

			if(typeof desc != "function"){
				var oldRes = desc.slice(0); 

				res = function(i, next){ //res is a function which 
					next(desc.splice(0, i)); 
				}
			}

			self.Package.decode(desc, function(decoded){
				me.__packageReqRes = decoded.reqres; //string "req" or "res"
				me.__packageType = decoded.package_type; //int
				me.__args = decoded.args; //string args
				me.__bin = decoded; //byte array

				if(typeof method == "function"){
					method.call(this, this); 
				}
			}); //decode the byte array

			
		} else {
			this.__bin = self.Package.encode(desc, method, args); //byte array
			this.__packageReqRes = desc; //string "req" or "res"
			this.__packageType = (typeof method == "string")?self.Package.TypeStringToInt(method):method;  //string args
			this.__args = args; //byte array
		}
	}

	self.Package.prototype.toString = function(){
		return String.fromCharCode.apply(String, this.__bin); 
	}

	self.Package.prototype.toByteArray = function(){
		return this.__bin.slice(0); 
	}

	self.Package.prototype.isRequest = function(){
		return (this.__packageReqRes == "req"); 
	}

	self.Package.prototype.isResponse = function(){
		return !this.isRequest(); 
	}

	self.Package.prototype.getPackageTypeString = function(){
		return self.Package.IntToTypeString(this.__packageType);
	}

	self.Package.prototype.getPackageTypeInt = function(){
		return this.__packageType;
	}

	self.Package.prototype.getArgs = function(){
		return this.__args.slice(0);
	}

	/*
		Decodes a message from a string. 
	*/
	self.Package.decode = function(bytes, cb){
		//decode a package
		var decoded = {
			"reqres": undefined, // "req" or "res"
			"package_type": NaN, //Int
			"args": [] //String Array 
		}

		bytes(4, function(MAGIC){
			var MAGIC = String.fromCharCode.apply(String, MAGIC)

			if(MAGIC == "\0REQ"){
				decoded.reqres = "req"; 
			} else if(MAGIC == "\0RES"){
				decoded.reqres = "res"; 
			} else {
				cb(false); 
			}

			bytes(4, function(PACK_TYPE){
				decoded.package_type = self.Package.BEBytesToInt(PACK_TYPE); //Get Package Type
				bytes(4, function(PACK_LENGTH){
					var res_length = self.Package.BEBytesToInt(PACK_LENGTH); //get the remaining length; 
					bytes(res_length, function(ARGS_BYTES){ //lets get the bytes
						var argString = String.fromCharCode.apply(String, ARGS_BYTES); 
						if(res_length != 0){
							decoded.args = argString.split("\0").slice(0); 
						}
						cb(decoded); 
					});
				}); 


			})

		})


		
	}


	/*
		Encodes a package into a byte array (can be encoded into a string)
	*/
	self.Package.encode = function(type, package_type, args){
		var Package = (type.toLowerCase() == "req")?[0, 82, 69, 81]:[0, 82, 69, 83]; 

		var package_type = self.Package.intToBEBytes((typeof package_type == "string")?self.Package.TypeStringToInt(package_type):package_type); 

		var arg_bin = []; 

		for(var i=0;i<args.length;i++){
			for(var j=0;j<args[i].length;j++){
				if(typeof args[i] == "string"){
					arg_bin.push(args[i].charCodeAt(j));
				} else {
					arg_bin.push(args[i][j]); 
				}
				
			}

			arg_bin.push(0); 
		}

		if(args.length != 0){
			arg_bin.pop(); //remove the last 0
		}

		var args_length = self.Package.intToBEBytes(arg_bin.length); 

		//now put it all together

		for(var i=0;i<4;i++){
			Package.push(package_type[i]); 
		}

		for(var i=0;i<4;i++){
			Package.push(args_length[i]); 
		}

		for(var i=0;i<arg_bin.length;i++){
			Package.push(arg_bin[i]); 
		}

		return Package; 

	}

	self.Package.intToBits = function(num){
		var res = new Array(32); 
		for(var i=0;i<32;i++){
			//32 bits integer
			res[i] = (((1 << i) & num) != 0); 
		}
		return res; 
	}

	self.Package.intToBEBytes = function(num){
		var bits = self.Package.intToBits(num); 
		var bytes = new Array(4); 
		for(var j=0;j<4;j++){
			bytes[3-j] = 0
			for(var i=0;i<8;i++){
				if(bits[8*j+i]){
					bytes[3-j] += (1 << i); 
				}
			}
		}

		return bytes; 
	}

	self.Package.StringToByteArray = function(str){
		var res=[]; 

		for(var i=0;i<str.length;i++){
			res.push(str.charCodeAt(i)); 
		}

		return res; 
	}

	

	self.Package.StringToByteInt = function(str){
		var res=0; 

		for(var i=0;i<str.length;i++){
			res += str.charCodeAt(i) * (1 << i); 
		}

		return res; 
	}

	self.Package.intToBytes = function(num){
		var bits = self.Package.intToBits(num); 
		var bytes = new Array(4); 
		for(var j=0;j<4;j++){
			bytes[j] = 0
			for(var i=0;i<8;i++){
				if(bits[8*j+i]){
					bytes[j] += (1 << i); 
				}
			}
		}

		return bytes; 
	}

	self.Package.BytesToInt = function(Bytes){
		var res = 0; 

		for(var j=0;j<4;j++){
			res += Bytes[j] * (1 << (8*j)); 
		}

		return res; 

	}; 

	self.Package.BEBytesToInt = function(Bytes){
		return self.Package.BytesToInt(Bytes.reverse()); 
	};


	//static package memebers

	self.Package.packetTypes = {
	    "CAN_DO": 1,
	    "CANT_DO": 2,
	    "RESET_ABILITIES": 3,
	    "PRE_SLEEP": 4,
	    "NOOP": 6,
	    "SUBMIT_JOB": 7,
	    "JOB_CREATED": 8,
	    "GRAB_JOB": 9,
	    "NO_JOB": 10,
	    "JOB_ASSIGN": 11,
	    "WORK_STATUS": 12,
	    "WORK_COMPLETE": 13,
	    "WORK_FAIL": 14,
	    "GET_STATUS": 15,
	    "ECHO_REQ": 16,
	    "ECHO_RES": 17,
	    "SUBMIT_JOB_BG": 18,
	    "ERROR": 19,
	    "STATUS_RES": 20,
	    "SUBMIT_JOB_HIGH": 21,
	    "SET_CLIENT_ID": 22,
	    "CAN_DO_TIMEOUT": 23,
	    "ALL_YOURS": 24,
	    "WORK_EXCEPTION": 25,
	    "OPTION_REQ": 26,
	    "OPTION_RES": 27,
	    "WORK_DATA": 28,
	    "WORK_WARNING": 29,
	    "GRAB_JOB_UNIQ": 30,
	    "JOB_ASSIGN_UNIQ": 31,
	    "SUBMIT_JOB_HIGH_BG": 32,
	    "SUBMIT_JOB_LOW": 33,
	    "SUBMIT_JOB_LOW_BG": 34,
	    "SUBMIT_JOB_SCHED": 35,
	    "SUBMIT_JOB_EPOCH": 36
	};

	self.Package.JOBPriorities = {
		"NORMAL": "SUBMIT_JOB", 
		"HIGH": "SUBMIT_JOB_HIGH",
		"LOW": "SUBMIT_JOB_LOW"
	};

	/*
		Converts a Package type string into an integer. 
	*/
	self.Package.TypeStringToInt = function(str){
		return self.Package.packetTypes[str.toUpperCase()] || NaN; 
	}

	/*
		Converts an Integer representing a package type into a string. 
	*/
	self.Package.IntToTypeString = function(intVal){
		for(var key in self.Package.packetTypes){
			if(self.Package.packetTypes[key] == intVal){
				return key; 
			}
		}
		return ""; 
	}


	/*
		Inheritance
	*/
	self.Client.Job.prototype.on = self.Client.prototype.on = self.Worker.prototype.on = self.primitiveGear.prototype.on = self.EventEmitter.prototype.on; 
	self.Client.Job.prototype.once = self.Client.prototype.once = self.Worker.prototype.once = self.primitiveGear.prototype.once = self.EventEmitter.prototype.once; 
	self.Client.Job.prototype.off = self.Client.prototype.off = self.Worker.prototype.off = self.primitiveGear.prototype.off = self.EventEmitter.prototype.off; 
	self.Client.Job.prototype.emit = self.Client.prototype.emit = self.Worker.prototype.emit = self.primitiveGear.prototype.emit = self.EventEmitter.prototype.emit; 

	return self;
})(); 