
// function to add C character Len times
function repeat(c, len) {   
    for (var e = ''; e.length < len;)
        e += c;
    return e;
}

// function to get the width of the font
function getTextWidth(text, font) {
    // re-use canvas object for better performance
    var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    var context = canvas.getContext("2d");
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
};

// function to get the selected sequence 
function getSelectedText() {
    var text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    text = text.replace(/[^A-Z]/g, '');
    return text;
}

function getSelectedDNA() {
    var text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    // remove protein sequence
    text = text.replace(/\d+\:[A-Z\-\s]+\:\d+/g, '');
    // now remove all the special chars
    
    text = text.replace(/[^A-Z]/g, '');
    return text;
}

// function to get the font  used to display sequence
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
myApp.controller('geneInfoCtrl', ['$scope', '$http', '$sce','$location', '$anchorScroll', '$window', 
                                  function ($scope, $http, $sce, $location, $anchorScroll, $window) {

    $scope.message = '';
    $scope.location = 0;
    if ($window.ga){
        var path = '/';
        $window.ga('send', 'pageview', { page: path });
    }
    
                                      
    $scope.baseCount = function(str) {
        if(str) {            
            return str.split(/[A-Z]/).length - 1;
        }
        return 1;
    };
                                      
    // by default we'll look for BRCA2, HIST1H4F - smallest
    $scope.formInfo = {gene: 'BRCA2', width: 100, coding: false, blast: 'http://www.ensembl.org/common/Tools/Blast'};
    
    // the rest api call will fill this object
    $scope.geneInfo = {}; 

    // get the font used to display sequence
    var el = document.getElementById('tmp');    
    var font = elementCurrentStyle(el,"font-variant") + " " + elementCurrentStyle(el,"font-size") + " " + elementCurrentStyle(el,"font-family");

    // need to use the same length as the display window, otherwise IE gives rounded values                                  
    var text = repeat('A', $scope.formInfo.width);

    // get the font width
    $scope.fontWidth = getTextWidth(text, font) / $scope.formInfo.width;

    $scope.currentSelect = { start: -1, stop: -1 };                                  
    var self = this;
    
    self.trustedHtml = $sce.trustAsHtml(this.textContent);
                                  
    var surl = 'http://rest.ensembl.org/info/species?content-type=application/json;division=ensembl';                                   
    self.species = 'homo_sapiens';   
    $http.get(surl).success(function(sdata ){
        self.speciesList = sdata.species;
    });
    $scope.formInfo.blast = 'http://www.ensembl.org/' + self.species + '/Tools/Blast';    
    var ctrl = this;
    
    // when changing species - change the url of the blast tool                                  
    this.update_blast = function() {
        $scope.formInfo.blast = 'http://www.ensembl.org/' + ctrl.species + '/Tools/Blast';    
        $("#blast_form").action = $scope.formInfo.blast;
    };
                                      
    $scope.clearTags = function() {
        ctrl.foundSeq = '';
        
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
        
        $scope.currentpTag = -1;
        $scope.currentTag = -1;
        $scope.currentpcTag = -1;
        $scope.currentcTag = -1;    
    };
                                      
    $scope.getProtein = function(t) {
        //return;
        if (t.Translation) {
            t.plen = 1;
            var purl = 'http://rest.ensembl.org/sequence/id/'+t.Translation.id +'?content-type=application/json';
            $http.get(purl).success(function(sdata ){
                t.protein = sdata.seq;
                t.plen = sdata.seq.length;
            });
        } else {
            t.plen = 0;
        }
    };
                                      
    // function that will be called on form submit
    this.findGene = function() {
        if ($window.ga){
            var path = '/gene/'+$scope.formInfo.gene;            
            $window.ga('send', 'pageview', { page: path });
        }
    
        
        $scope.message = '';
        $scope.formInfo.coding = false;
        $scope.clearTags();
        
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
        $scope.clearTags();
        if ($window.ga){
            var path = '/pos/bp';
            $window.ga('send', 'pageview', { page: path });
        }

        var w = $scope.formInfo.width;
        
        var ipos = $scope.formInfo.pos; //parseInt($scope.formInfo.pos.replace(/\,/g, ''));
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
        $scope.clearTags();
        if ($window.ga){
            var path = '/pos/aa';
            $window.ga('send', 'pageview', { page: path });
        }

        var ipos = $scope.formInfo.pos; //parseInt($scope.formInfo.pos.replace(/\,/g, ''));
        
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
                                       
    var ctrl = this;
    this.getLinePos = function(e) {
        var padding = 0;
        var x  = e.offsetX !== undefined ? (e.offsetX -padding ) : (e.clientX - $(e.target).offset().left);
        var rowpos = Math.floor(x / $scope.fontWidth) + 1;
        
        if (rowpos < 1){
            rowpos = 1;
        } else {
            if (rowpos >$scope.formInfo.width) {
                rowpos = $scope.formInfo.width;
            }
        }
        return rowpos;
    };
                          
                                       
    this.click = function(e, row, atype) {
        return;
        $scope.blast_shown = 0;
        $("#blast").hide();
        ctrl.clear_select();
    };
    
    this.dblclick = function(e, row, atype) {
        $scope.blast_shown = 0;
        $("#blast").hide();
        ctrl.clear_select();
    };
    
    this.start_select = function( e, row, atype ) {
        var x = this.getLinePos(e);
        $scope.blast_shown = 0;
        $scope.currentSelect.start = $scope.formInfo.width * row + x;
        $("#blast").hide();
    };
    
    this.stop_select = function( e, row, atype ) {
   
        var x = this.getLinePos(e);
        $scope.currentSelect.stop = $scope.formInfo.width * row + x;
   
        //console.log("Select " + $scope.currentSelect.start + ' .. ' + + $scope.currentSelect.stop);   
        if ($scope.currentSelect.stop === $scope.currentSelect.start) {
            ctrl.clear_select();
            return ;
        }
        if (0) {
        
        var start = $scope.currentSelect.start-1;
        var len = $scope.currentSelect.stop - start;
        
        if ($scope.currentSelect.stop < $scope.currentSelect.start) {
            start = $scope.currentSelect.stop -1;
            len = $scope.currentSelect.start - start ;
        }
        var seq = $scope.geneInfo.sequence.seq.substr(start, len);
//        console.log( start + ' * ' + len + ' * ' + seq);
    }
        $scope.blast_sequence = getSelectedDNA();
        $("#location").hide();
        $("#blast").css({top: e.clientY + 10, left: e.clientX + 10}).show();
        $scope.blast_shown = 1;
        
    };
    
    this.clear_select = function() {
        $scope.currentSelect.start = -1;
        $scope.currentSelect.end = -1;
        $scope.blast_shown = 0;
    };
                                       
    this.untrack = function() {
        $("#location").hide();
    };

    this.goto_blast = function() {
        $("#blast").hide();
        ctrl.clear_select();        
        document.blast_form.action = $scope.formInfo.blast;        
        var path = '/blast/ensembl';
        
        if ($scope.blast_type === 'nblast') {
            document.blast_form.action = 'http://www.ncbi.nlm.nih.gov/blast/Blast.cgi';
            path = '/blast/ncbi';
        }
        
        if ($window.ga){
            $window.ga('send', 'pageview', { page: path });
        }

        return true;
    };
    
    this.set_eblast = function() {
        $scope.blast_type = 'eblast';        
    };
                                           
    this.set_nblast = function() {
        $scope.blast_type = 'nblast';        
    };
                                       
    this.track = function(e, row, atype) {
        if ($scope.blast_shown) {
            return;
        }
        if ($scope.currentSelect.start > 0) {
            //var curpos = this.getLinePos(e) + row * $scope.formInfo.width;
            //$scope.location = (curpos - $scope.currentSelect.start ) + ' ' + atype + ' selected';
            var seq = getSelectedDNA();
            //console.log(seq);
            $scope.location = (seq.split(/[AGTC]/).length -1 )+ ' ' + atype + ' selected';
        } else {
            var padding = 0;
        //console.log((e.offsetX -padding) + ' * ' +  (e.clientX - $(e.target).offset().left));
            var x  = e.offsetX !== undefined ? (e.offsetX -padding ) : (e.clientX - $(e.target).offset().left);
            var rowpos = Math.floor(x / $scope.fontWidth) + 1;
        //console.log(rowpos);
        
        
            if (rowpos < 1){
                rowpos = 1;
            } else {
                if (rowpos >$scope.formInfo.width) {
                    rowpos = $scope.formInfo.width;
                }
            }
            var pos = row * $scope.formInfo.width + rowpos ;
            $scope.location = pos + " " +atype;
        }
        $("#location").css({top: e.clientY + 10, left: e.clientX + 20}).show();
    };
    
                                       
    this.setTab = function(newValue){
        if (newValue) {
            this.currentTab = newValue;
            $scope.clearTags();
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
    
    this.hasCoding = function() {
        var t;            
        
        for(var i in $scope.geneInfo.Transcript) {
            if ($scope.geneInfo.Transcript[i].id === this.currentTab) {
                t = $scope.geneInfo.Transcript[i];
            }
        }
        
        if (t) {
            return true;
        }
        return false;
    }                                       
                                       
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

