var express = require('express');
var fs = require('fs');
var fsPath = require('path');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var app = express();
var http = require('http');
var httpProxy = require('http-proxy');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var server = http.Server(app);
//var io = require('socket.io')(server);
var chokidar		= require('chokidar');

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));


app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use("/static", express.static(__dirname + "/static"));

app.use(session({secret: 'dopkjqspc qsdoihjdezc udhp'}));

app.get('/', function (req, res) {
	// res.render('index.jade', {});
	res.redirect('/manager');
});
app.get('/login', function (req, res) {
	res.render('login.jade', {});
});
app.get('/too-much-attempts', function (req, res) {
	res.end('<b>too-much-attempts</b>');
});

var codes = new Array();
function genCode(){
	var code = "";
	for(var i=0; i<5; i++)
		code += parseInt(Math.random()*10)+'';
	codes.push(code);
	return code;
}

var attempts = 0;
var sms_sent = false;
app.post('/login', function (req, res) {
	if(attempts>3){
		setTimeout('attempts=0', 1000*60*60*12);
		res.redirect('/too-much-attempts');
	}else{
		if(req.param('password')=='abcd'){
			attempts = 0;
			req.session['logged-in'] = true;
		}else
			attempts++;

		res.redirect('/manager');
	}
});

app.get('/manager', function (req, res) {
	if(req.session['logged-in'])
		res.render('manager.jade', {});
	else
		res.redirect('/login');
});

var DEFAULT_PORT = 1234;


app.get('/get-all-redirects', function (req, res) {
	res.end(JSON.stringify(redirections));
});
app.get('/edit-redirect/:from/:to', function (req, res) {
	var from = req.params.from.split(':');
	if(!from[1])
		from[1] = DEFAULT_PORT;
	var to = req.params.to.split(':');
	if(!to[1])
		to[1] = DEFAULT_PORT;
	to[1] = parseInt(to[1]);
	from[1] = parseInt(from[1]);
	for(var i in redirections)
		if(redirections[i].from[0]==from[0] && redirections[i].from[1]==from[1])
			redirections.splice(i, 1);
	redirections.push({
		from: [from[0], from[1]],
		to: [to[0], to[1]]
	});
	makeSureGoodPortsListening();
	saveRedirections();
});
app.get('/delete-redirect/:from', function (req, res) {
	var from = req.params.from.split(':');
	if(!from[1])
		from[1] = DEFAULT_PORT;
	for(var i in redirections)
		if(redirections[i].from[0]==from[0] && redirections[i].from[1]==from[1])
			redirections.splice(i, 1);
	saveRedirections();
});
app.post('/update-redirects', function (req, res) {
	console.log('');
	console.log('Update !');
	var o = req.param('data');
	var toIP = req.headers.host.split(':')[0];
	var toPort = o.port;
	o.__IP = toIP;
	var i = redirections.length;
	while(i--){
		if(redirections[i].to[0]==toIP && redirections[i].to[1]==toPort)
			redirections.splice(i, 1);
	}
	for(var i in o.data){
		var parts = o.data[i].split(':');

		redirections.push({
			from:	[parts[0], parseInt(parts[1]) || DEFAULT_PORT],
			to:		['192.168.0.150', parseInt(o.port)]
		});
	}

	makeSureGoodPortsListening();
	saveRedirections();
	res.end("done");
});



app.post('/save-all', function (req, res) {
	var redir = JSON.parse(req.param('data'));
	
	while(redirections.length)
		redirections.pop();
	
	for(var i in redir){
		redirections.push({
			from:	[redir[i].from[0], parseInt(redir[i].from[1])],
			to:		[redir[i].to[0], parseInt(redir[i].to[1])]
		});
		console.log({
			from:	[redir[i].from[0], parseInt(redir[i].from[1])],
			to:		[redir[i].to[0], parseInt(redir[i].to[1])]
		});
	}

	makeSureGoodPortsListening();
	saveRedirections();
	res.end("done");
});

function saveRedirections(){
	fs.writeFileSync('config.json', JSON.stringify(redirections, null, 4));
};
function loadRedirections(){
	if(fs.existsSync('config.json'))
		redirections = JSON.parse(fs.readFileSync('config.json', 'utf8'));
};


var redirections = new Array();
loadRedirections();

var portListening = new Array();
function makeSureGoodPortsListening(){
	for(var i in redirections){
		if(portListening.indexOf(redirections[i].from[1])==-1){
			portListening.push(redirections[i].from[1]);
			createProxyForPort(redirections[i].from[1]);
		}
	}
}
makeSureGoodPortsListening();

function redirectPlease(req, res, givenPort, ws, head, funError){
	var p = req.headers.host.lastIndexOf(':');
	var domain, port;
	if(p==-1){
		domain = req.headers.host;
		port = 80;
	}else{
		domain = req.headers.host.substr(0, p);
		port = req.headers.host.substr(p+1);
	};
	if(port!=givenPort)	//Theorically impossible (but if someone change header or something...)
		return false;
	for(var i in redirections)
		if(redirections[i].from[1]==givenPort && redirections[i].from[0]==domain){
			if(!ws)
				proxy.web(req, res, { target: 'http://'+redirections[i].to.join(':') }, function(e){
					if(funError)
						funError("Oo");
				});
			else
				proxy.ws(req, res, head, { target: 'ws://'+redirections[i].to.join(':') }, function(e){
					if(funError)
						funError("Oo");
				});
			return [true];
		}
	funError("404");
};

var proxy = httpProxy.createProxyServer({ws: true});
var errorHTML = fs.readFileSync('views/error.html', 'utf8');

function createProxyForPort(port){
	var serverRP = http.createServer(function(req, res) {
		var r = redirectPlease(req, res, port, false, false, function(what){
			res.writeHeader(200, {"Content-Type": "text/html"});  
			res.end(errorHTML+' (url-requested : '+req.url+') '+what+'</body>');
		});
	});
	serverRP.on('upgrade', function (req, socket, head) {
		redirectPlease(req, socket, port, true, head);
	});
	console.log('createProxyForPort', port);
	serverRP.listen(port);
};


var sockets = new Array();

function emitToAllSockets(name, message){
	for(var i in sockets)
		if(sockets[i].emit)
			sockets[i].emit(name, message);
};

server.listen(5000);