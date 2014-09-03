// function to add C character Len times
function repeat(c, len) {   
    for (var e = ''; e.length < len;)
        e += c;
    return e;
}

// Define the app, ngSanitize is needed to enable passing plain html into ng-repeat
var myApp = angular.module('geneInfoApp', ['ngSanitize']);

// main controller - it accepts the input gene name and fetches the gene info
myApp.controller('geneInfoCtrl', ['$scope', '$http', '$sce', function ($scope, $http, $sce) {
    // by default we'll look for BRCA2
    $scope.formInfo = {gene: 'BRCA2'};
    
    // the rest api call will fill this object
    $scope.geneInfo = {}; 
    
    var self = this;
    
    self.trustedHtml = $sce.trustAsHtml(this.textContent);
    
    // function that will be called on form submit
    this.findGene = function() {
        // first we look for the gene
        var url = 'http://rest.ensembl.org/lookup/symbol/homo_sapiens/' + $scope.formInfo.gene
                + '?content-type=application/json;expand=1';
            
        $http.get(url).success(function(data){
            // hooray - we have found the gene
            $scope.geneInfo = data;
            
            // now let's get the sequence
            var surl = 'http://rest.ensembl.org/sequence/region/homo_sapiens/' + data.seq_region_name + ':' + data.start + '..' + data.end + ':1?content-type=application/json';

            $http.get(surl).success(function(seq){
                var s = seq.seq.match(/.{1,120}/g);
                $scope.geneInfo.sequence = seq;
                $scope.geneInfo.segments = s;
                
                // don't do it for now - as there are problems fetching sequence
                // by default select the first transcript
                // $scope.currentTab = data.Transcript[0].id;
            });
                
        });            
    };
}]);


myApp.controller('TabController', ['$scope', '$http', function($scope, $http){    
    this.currentTab = '-';
    
    this.setTab = function(newValue){
        this.currentTab = newValue;
        
        // find the selected transcript
        var t;            
        for(var i in $scope.geneInfo.Transcript) {
            if ($scope.geneInfo.Transcript[i].id === newValue) {
                t = $scope.geneInfo.Transcript[i];
            }
        }
            
        
        // reset the binned sequence
        var s = $scope.geneInfo.sequence.seq.match(/.{1,120}/g);
        $scope.geneInfo.segments = s;
        $scope.geneInfo.psegments = s;

        var exonStart = '<span class="exon">';
        var exonEnd = '</span>';
            
        for(var i in t.Exon) {
            var s = t.Exon[i].start - $scope.geneInfo.start;
            var e = t.Exon[i].end - $scope.geneInfo.start + 1;
                
            var sbin = Math.floor(s / 120);
            var spos = s % 120;
            var ebin = Math.floor(e / 120);
            var epos = e % 120;
            
            //console.log(s + '['+sbin+':'+spos+']'+' .. ' + e+ '['+ebin+':'+epos+']');
            var segments = $scope.geneInfo.segments;
            var tmp = segments[sbin];
            var str = tmp.substr(0, spos) + exonStart + tmp.substr(spos);
            $scope.geneInfo.segments[sbin] = str;
            while (sbin < ebin) {
                $scope.geneInfo.segments[sbin] = $scope.geneInfo.segments[sbin] + exonEnd;
                sbin++;
                $scope.geneInfo.segments[sbin] = exonStart + $scope.geneInfo.segments[sbin];                    
            }
            var tmp = segments[ebin];
            epos = epos + exonStart.length;
            var str = tmp.substr(0, epos) + exonEnd + tmp.substr(epos);
            $scope.geneInfo.segments[ebin] = str;    
        }          
                    
        if (t.Translation) {
            var purl = 'http://rest.ensembl.org/sequence/id/'+t.Translation.id +'?content-type=application/json';
            $http.get(purl).success(function(data){
                t.protein = data.seq;
                t.pseq = '-' + data.seq.split('').join('--') + '-';
            
                var cds = 'http://rest.ensembl.org/map/cds/'+t.id+'/1..1000000?content-type=application/json';
                $http.get(cds).success(function(data){
                    var pEnd = $scope.geneInfo.start-1;
                    var gStart = $scope.geneInfo.start;
                    var pSeq = t.pseq;
                
                    var pseq = '';
                    for(var i in data.mappings) {
                        if (data.mappings[i].gap === 0) {
                            //console.log((data.mappings[i].start - gStart) + '..' + (data.mappings[i].end - gStart));
                            pseq = pseq + repeat(' ', data.mappings[i].start - pEnd -1);
                            var len = data.mappings[i].end - data.mappings[i].start+1;
                            pseq = pseq + pSeq.substr(0, len);
                            pSeq = pSeq.substr(len);
                            pEnd = data.mappings[i].end;
                        }                                             
                    }
                 //   console.log(pseq);
                    var ps = pseq.match(/.{1,120}/g);
                    $scope.geneInfo.psegments = ps;
                });                    
            });                            
        }

    };

    this.isSet = function(tabName){            
        return this.currentTab == tabName;            
    };
}]);

