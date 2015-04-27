var express = require('express');
//var clone = require('clone');
var fs = require('fs');
var fsPath = require('path');
var spawn = require('child_process').spawn;
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var chokidar		= require('chokidar');
var request = require('request');


function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use("/static", express.static(__dirname + "/static"));

server.listen(8080);

var tookPorts = new Array();
function getNewPort(){
	for(var i=2000; i<65000; i++)
		if(tookPorts.indexOf(i)==-1){
			tookPorts.push(i);
			return i;
		}
	return -1;
};

var defaultConfKeys = {
	port: 8010,
	redirect: ['test.franceschino.fr', 'rien.websimp.fr'],
	reloadOnChange: true,
	mainFile: 'main.js',
	enabled: false
};

var NodeInstance = function(path, name){
	this.name = name;
	this.processOut = new Array();
	//console.log('#####path', path);
	this.path = fsPath.resolve(path);
	this.configPath = fsPath.join(path, 'config.json');
	this.loadConfigFile();
	allInstances.push(this);
	this.init();
};
NodeInstance.prototype.dataForEmitLog = function(content, type, when){
	return {
		path: this.path,
		content: content,
		when: when,
		type: type
	};
};
NodeInstance.prototype.log = function(content, type){
	//console.log(this.path, {content: content, when: d, type: type})
	var d = Date.now();
	emitToAllSockets('log', this.dataForEmitLog(content, type, d));
	this.processOut.push({content: content, when: d, type: type});
};
NodeInstance.prototype.saveConfigFile = function(){
	fs.writeFileSync(this.configPath, JSON.stringify(this.conf));
};
NodeInstance.prototype.init = function(){
	if(this.conf.reloadOnChange)
		this.watchForChange();
	if(this.conf.enabled)
		this.run();
};
NodeInstance.prototype.reload = function(fromUser){
	this.log({action: 'reload', fromUser: fromUser}, 'event')
	this.stop();
	this.runDelay();
};
NodeInstance.prototype.runDelay = function(delay){
	if(!delay)
		delay = 600;
	var This = this;
	setTimeout(function(){
		This.run();
	}, delay);
};
NodeInstance.prototype.stop = function(fromUser){
	if(this.running){
		this.preventRebootAuto = true;
		this.log({action: 'stop', fromUser: fromUser}, 'event');
		this.running = false;
		this.process.kill('SIGINT');
	}
};
NodeInstance.prototype.run = function(fromUser){
	if(!this.conf.enabled || this.running)
		return 0;

	this.log({action: 'run', fromUser: fromUser}, 'event');
	
	this.running = true;

	var env = {};
	env.portToUse = this.conf.port;

	this.process = spawn(process.execPath, [this.conf.mainFile], {
		cwd: this.path,
		env: env
	});
	var This = this;
	
	this.process.stdout.on('data', function (data) {
		//console.log('Run :: ', data.toString());
		This.log(data.toString(), 'stdout');
	});
	
	this.process.stderr.on('data', function (data) {
		//console.log('Err :: ', data.toString());
		This.log(data.toString(), 'stderr');
	});
	
	this.process.on('close', (function(This){
		return function (code) {
			This.log({action: 'close', fromUser: false}, 'event');
			This.running = false;
			if(This.preventRebootAuto)
				return This.preventRebootAuto=false;
			setTimeout(function(){
				This.run();
			}, 600);
		};
	})(this));
};
NodeInstance.prototype.loadConfigFile = function(){
	if(!fs.existsSync(this.configPath)){
		this.conf = clone(defaultConfKeys);
		this.conf.port = getNewPort();
		this.saveConfigFile();
	}
	this.conf = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
};
NodeInstance.prototype.webSocketSendMyself = function(socket){
	var o = {
		conf: this.conf,
		name: this.name,
		processOut: new Array(),
		configPath: this.configPath,
		path: this.path
	};
	delete o['process'];
	socket.emit('node-instance', o);
	for(var i in this.processOut)
		socket.emit('log', this.dataForEmitLog(this.processOut[i].content, this.processOut[i].type, this.processOut[i].when));
};
NodeInstance.prototype.watchForChange = function(){
	this.watcher = chokidar.watch(this.path, {ignored: /[\/\\]\./, persistent: true});
	var This = this;
	var Event = function(path) {
		if(path.substr(-3)!='.js')
			return 0;
		if(This.conf.reloadOnChange)
			This.reload();
	};
	this.watcher
		.on('change', Event)
		.on('unlink', Event)
		.on('error', Event);
};
NodeInstance.findByPath = function(path){
	for(var i in allInstances)
		if(allInstances[i].path==path)
			return allInstances[i];
};

var allInstances = new Array();

fs.readdirSync('./www/').forEach(function(path){
	if(path!='..' && path!='.'){
		new NodeInstance('./www/'+path, path);
	}
});

app.get('/', function (req, res) {
	res.render('index.jade', {});
});



var sockets = new Array();

function emitToAllSockets(name, message){
	for(var i in sockets)
		if(sockets[i].emit)
			sockets[i].emit(name, message);
};

io.on('connection', function (socket) {
	//console.log('Connxion!!');
	socket.emit('connect');
	var SocketID = sockets.push(socket)-1;

	for(var i in allInstances){
		allInstances[i].webSocketSendMyself(socket);
	};
	
	socket.on('stop', function (path) {
		var o = NodeInstance.findByPath(path);
		if(typeof o=='undefined')
			return false;
		o.stop(true);
	});
	socket.on('run', function (path) {
		var o = NodeInstance.findByPath(path);
		if(typeof o=='undefined')
			return false;
		o.run(true);
	});
	socket.on('reload', function (path) {
		var o = NodeInstance.findByPath(path);
		if(typeof o=='undefined')
			return false;
		o.reload(true);
	});
	socket.on('reset-log', function (path) {
		var o = NodeInstance.findByPath(path);
		if(typeof o=='undefined')
			return false;
		while(o.processOut.length)
			o.processOut.pop();
		emitToAllSockets('reset-processout', path);
	});
	socket.on('set-port', function (obj) {
		var path = obj.path,
			port = obj.port;
		var o = NodeInstance.findByPath(path);
		if(typeof o=='undefined')
			return false;
		o.conf.port = port;
		o.saveConfigFile();
		emitToAllSockets('change-something', {
			path: path,
			key: 'port',
			value: port
		});
	});
	socket.on('reload-on-change', function (path) {
		var o = NodeInstance.findByPath(path);
		if(typeof o=='undefined')
			return false;
		if(!o.conf.reloadOnChange){
			o.conf.reloadOnChange = true;
			emitToAllSockets('change-something', {
				path: path,
				key: 'reloadOnChange',
				value: true
			});
		}
	});
	socket.on('do-not-reload-on-change', function (path) {
		var o = NodeInstance.findByPath(path);
		if(typeof o=='undefined')
			return false;
		o.saveConfigFile();
		if(o.conf.reloadOnChange){
			o.conf.reloadOnChange = false;
			emitToAllSockets('change-something', {
				path: path,
				key: 'reloadOnChange',
				value: false
			});
		}
	});
	socket.on('load-instance-redirect', function (obj) {
		var path = obj.path,
			redirect = obj.redirect;
		var o = NodeInstance.findByPath(path);
		if(typeof o=='undefined')
			return false;
		o.conf.redirect = redirect;
		o.saveConfigFile();
		request.post({
				url :'http://192.168.0.150:5000/update-redirects',
				form: {
					data: {
						port: o.conf.port,
						data: o.conf.redirect
					}
				}
			},
			function(a,b,c){
			}
		);
	});
	
	socket.on('disconnect', function () {
		delete socket[SocketID];
	});
});
