// function to add C character Len times
function repeat(c, len) {   
    for (var e = ''; e.length < len;)
        e += c;
    return e;
}

function getTextWidth(text, font) {
    // re-use canvas object for better performance
    var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    var context = canvas.getContext("2d");
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
};

function elementCurrentStyle(element, styleName){
    if (element.currentStyle){
        var i = 0, temp = "", changeCase = false;
        for (i = 0; i < styleName.length; i++)
            if (styleName[i] != '-'){
                temp += (changeCase ? styleName[i].toUpperCase() : styleName[i]);
                changeCase = false;
            } else {
                changeCase = true;
            }
        styleName = temp;
        return element.currentStyle[styleName];
    } else {
        return getComputedStyle(element, null).getPropertyValue(styleName);
    }
}

// Define the app, ngSanitize is needed to enable passing plain html into ng-repeat
var myApp = angular.module('geneInfoApp', ['ngSanitize', 'ui.bootstrap']) .filter('baseCount', function() {
        return function(input) { 
            if (input) {
                return input.split(re).length -1;
            }
            return 0;
        }
    });
    
myApp.controller('menuCtrl', ['$scope', '$modal', function ($scope, $modal) {
    var ctrl = this;
    $scope.items = [];
    this.show = function (topic) {   
    $scope.items[0] = topic;
    
    var modalInstance = $modal.open({
        templateUrl: 'myModalContent.html',        
        controller: ModalInstanceCtrl,
        resolve: {
            items: function () {
                return $scope.items;
            }
        }
    });
  };
}]);

var ModalInstanceCtrl = function ($scope, $modalInstance, items) {
    $scope.items = items;
    $scope.ok = function () {
        $modalInstance.close();
    };
};
// main controller - it accepts the input gene name and fetches the gene info
myApp.controller('geneInfoCtrl', ['$scope', '$http', '$sce','$location', '$anchorScroll', 
                                  function ($scope, $http, $sce, $location, $anchorScroll) {

    $scope.message = '';
    $scope.location = 0;
                                      
    $scope.baseCount = function(str) {
        if(str) {            
            return str.split(/[A-Z]/).length - 1;
        }
        return 1;
    };
                                      
    // by default we'll look for BRCA2
    $scope.formInfo = {gene: 'BRCA2', width: 100, coding: false};
    
    // the rest api call will fill this object
    $scope.geneInfo = {}; 
    
    $scope.currentTag = -1;
          
    $scope.markup = [];
    
//    $scope.fontWidth = getTextWidth("ATGC", "normal 13pt Menlo") / 4;

    var el = document.getElementById('tmp');
    console.log(el); 
    
    var font = elementCurrentStyle(el,"font-weight") + " " + elementCurrentStyle(el,"font-size") + " " + elementCurrentStyle(el,"font-family");
    console.log(font);
    console.log(getTextWidth("ATGC", font) / 4);                                  
    $scope.fontWidth = getTextWidth("ATGC", "normal 13px Consolas") / 4;
    console.log($scope.fontWidth);
                                      
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
        $scope.currentpTag = -1;
        $scope.currentTag = -1;
        $scope.currentpcTag = -1;
        $scope.currentcTag = -1;
        $scope.message = '';
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
            
        }).error(function(data, status, header, config){
            if (status === 400) {
                $scope.message = data.error;
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
        
        if (ipos > tmp.length) {
                ctrl.foundSeq = 'Length is only ' + tmp.length + ' bp';
                return;
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
        ctrl.foundSeq = "Found bp: " + tmp2.substr(ppos2, 1);
        
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
        
        //console.log(ipos);
        
        var t;
        for(var i in $scope.geneInfo.Transcript) {
            if ($scope.geneInfo.Transcript[i].id === tab.currentTab) {
                t = $scope.geneInfo.Transcript[i];
            }
        }
        
        if (t && t.Translation) {
            var coding = $scope.formInfo.coding;
     
            var tmp = coding ? t.pseq : t.ppseq;
            
            if (ipos > t.plen) {
                ctrl.foundSeq = 'Length is only ' + t.plen + ' aa';
                return;
            }
            
            var w = $scope.formInfo.width;
            
            var ppos = tmp.split(/[A-Z]/, ipos).join('X').length;          
            var pposA = tmp.split(/\-/, ipos*2-1).join('X').length;          
            var pposB = tmp.split(/\-/, ipos*2).join('X').length;          
            var gpos = [pposA, ppos, pposB];
            
            var sbin = Math.floor(ppos / w);
            var spos = ppos % w;
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
            
            var tmp3 = coding ? t.cdna : $scope.geneInfo.sequence.seq;
            var str3 = tmp3.substr(gpos[0], 1) + tmp3.substr(gpos[1], 1) + tmp3.substr(gpos[2], 1);
            ctrl.foundSeq = "Found aa: " + tmp2.substr(spos, 1) + " = " + str3;
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
        this.markupSequence();
    };

                                  
    $scope.markupSequence = function () {
        console.log('marking ... '+ $scope.geneInfo.mark_seq.length + 'seq');
    }
}]);


myApp.controller('TabController', ['$scope', '$http', '$location', '$anchorScroll', 
                                   function($scope, $http, $location, $anchorScroll){    
    this.currentTab = '-';
    $scope.location = 0;
    this.click = function(event, row) {
        console.log(row + ' : ' + event.offsetX);
    };
    
    this.untrack = function() {
        $("#location").hide();
    };
    this.track = function(event, row) {
        console.log(row + ' : ' + event.offsetX );
        $scope.location = row * $scope.formInfo.width + Math.floor(event.offsetX / $scope.fontWidth);
        $("#location").css({top: event.clientY + 10, left: event.clientX + 20}).show();
    };
    
    this.setTab = function(newValue){
        if (newValue) {
            this.currentTab = newValue;
            $scope.currentpTag = -1;
            $scope.currentTag = -1;
            $scope.currentpcTag = -1;
            $scope.currentcTag = -1;
        } 
            
        //console.log($scope.currentpTag);
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

