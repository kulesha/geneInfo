var myApp = angular.module('geneInfoApp', ['ngSanitize']);

myApp.controller('geneInfoCtrl', ['$scope', '$http', '$sce', function ($scope, $http, $sce) {
        $scope.formInfo = {gene: 'BRCA2'};
        $scope.geneInfo = {}; 
    
        $scope.findGene = function() {
            console.log($scope.formInfo);
            var url = 'http://rest.ensembl.org/lookup/symbol/homo_sapiens/'+$scope.formInfo.gene+'?content-type=application/json;expand=1';
            
            $http.get(url).success(function(data){
                //console.log(data);
                $scope.geneInfo = data;
                
                var surl = 'http://rest.ensembl.org/sequence/region/homo_sapiens/'+data.seq_region_name+':'+data.start+'..'+data.end+':1?content-type=application/json';

                $http.get(surl).success(function(seq){
                  //  console.log(seq);
                    var s = seq.seq.match(/.{1,120}/g);
                    // console.log(s);
                    $scope.geneInfo.sequence = seq;
                    $scope.geneInfo.segments = s;
                });
                
            });
            
        };
}]);
