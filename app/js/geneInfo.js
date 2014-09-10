// function to add C character Len times
function repeat(c, len) {   
    for (var e = ''; e.length < len;)
        e += c;
    return e;
}

// Define the app, ngSanitize is needed to enable passing plain html into ng-repeat
var myApp = angular.module('geneInfoApp', ['ngSanitize']);

// main controller - it accepts the input gene name and fetches the gene info
myApp.controller('geneInfoCtrl', ['$scope', '$http', '$sce','$location', '$anchorScroll', 
                                  function ($scope, $http, $sce, $location, $anchorScroll) {
    // by default we'll look for BRCA2
    $scope.formInfo = {gene: 'BRCA2', width: 100, coding: false};
    
    // the rest api call will fill this object
    $scope.geneInfo = {}; 
    
    $scope.currentTag = -1;
          
    $scope.markup = [];
                                      
    var self = this;
    
    self.trustedHtml = $sce.trustAsHtml(this.textContent);
                                  
    var surl = 'http://rest.ensembl.org/info/species?content-type=application/json;division=ensembl';                                   
    self.species = 'homo_sapiens';   
    $http.get(surl).success(function(sdata ){
        self.speciesList = sdata.species;
    });
        
    var ctrl = this;
                                      
    $scope.getProtein = function(t) {
        //return;
        if (t.Translation) {
            var purl = 'http://rest.ensembl.org/sequence/id/'+t.Translation.id +'?content-type=application/json';
            $http.get(purl).success(function(sdata ){
                t.protein = sdata.seq;
                t.plen = sdata.seq.length;
            });
        }
    };
                                      
    // function that will be called on form submit
    this.findGene = function() {
        // first we look for the gene
        var url = 'http://rest.ensembl.org/lookup/symbol/'+self.species+'/' + $scope.formInfo.gene
                + '?content-type=application/json;expand=1';
            
        $http.get(url).success(function(data){
            // hooray - we have found the gene
            $scope.geneInfo = data;
            if ($scope.geneInfo.strand === 1) {
                $scope.geneInfo.strand_str = 'forward';
            } else {
                $scope.geneInfo.strand_str = 'reverse';
            }
            
            $scope.geneInfo.url = 'http://www.ensembl.org/'+self.species+'/Gene/Summary?g=' + data.id;
            $scope.loading = true;
            
            // now let's get the sequence
            var surl = 'http://rest.ensembl.org/sequence/region/'+self.species+'/' + data.seq_region_name + ':' + data.start + '..' + data.end + ':'+data.strand+'?content-type=application/json';
            $http.get(surl).success(function(seq){
                
                
                var w = $scope.formInfo.width;
                var restr = ".{1,"+w+"}";
                var re = new RegExp(restr,'g');
                
                var s = seq.seq.match(re);
                
                $scope.geneInfo.sequence = seq;
                $scope.geneInfo.segments = s;
                $scope.loading = false;  
            });
            
            for (var i in data.Transcript) {
                $scope.getProtein(data.Transcript[i]);                
            }
            
        });            
    };
    
                                      
    this.findBP = function(tab) {        
        var w = $scope.formInfo.width;
        if ($scope.currentTag > -1) {
            var tmp = $scope.geneInfo.segments[$scope.currentTag];
            tmp = tmp.replace(/\<span class=\"tag\">(.)<\/span>/mg, "$1");
            $scope.geneInfo.segments[$scope.currentTag] = tmp;
        }
        
        if ($scope.currentcTag > -1) {
            var tmp = $scope.geneInfo.csegments[$scope.currentcTag];
            tmp = tmp.replace(/\<span class=\"tag\">(.)<\/span>/mg, "$1");
            $scope.geneInfo.csegments[$scope.currentcTag] = tmp;
        }
        
        
        var ipos = parseInt($scope.formInfo.pos.replace(/\,/g, ''));
        var coding = $scope.formInfo.coding;
        var tmp = $scope.geneInfo.sequence.seq;
        
        if (coding) {
            var t;
            for(var i in $scope.geneInfo.Transcript) {
                if ($scope.geneInfo.Transcript[i].id === tab.currentTab) {
                    t = $scope.geneInfo.Transcript[i];
                }
            }
            tmp = t.cdna;
        }
        var ppos = tmp.split(/[A-Z]/, ipos).join('X').length;
        var pos = ppos; //($scope.geneInfo.strand > 0) ? ipos - $scope.geneInfo.start : $scope.geneInfo.end - ipos;
        
        var sbin = Math.floor(pos / w);
        var spos = pos % w;
        
        var tagStart = '<span class="tag">';
        var tagEnd = '</span>';
        var tmp2 = coding ? $scope.geneInfo.csegments[sbin] : $scope.geneInfo.segments[sbin];
        var ppos2 = tmp2.split(/[A-Z]/, spos+1).join('X').length;
        var str = tmp2.substr(0, ppos2) + tagStart + tmp2.substr(ppos2, 1) + tagEnd + tmp2.substr(ppos2+1);
        ctrl.foundSeq = "BP: " + tmp2.substr(ppos2, 1);
        
        if (coding) {
            $scope.geneInfo.csegments[sbin] = str;        
            $scope.currentcTag = sbin;
            $location.hash('b_'+sbin);
        } else {
            $scope.geneInfo.segments[sbin] = str;        
            $scope.currentTag = sbin;
            $location.hash('a_'+sbin);
        }
        $anchorScroll();
    };
    
                                      
    this.findAA = function(tab) {
        if ($scope.currentpTag > -1) {
            var tmp = $scope.geneInfo.psegments[$scope.currentpTag];            
            tmp = tmp.replace(/\<span class=\"tag\">(.)<\/span>/mg, "$1");
            $scope.geneInfo.psegments[$scope.currentpTag] = tmp;
        }
        if ($scope.currentpcTag > -1) {
            var tmp = $scope.geneInfo.pcsegments[$scope.currentpcTag];            
            tmp = tmp.replace(/\<span class=\"tag\">(.)<\/span>/mg, "$1");
            $scope.geneInfo.pcsegments[$scope.currentpcTag] = tmp;
        }

        
        var ipos = parseInt($scope.formInfo.pos.replace(/\,/g, ''));
        
        var t;
        for(var i in $scope.geneInfo.Transcript) {
            if ($scope.geneInfo.Transcript[i].id === tab.currentTab) {
                t = $scope.geneInfo.Transcript[i];
            }
        }
        
        if (t && t.Translation) {
            var coding = $scope.formInfo.coding;
     
            var tmp = coding ? t.pseq : t.ppseq;
            var w = $scope.formInfo.width;
            
            var ppos = tmp.split(/[A-Z]/, ipos).join('X').length;          
            console.log(ppos);
            var pposA = tmp.split(/\-/, ipos*2-1).join('X').length;          
            var pposB = tmp.split(/\-/, ipos*2).join('X').length;          
            console.log(pposA + ' .. ' + pposB);
            var gpos = [pposA, ppos, pposB];
            
            var sbin = Math.floor(ppos / w);
            var spos = ppos % w;
            
            console.log(sbin + " . " + spos);
            var tagStart = '<span class="tag">';
            var tagEnd = '</span>';
    
            var tmp2 = coding ? $scope.geneInfo.pcsegments[sbin] : $scope.geneInfo.psegments[sbin];
            var str = tmp2.substr(0, spos) + tagStart + tmp2.substr(spos, 1) + tagEnd + tmp2.substr(spos+1);
            
            if (coding) {
                $scope.geneInfo.pcsegments[sbin] = str;
                $scope.currentpcTag = sbin;        
                $location.hash('b_'+sbin);
            } else {
                $scope.geneInfo.psegments[sbin] = str;
                $scope.currentpTag = sbin;   
                $location.hash('a_'+sbin);            
            }
            $anchorScroll();            
            
            console.log(gpos);
            var tmp3 = coding ? t.cdna : $scope.geneInfo.sequence.seq;
            
            
            var str3 = tmp3.substr(gpos[0], 1) + tmp3.substr(gpos[1], 1) + tmp3.substr(gpos[2], 1);
            ctrl.foundSeq = "AA: " + tmp2.substr(spos, 1) + " = " + str3;
            for(var i in gpos) {
                var sbin = Math.floor(gpos[i] / w);
                var spos = gpos[i] % w;
        
                var tmp2 = coding ? $scope.geneInfo.csegments[sbin] : $scope.geneInfo.segments[sbin];
                var ppos2 = tmp2.split(/[A-Z]/, spos+1).join('X').length;
                var str = tmp2.substr(0, ppos2) + tagStart + tmp2.substr(ppos2, 1) + tagEnd + tmp2.substr(ppos2+1);
    
                if (coding) {
                    $scope.geneInfo.csegments[sbin] = str;        
                    $scope.currentcTag = sbin;
                } else {
                    $scope.geneInfo.segments[sbin] = str;        
                    $scope.currentTag = sbin;
                }
            }
            
        }        
    };
                                      
    this.findSeq = function() {
        var arr = $.grep($scope.markup, function( e, i ) {
            return ( e[2] !== 'M');
        });
        
        console.log(arr.length);
        
        console.log("mark " + $scope.formInfo.pos);
        var ostr = $scope.formInfo.pos.toUpperCase();
        var str = $scope.geneInfo.sequence.seq;
        
        var index, startIndex, indices = [];
        var searchStrLen = ostr.length;
        while ((index = str.indexOf(ostr, startIndex)) > -1) {
            var a = Array(index, index + searchStrLen, 'M');
            indices.push(a);
            startIndex = index + searchStrLen;
        }
        
        $scope.geneInfo.mark_seq = indices;
        
        console.log(indices.length);
        //console.log(indices);
        
        this.markupSequence();
    };

                                  
    $scope.markupSequence = function () {
        console.log('marking ... '+ $scope.geneInfo.mark_seq.length + 'seq');
    }
}]);


myApp.controller('TabController', ['$scope', '$http', '$location', '$anchorScroll', 
                                   function($scope, $http, $location, $anchorScroll){    
    this.currentTab = '-';
    
    
    this.setTab = function(newValue){
        if (newValue) {
            this.currentTab = newValue;
        } 
        
        // find the selected transcript
        var t;            
        for(var i in $scope.geneInfo.Transcript) {
            if ($scope.geneInfo.Transcript[i].id === this.currentTab) {
                t = $scope.geneInfo.Transcript[i];
            }
        }
                    
        // reset the binned sequence
        var w = $scope.formInfo.width;
        
        var restr = ".{1,"+w+"}";
        var re = new RegExp(restr,'g');
                
        var s = $scope.geneInfo.sequence.seq.match(re);
        $scope.geneInfo.segments = s;
        $scope.geneInfo.psegments = s;

        var exonStart = '<span class="exon">';
        var exonEnd = '</span>';

        var strand = $scope.geneInfo.strand;
        var gStart = $scope.geneInfo.start;                    
        var gEnd = $scope.geneInfo.end;
        var indices = [];
        
        for(var i in t.Exon) {
            var s = (strand < 0) ? gEnd - t.Exon[i].end : t.Exon[i].start - gStart;
            var e = (strand < 0) ? gEnd - t.Exon[i].start +1 : t.Exon[i].end - gStart + 1;
        
            //console.log(t.Exon[i].id + ' : ' + s + ' ... ' + e);
            var sbin = Math.floor(s / w);
            var spos = s % w;
            var ebin = Math.floor(e / w);
            var epos = e % w;
            
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
            
                var curl = 'http://rest.ensembl.org/sequence/id/'+t.id+'?content-type=application/json;type=cds';
            
                $http.get(curl).success(function(data){
                    t.cdna = data.seq;
                    var w = $scope.formInfo.width;
                    var restr = ".{1,"+w+"}";
                    var re = new RegExp(restr,'g');
        
                    var ps = data.seq.match(re);
                    $scope.geneInfo.csegments = ps;
                    
                    var pcs = t.pseq.match(re);
                    $scope.geneInfo.pcsegments = pcs;
                    $scope.geneInfo.icsegments = [];
                    var c = 1;
                    for (var i in pcs) {
                        var m = pcs[i].split(/[A-Z]/).length - 1;
                        if (m) {
                            $scope.geneInfo.icsegments[i] = c;
                            c = c + m;
                        }
                    }

                });
            
                
                var cds = 'http://rest.ensembl.org/map/cds/'+t.id+'/1..3000000?content-type=application/json';
                $http.get(cds).success(function(data){
                    var pEnd = -1;
                    var pSeq = t.pseq;
                    var pseq = '';
                    
                    for(var i in data.mappings) {
                        if (data.mappings[i].gap === 0) {
                            var s = (strand < 0) ? gEnd - data.mappings[i].end : data.mappings[i].start - gStart;
                            var e = (strand < 0) ? gEnd - data.mappings[i].start : data.mappings[i].end - gStart;
                            
                            pseq = pseq + repeat(' ', s - pEnd - 1);
                            var len = e - s + 1;
                            
                            pseq = pseq + pSeq.substr(0, len);
                            pSeq = pSeq.substr(len);
                            pEnd = e;
                        }                                             
                    }
                    t.ppseq = pseq;
                 //   console.log(pseq);
                    var w = $scope.formInfo.width;
                    var restr = ".{1,"+w+"}";
                    var re = new RegExp(restr,'g');
        
                    var ps = pseq.match(re);
                    $scope.geneInfo.psegments = ps;
                    $scope.geneInfo.isegments = [];
                    $scope.geneInfo.esegments = [];
                    
                    var c = 1;
                    for (var i in ps) {
                        var m = ps[i].split(/[A-Z]/).length - 1;
                        if (m) {
                            $scope.geneInfo.isegments[i] = c;
                            c = c + m;
                        }
                        
//                        console.log(i + "*" + c);
                    }
                });                    
            });                            
        }
        var coding = $scope.formInfo.coding;
        if (coding) {
                $location.hash('b_0');
        } else {
            $location.hash('a_0');            
        }
        $anchorScroll();        
        
    };

    this.isSet = function(tabName){            
        return this.currentTab == tabName;            
    };
    
    this.hasTranslation = function() {
        var t;            
        
        for(var i in $scope.geneInfo.Transcript) {
            if ($scope.geneInfo.Transcript[i].id === this.currentTab) {
                t = $scope.geneInfo.Transcript[i];
            }
        }
        
        if (t && t.Translation) {
            return true;
        }
        return false;
    }
}]);

