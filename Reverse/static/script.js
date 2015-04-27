var NodeManager = angular.module('NodeManager', ['ui.sortable']);

NodeManager.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
});

var SC;

function getXMLHttpRequest() {
    var xhr = null;
     
    if (window.XMLHttpRequest || window.ActiveXObject) {
        if (window.ActiveXObject) {
            try {
                xhr = new ActiveXObject("Msxml2.XMLHTTP");
            } catch(e) {
                xhr = new ActiveXObject("Microsoft.XMLHTTP");
            }
        } else {
            xhr = new XMLHttpRequest();
        }
    } else {
        alert("Votre navigateur ne supporte pas l'objet XMLHTTPRequest...");
        return null;
    }
     
    return xhr;
}

function getDataFrom(url, fun){
	var xhr = getXMLHttpRequest();

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 0)) {
			fun(JSON.parse(xhr.responseText));
		}
	};

	xhr.open("GET", url, true);
	xhr.send(null);
}

NodeManager.controller('ctrl', function($scope, $http){
	SC = $scope;
	$scope.saved = true;

	var temp

	$scope.dragControlListeners = {
	    accept: function () {return true;},
	    itemMoved: function (event) {},
	    orderChanged: function(event) {}
	};

	$scope.safeApply = function() {
		var phase = $scope.$root.$$phase;
		if(!(phase == '$apply' || phase == '$digest'))
			this.$apply();
	};

	// $scope.delete = function(redirect){
	// 	getDataFrom('/delete-redirect/'+redirect.from.join(':'), function(){
			
	// 	});
	// };

	// $scope.edit = function(redirect){
	// 	getDataFrom('/edit-redirect/'+redirect.from.join(':')+'/'+redirect.to.join(':'), function(){
			
	// 	});
	// };
	$scope.save = function(){
		var redir = new Array();
		for(var i in $scope.redirections)
			redir.push({from: $scope.redirections[i].from, to: $scope.redirections[i].to});
		$http.post('/save-all', {data: JSON.stringify(redir)}).success(function(){
			$scope.saved = true;
		});
	};
	$scope.add = function(){
		$scope.redirections.push({from: ['', 1234], to: ['', 1234]});
		makeRedirectionActive($scope.redirections.length-1);
	};

	function makeRedirectionActive(i){
		$scope.redirections[i].buffers = {
			from:	$scope.redirections[i].from.join(':'),
			to:		$scope.redirections[i].to.join(':')
		};
		(function(index){
			$scope.$watch("redirections["+index+"].buffers", function(newValue, oldValue){
				if(newValue==oldValue)
					return;
				var b = $scope.redirections[i].buffers;
				$scope.redirections[index].from = b.from.split(':', 2);
				$scope.redirections[index].to = b.to.split(':', 2);
				$scope.saved = false;
				console.log('trigger');
			}, true);
		})(i);
	}

	$scope.redirections = new Array();
	getDataFrom('/get-all-redirects', function(r){
		$scope.redirections = r;
		for(var i in $scope.redirections){
			makeRedirectionActive(i);
		}
		$scope.safeApply();
	});
});