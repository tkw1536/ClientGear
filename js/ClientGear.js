ClientGear = (function(){
	var self = function(){}; 


	/*
		a package representation
	*/
	self.Package = function(desc, method, args){
		if(arguments.length == 1 || arguments.length == 2){
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
				this.__packageReqRes = decoded.reqres; //string "req" or "res"
				this.__packageType = decoded.package_type; //int
				this.__args = decoded.args; //string args
				this.__bin = decoded //byte array

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
							decoded.args = argString.split("\0"); 
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

	return self;
})(); 