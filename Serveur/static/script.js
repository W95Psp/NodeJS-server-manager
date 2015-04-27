var NodeManager = angular.module('NodeManager', []);

NodeManager.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
});

var SC;

NodeManager.controller('ctrl', function($scope){
	SC = $scope;

	$scope.types = ['','stdout', 'stderr', 'event'];

	$scope.allInstances = new Array();
	//$scope.selected;

	$scope.addRedirForInstance = function(instance, url){
		instance.conf.redirect.push(url || "nothing");
	};
	$scope.deleteRedirFromInstance = function(instance, k){
		instance.conf.redirect.splice(k, 1);
	};
	$scope.redirInstanceChanged = function(instance){
		socket.emit('load-instance-redirect', {path: instance.path, redirect: instance.conf.redirect});
	};

	$scope.launchAction = function(action, path){
		socket.emit(action, path);
	};

	$scope.safeApply = function() {
		var phase = $scope.$root.$$phase;
		if(!(phase == '$apply' || phase == '$digest'))
			this.$apply();
	};
	$scope.setPortOf = function(instance){
		socket.emit('set-port', {path: instance.path, port: instance.conf.port});
		$scope.launchAction('reload', instance.path);
	};

	var node_findByPath = function(path){
		for(var i in $scope.allInstances)
			if($scope.allInstances[i].path==path)
				return $scope.allInstances[i];
	};

	var socket = io();
	socket.on('node-instance', function(obj){
		$scope.allInstances.push(obj);

		if(typeof $scope.selected=='undefined')
			$scope.selected = obj;
		$scope.safeApply();

		(function(index){
			$scope.$watch('allInstances['+index+'].conf.redirect', function() {
				$scope.redirInstanceChanged($scope.allInstances[index]);
			}, true);
		})($scope.allInstances.length-1);
	});
	socket.on('log', function(obj){
		var path	= obj.path,
			content	= obj.content,
			when	= obj.when,
			type	= obj.type;
		var o = node_findByPath(path);
		if(typeof o=='undefined')
			return false;
		if(type=='event'){
			if(content.action=='run')
				o.running = true;
			else if(content.action=='stop')
				o.running = false;
		}
		o.processOut.push({content: content, when: when, type: type});
		$scope.safeApply();
	});
	socket.on('change-something', function(obj){
		var path	= obj.path,
			key		= obj.key,
			value	= obj.value;
		var o = node_findByPath(path);
		if(typeof o=='undefined')
			return false;
		o.conf[key] = value;
		$scope.safeApply();
	});
	socket.on('reset-processout', function(path){
		var o = node_findByPath(path);
		if(typeof o=='undefined')
			return false;
		while(o.processOut.length)
			o.processOut.pop();
		$scope.safeApply();
	});
	socket.on('load-instance-redirect', function(obj){
		var path = obj.path,
			redirect = obj.redirect;
		var o = node_findByPath(path);
		if(typeof o=='undefined')
			return false;
		o.conf.redirect = redirect;
		$scope.safeApply();
	});


	socket.on('disconnect', function () {
		$scope.connected = false;
		while($scope.allInstances.length)
			$scope.allInstances.pop();
		$scope.safeApply();
    });
	socket.on('connect', function () {
		console.log('HEY');
		$scope.connected = true;
		$scope.safeApply();
    });
});