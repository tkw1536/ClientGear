ClientGear = (function(){

	var self = {}


	/*
		PrimitiveReceiver
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

	self.primitiveGear.send = function(type, args){
		this.Transmitter.transmitPackage(type, args); 
	}

	/*
		============
		Client
		============
	*/

	self.Client = function(socket){
		//Initalise primtive & EventEmitter
		this._primitive = new self.primitiveGear(socket);
		self.EventEmitter.call(this, false);

		this.init(); 
	}

	self.Client.prototype.init = function(){
		//TODO: Listen for primitive packages
		this.initCW(); 
	}

	self.Client.prototype.setOption = function(option, callback){

	}

	/*
		============
		Worker
		============
	*/

	self.Worker = function(socket){
		//Initalise primtive & EventEmitter
		this._primitive = new self.primitiveGear(socket); 
		self.EventEmitter.call(this, false);  

		this.__jobs = {}; 

		this.init(); 
	}

	self.Worker.prototype.init = function(){

		this.initCW(); 
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
		Client Job
		(asked for a job)
		=============
	*/
	self.Client.Job = function(Client){
		this.uid = false; 

		if(!Client instanceof self.Client){
			throw new Error()
		}
		this.Client = Client; 
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
		})
	}

	self.EventEmitter.prototype.emit = function(evt, args){
		var me = this; 

		(me._handlers[evt] || []).map(function(h){
			try{
				h[1].apply(me, args); 
			} catch(e){
				console.log(e.message); 
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

		console.log(Package); 

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

	var packetTypes = {
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

	/*
		Converts a Package type string into an integer. 
	*/
	self.Package.TypeStringToInt = function(str){
		return packetTypes[str.toUpperCase()] || NaN; 
	}

	/*
		Converts an Integer representing a package type into a string. 
	*/
	self.Package.IntToTypeString = function(intVal){
		for(var key in packetTypes){
			if(packetTypes[key] == intVal){
				return key; 
			}
		}
		return ""; 
	}


	/*
		Inheritance
	*/
	self.Client.prototype.on = self.Worker.prototype.on = self.primitiveGear.prototype.on = self.EventEmitter.prototype.on; 
	self.Client.prototype.once = self.Worker.prototype.once = self.primitiveGear.prototype.once = self.EventEmitter.prototype.once; 
	self.Client.prototype.off = self.Worker.prototype.off = self.primitiveGear.prototype.off = self.EventEmitter.prototype.off; 
	self.Client.prototype.emit = self.Worker.prototype.emit = self.primitiveGear.prototype.emit = self.EventEmitter.prototype.emit; 

	return self;
})(); 