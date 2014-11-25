var geneFields = ['id', 'start', 'end', 'strand', 'description', 'display_name', 'seq_region_name'];
var exonStart = '<div class="exon">';
var exonEnd = '</div>';
var foundStart = '<span class="tag">';
var foundEnd = '</span>';
var markStart = '<h5 class="mark">';
var markEnd= '</h5>';
        
String.prototype.getDNAPos = function(pos) {
    return this.split(/[A-Z]/, pos).join('X').length;                      
}

String.prototype.regexIndexOf = function(regex, startpos) {
    var indexOf = this.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
}

String.prototype.regexLastIndexOf = function(regex, startpos) {
    regex = (regex.global) ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
    if(typeof (startpos) == "undefined") {
        startpos = this.length;
    } else if(startpos < 0) {
        startpos = 0;
    }
    var stringToWorkWith = this.substring(0, startpos + 1);
    var lastIndexOf = -1;
    var nextStop = 0;
    while((result = regex.exec(stringToWorkWith)) != null) {
        lastIndexOf = result.index;
        regex.lastIndex = ++nextStop;
    }
    return lastIndexOf;
}

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
var myApp = angular.module('geneSpyApp', ['ngSanitize', 'ui.bootstrap']) .filter('baseCount', function() {    
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
myApp.controller('geneSpyCtrl', ['$scope', '$http', '$sce','$location', '$anchorScroll', '$window', 
                                  function ($scope, $http, $sce, $location, $anchorScroll, $window) {

    var self = this;
    // to enable html in ng-bind - used in sequence display                                  
    self.trustedHtml = $sce.trustAsHtml(this.textContent);                                    
                                      
    // by default we'll look for BRCA2, HIST1H4F - smallest
    $scope.formInfo = {
        //gene: 'HIST1H4F', 
        //gene: 'BRCA2',
        gene: '',
        width: 100, 
        coding: false, 
        restServer: 'http://rest.ensembl.org',
        eServer: 'http://www.ensembl.org/',
        source: 'elatest',
        division: 'ensembl'
    };

    $scope.serverList = [
        { name: 'elatest', division: 'ensembl', label: 'Ensembl ( GRCh38 )' , url: 'http://rest.ensembl.org', eurl: 'http://www.ensembl.org'},
        { name: 'egrch37', division: 'ensembl', label: 'Ensembl ( GRCh37 )' , url: 'http://grch37.rest.ensembl.org', eurl: 'http://grch37.ensembl.org'}
// eg reset is too slow        { name: 'eplants', division: 'plants', label: 'Plants' , url: 'http://rest.ensemblgenomes.org', eurl: 'http://plants.ensembl.org'}
    ];
    
    $scope.clearAllMarkup = function() {
        $scope.currentAA = [];
        $scope.resetSequence();        
    };
    
    $scope.resetMarkup = function() {
        for (var i in $scope.geneData.segments) {
            var tmp = $scope.geneData.segments[i];
            var re = new RegExp('\<h5 class=\"find\">','g');
            var re2 = new RegExp('\<\/h5\>','g');
            var tmp2 = tmp.replace(re, '');
            var tmp3 = tmp2.replace(re2, '');
            $scope.geneData.segments[i] = tmp3;            
        }
    };
                                      
    $scope.resetSequence = function() {
        if ($scope.geneData) {
            var sequence = $scope.formInfo.coding ? $scope.geneData.cds : $scope.geneData.dna;
            if (sequence) {
                var w = $scope.formInfo.width;
                var restr = ".{1,"+w+"}";
                var re = new RegExp(restr,'g');
                var s = sequence.match(re);
                $scope.geneData.segments = s;
            }
        }
    };
    
    $scope.resetFound = function() {
        self.foundSeq = '';
        if ($scope.currentTag > -1) {
            var tmp = $scope.geneData.segments[$scope.currentTag];
            tmp = tmp.replace(/\<span class=\"tag\">(.)<\/span>/mg, "$1");
            $scope.geneData.segments[$scope.currentTag] = tmp;
            $scope.currentTag  = -1;
        }
        
        if ($scope.currentAA.length) {
            $scope.currentAA.map(function(item) {
                var tmp = $scope.geneData.segments[item];
                tmp = tmp.replace(/\<span class=\"tag\">(.)<\/span>/mg, "$1");
                $scope.geneData.segments[item] = tmp;
            });

            var tmp = $scope.geneData.psegments[$scope.currentAA[1]];
            tmp = tmp.replace(/\<span class=\"tag\">(.)<\/span>/mg, "$1");
            $scope.geneData.psegments[$scope.currentAA[1]] = tmp;
            $scope.currentAA = [];
        }
    };
                                      
    this.reset = function() {
        $scope.message = '';
        $scope.location = 0;
        if ($scope.geneData) {
            if ($scope.geneData.tlist) {
                for (var i in $scope.geneData.tlist) {
                    $scope.geneData.tlist[i].id = null;
                    $scope.geneData.tlist[i].plen = null;
                    $scope.geneData.tlist[i].Exon = [];                    
                }    
            }
            $scope.geneData.segments = [];
            $scope.geneData.psegments = [];
            $scope.geneData.isegments = [];
            $scope.geneData.mappings = [];
            
            
            for (var i in $scope.geneData) {
                $scope.geneData[i] = null;
            }
        }
        $scope.geneData = {};
        $scope.currentAA = [];
        
        $scope.formInfo.coding = false;
        self.foundSeq = '';
    };

    this.getFontWidth = function() {
// get the font used to display sequence
        var el = document.getElementById('tmp');    
        var font = elementCurrentStyle(el,"font-variant") + " " + elementCurrentStyle(el,"font-size") + " " + elementCurrentStyle(el,"font-family");

    // need to use the same length as the display window, otherwise IE gives rounded values                                  
        var text = repeat('A', $scope.formInfo.width);

    // get the font width
        $scope.fontWidth = getTextWidth(text, font) / $scope.formInfo.width;
    };
    
    this.recordVisit = function(path) {                                  
        if ($window.ga){
            $window.ga('send', 'pageview', { page: path });
        }
    };
                                          
    this.updateSpecies = function() {                                  
        var surl = $scope.formInfo.restServer + '/info/species?content-type=application/json;division='+$scope.formInfo.division;                                   
        self.species = 'homo_sapiens';   
        $http.get(surl).success(function(sdata ){
            self.speciesList = sdata.species;
        });
        $scope.formInfo.blast = $scope.formInfo.eServer + self.species + '/Tools/Blast';    
        self.reset();
    }
                                      
    this.updateServer = function() {
        for(var i in $scope.serverList) {
            if ($scope.serverList[i].name === $scope.formInfo.source) {
                $scope.formInfo.restServer = $scope.serverList[i].url;
                $scope.formInfo.eServer = $scope.serverList[i].eurl;            
                $scope.formInfo.division = $scope.serverList[i].division;
                self.updateSpecies();
            }
        }
        
    };
    
$scope.findGene = function() {
        self.reset();

        $scope.loading = true;
        
        var gene = $scope.formInfo.gene.toUpperCase();
        
        $scope.message = "Looking for " + gene;
        
        self.recordVisit($scope.formInfo.source+'/gene/'+gene);
    
        // first we look for the gene
        var url = $scope.formInfo.restServer + '/lookup/symbol/'+self.species+'/' + gene + '?content-type=application/json;expand=1';
                
        $http.get(url).success(function(data){
            // hooray - we have found the gene
            geneFields.map(function(item) {
                $scope.geneData[item] = data[item];
            });
            
            $scope.geneData.Transcript = data.Transcript.map(function(t) {
                var tn = {id: t.id, plen:0 };
                if (t.Translation) {
                    tn.plen = t.Translation.length;
                    tn.pid = t.Translation.id;
                    if (t.is_canonical === "1") { // longest coding sequence is 80K
                        tn.plen += 100000;
                    }
                }
                tn.Exon = t.Exon.map(function(e) {
                    return { start: e.start, end: e.end};
                });
                return tn;
            });

            $scope.loading = true;
            
            // now let's get the sequence
            var surl = $scope.formInfo.restServer + '/sequence/region/'+self.species+'/' + data.seq_region_name + ':' + data.start + '..' + data.end + ':'+data.strand+'?content-type=application/json';
            $http.get(surl).success(function(seq){                                
                var w = $scope.formInfo.width;
                var restr = ".{1,"+w+"}";
                var re = new RegExp(restr,'g');
                
                var s = seq.seq.match(re);
                
                $scope.geneData.dna = seq.seq;
                $scope.geneData.segments = s;
                
                $scope.loading = false;  
                $location.path("gene\/"+ gene);
//                console.log(sizeof($scope.geneData));
            });
            
            $scope.message = '';            
        }).error(function(data, status, header, config){
            if (status === 400) {
                $scope.message = data.error;
            }
            $scope.loading = false;
        });
        
    };
                                          
    self.getFontWidth();                                                              
    self.updateServer();                                      

// if thre is gene id in the url then go directly to the gene page                                      
    var path =  $location.path();       
    var geneRegex = /^\/gene\/([\d\w]+)/i;
    var match = geneRegex.exec(path);
    if (match) {
        $scope.formInfo.gene = match[1];
        $scope.findGene();
    } else {                                          
        self.recordVisit("/");
    }
                                                                            
    // function that will be called on form submit
                                      
                                      
                                      
    $scope.baseCount = function(str) {
        if(str) {            
            return str.split(/[A-Z]/).length - 1;
        }
        return 1;
    };
          
    $scope.getCurrentTranscript = function(tab) {
        var t;
        for(var i in $scope.geneData.Transcript) {
            if ($scope.geneData.Transcript[i].id === tab.currentTab) {
                t = $scope.geneData.Transcript[i];
            }
        }
        return t;
    };
    
    this.getExonNumber = function(gene, t, pos) {
        if (gene.strand === -1) {
            var aStart = gene.end - pos;
            var i = 0;
            var exons = t.Exon;
            for (var j in exons) {
                if (t.Exon[j].end >= aStart) {
                    i++;
                }
            }
        } else {
            var aStart = pos + gene.start;
            var i = 0;
            var exons = t.Exon;
            for (var j in exons) {
                if (t.Exon[j].start <= aStart) {
                    i++;
                }
            }
        }            
        return { bp : aStart, exon : i};
    };
                                      
    this.findAA = function(tab) {
        $scope.resetFound();
        
        var ipos = $scope.formInfo.pos; //parseInt($scope.formInfo.pos.replace(/\,/g, ''));        
        if (! ipos) { // this will be set only if validation passes in html
            return;
        }
        
        var t = $scope.getCurrentTranscript(tab);        
        
        if (t && t.pid) {

            var peptide = $scope.geneData.psegments.join('');
            // first find the letter            
            var aaPos = peptide.getDNAPos(ipos);
            // then find the preceeding - and then following - ( as the AA can be split between exons )            
            var leftPos = peptide.split(/\-/, ipos*2-1).join('X').length;          
            var rightPos = peptide.split(/\-/, ipos*2).join('X').length;          
            var gpos = [leftPos, aaPos, rightPos];

            // now mark the AA - only the letter
            var w = $scope.formInfo.width;            
            var sbin = Math.floor(aaPos / w);
            var spos = aaPos % w;
            
            var binseq = $scope.geneData.psegments[sbin];
            
            var str = binseq.substr(0, spos) + foundStart + binseq.substr(spos, 1) + foundEnd + binseq.substr(spos+1);
            $scope.geneData.psegments[sbin] = str;
            $location.hash('a_'+sbin);            
            
            var foundExtra = '';
            var bpPos = self.getExonNumber($scope.geneData, t, leftPos);

            foundExtra = '<div style="margin:0">at ' + bpPos.bp + " bp</div>";
            if (rightPos - leftPos == 2) {
                foundExtra = foundExtra + 'in exon ' + bpPos.exon;
            } else { // split between exons
                foundExtra = foundExtra + 'in exons ' + bpPos.exon + ' and ' + (bpPos.exon + 1);
            }
            
            // now markup the aa in the genomic sequence
            var coding = $scope.formInfo.coding;        
            
            var sequence = coding ? $scope.geneData.cds : $scope.geneData.dna;
            
            var aaDNA = sequence.substr(gpos[0], 1) + sequence.substr(gpos[1], 1) + sequence.substr(gpos[2], 1); 
            self.foundSeq = "Found aa: " + binseq.substr(spos, 1) + " = " + aaDNA + foundExtra; 
            $anchorScroll();            
            
            for(var i in gpos) {
                var sbin = Math.floor(gpos[i] / w);
                var spos = gpos[i] % w;
                $scope.currentAA.push(sbin);                
                var binseq = $scope.geneData.segments[sbin];
                var pos = binseq.getDNAPos(spos+1);
                var str = binseq.substr(0, pos) + foundStart + binseq.substr(pos, 1) + foundEnd + binseq.substr(pos+1);
                $scope.geneData.segments[sbin] = str;                        
            }            
        }        
    };

                                      
    this.findBP = function(tab) {
        $scope.resetFound();
        var ipos = $scope.formInfo.pos; //parseInt($scope.formInfo.pos.replace(/\,/g, ''));
        
        if (! ipos) { // this will be set only if validation passes in html
            return;
        }

        var w = $scope.formInfo.width;
        
        var coding = $scope.formInfo.coding;
        var sequence = coding ? $scope.geneData.cds : $scope.geneData.dna;
              
        if (ipos > sequence.length) {
            self.foundSeq = 'Length is only ' + sequence.length + ' bp';
            return;
        }
            
        var pos = sequence.getDNAPos(ipos); 
        
        var sbin = Math.floor(pos / w); // bin number
        var spos = pos % w; // position within bin
        
        var binseq = $scope.geneData.segments[sbin];
        
        var binpos = binseq.getDNAPos(spos +1);
        var bp = binseq.substr(binpos, 1);
        var str = binseq.substr(0, binpos) + foundStart + bp  + foundEnd + binseq.substr(binpos+1);
        self.foundSeq = "Found bp: " + bp;
        
        $scope.geneData.segments[sbin] = str;        
        $scope.currentTag = sbin;
        
        $location.hash('a_'+sbin);
        $anchorScroll();
    };

                                      
    this.markDNAMulti = function(coding, s, e, mark) {
        var w = $scope.formInfo.width;
        var sbin = Math.floor(s / w);
        var spos = s % w;
        var ebin = Math.floor(e / w);
        var epos = e % w;
        
        var tagStart = '<h5 class="find">';
        var tagEnd= '</h5>';
        
        var segments = $scope.geneData.segments;
        var tmp;
        
        tmp = segments[sbin];        
        var ppos = tmp.split(/[A-Z]/, spos+1).join('X').length;            
//        console.log(ppos);
        var str = tmp.substr(0, ppos) + tagStart + tmp.substr(ppos);
//        console.log(str);
            
        $scope.geneData.segments[sbin] = str;
            
        while (sbin < ebin) {
//            console.log( "SBIN : " + sbin);
            var epos2 = str.split(/[A-Z]/, w).join('X').length +1;            
//            console.log("epos " + epos2);
                
            var str2 = str.substr(0, epos2) + tagEnd + str.substr(epos2);
//            console.log(str2);
        
                   
            var str5 = str2.replace(/<h5 class="find">([A-Z]*)<div class="exon">/g,'<h5 class="find">$1</h5><div class="exon"><h5 class="find">');
                //console.log("S5:" + str5);
            var str6 = str5.replace(/<h5 class="find">([A-Z]*)<\/div>/g,'<h5 class="find">$1</h5><\/div><h5 class="find">');
        
            
            $scope.geneData.segments[sbin] = str6;
            sbin++;
            
            var sspos = $scope.geneData.segments[sbin].getDNAPos(1);
//                console.log("sspos " + sspos);
            var str3 = $scope.geneData.segments[sbin].substr(0, sspos) + tagStart + $scope.geneData.segments[sbin].substr(sspos);
//                console.log(str3);
            $scope.geneData.segments[sbin] = str3;
            str = str3;
        }
            
        var tmp2 = segments[ebin];
            
//        console.log("TMP2: " + tmp2);
//            console.log(epos);
            ppos = tmp2.split(/[A-Z]/, epos+1).join('X').length;            
//            console.log(ppos);
            
            var str2 = tmp2.substr(0, ppos) + tagEnd + tmp2.substr(ppos);
//            console.log("S2:"+str2);
            var str5 = str2.replace(/<h5 class="find">([A-Z]*)<div class="exon">/g,'<h5 class="find">$1</h5><div class="exon"><h5 class="find">');
//            console.log("S5:" + str5);
            var str6 = str5.replace(/<h5 class="find">([A-Z]*)<\/div>/g,'<h5 class="find">$1</h5><\/div><h5 class="find">');
//            console.log("S6:" + str6);
            $scope.geneData.segments[ebin] = str6;                                    
            
        
    };
                                      
    this.findDNA = function() {
        $scope.resetMarkup();
        
        var ostr = $scope.formInfo.pos.toUpperCase();
        var coding = $scope.formInfo.coding;
        var str = coding ? $scope.geneData.cds : $scope.geneData.dna;
        var index, startIndex, indices = [];
        var searchStrLen = ostr.length;
        var count = 0;
        
        while ((index = str.indexOf(ostr, startIndex)) > -1) {
            var s = index;
            var e = index + searchStrLen;
            self.markDNAMulti(coding, s, e, 'mark');
            count ++;            
            startIndex = index + searchStrLen;
        }
        self.foundSeq = 'Found '+ count + ' matches';        
    };
    
    // when changing species - change the url of the blast tool                                  
    this.update_blast = function() {
        $scope.formInfo.blast = $scope.formInfo.restServer + self.species + '/Tools/Blast';    
        $("#blast_form").action = $scope.formInfo.blast;
    };
                                      
    // for selecting sequence to send to BLAST
    $scope.currentSelect = { start: -1, stop: -1 };                                          
}]);


myApp.controller('TabController', ['$scope', '$http', '$location', '$anchorScroll', '$window', 
                                   function($scope, $http, $location, $anchorScroll, $window){    
    this.currentTab = '-';
                                       
    var ctrl = this;
    var self = this;
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
        $scope.menu_shown = 0;
        ctrl.menuHide();
        ctrl.clear_select();
    };
    
    this.dblclick = function(e, row, atype) {
        $scope.menu_shown = 0;
        ctrl.menuHide();
        ctrl.clear_select();
    };
    
    this.start_select = function( e, row, atype ) {
        var x = this.getLinePos(e);
        $scope.menu_shown = 0;
        $scope.currentSelect.start = $scope.formInfo.width * row + x;
        ctrl.menuHide();
    };
    
    this.menuHide = function() {
        $("#menuSelect").hide();
    };
                                       
    this.stop_select = function( e, row, atype ) {
   
        var x = this.getLinePos(e);
        $scope.currentSelect.stop = $scope.formInfo.width * row + x;
   
        //console.log("Select " + $scope.currentSelect.start + ' .. ' + + $scope.currentSelect.stop);   
        if ($scope.currentSelect.stop === $scope.currentSelect.start) {
            ctrl.clear_select();
            return ;
        }

        $scope.blast_sequence = getSelectedDNA();
        $("#location").hide();
        $("#menuSelect").css({top: e.clientY + 5, left: e.clientX + 5}).show();
        $scope.menu_shown = 1;
        
    };
    
    this.clear_select = function() {
        $scope.currentSelect.start = -1;
        $scope.currentSelect.end = -1;
        $scope.menu_shown = 0;
    };
                                       
    this.untrack = function() {
        $("#location").hide();
    };

    this.goto_blast = function() {
        ctrl.menuHide();
        ctrl.clear_select();        
        document.blast_form.action = $scope.formInfo.blast;        
        var path = '/blast/ensembl';
        
        if ($scope.blast_type === 'nblast') {
            document.blast_form.action = 'http://www.ncbi.nlm.nih.gov/blast/Blast.cgi';
            path = '/blast/ncbi';
        }
        
        if ($scope.blast_type === 'crispr') {
            document.blast_form.action = 'http://crispr.dbcls.jp';
            path = '/blast/crispr';
        }
        
        if ($window.ga){
            $window.ga('send', 'pageview', { page: path });
        }

        return true;
    };
    
    this.sendto = function(dest) {
        $scope.blast_type = dest;        
        ctrl.goto_blast();
        document.blast_form.submit();
    };
                                           
                                       
    this.track = function(e, row, atype) {
        if ($scope.menu_shown) {
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
    

    $scope.markupExons = function(t) {
        var gStrand = $scope.geneData.strand;
        var gStart = $scope.geneData.start;                    
        var gEnd = $scope.geneData.end;
        var w = $scope.formInfo.width;
        var segments = $scope.geneData.segments;
        var coding = $scope.formInfo.coding;
        
        if (coding) {
            $scope.geneData.segments = segments.map(function(item) {
                return exonStart + item + exonEnd;
            });
            return;
        }
        var s = 0;
        var e = -1;
        //console.log("SEGMENTS : " + segments.length);
        var exons = t.Exon;
        
        for(var i in exons) {
//            console.log( exons[i].start + " - " +  exons[i].end);
            if (coding) {
                e = exons[i].end;
                s = exons[i].start;
            } else {
                s = (gStrand < 0) ? gEnd - t.Exon[i].end : t.Exon[i].start - gStart;
                e = (gStrand < 0) ? gEnd - t.Exon[i].start +1 : t.Exon[i].end - gStart + 1;
            }
            //console.log(t.Exon[i].id + ' : ' + s + ' ... ' + e);
            var sbin = Math.floor(s / w);
            var spos = s % w;
            var ebin = Math.floor(e / w);
            var epos = e % w;
        
            if (coding) {
                console.log(s + '['+sbin+':'+spos+']'+' .. ' + e+ '['+ebin+':'+epos+']');
            }
            var tmp = segments[sbin];
            var str = tmp.substr(0, spos) + exonStart + tmp.substr(spos);
            $scope.geneData.segments[sbin] = str;
            while (sbin < ebin) {
                $scope.geneData.segments[sbin] = $scope.geneData.segments[sbin] + exonEnd;
                sbin++;
                $scope.geneData.segments[sbin] = exonStart + $scope.geneData.segments[sbin];                    
            }
            var tmp = segments[ebin];
            epos = epos + exonStart.length;
            var str = tmp.substr(0, epos) + exonEnd + tmp.substr(epos);
            $scope.geneData.segments[ebin] = str;    
        }       
        
    
    };
                                       
    $scope.markupTranslation = function(t) {
        var url = $scope.formInfo.restServer + '/sequence/id/'+t.pid +'?content-type=application/json';
        
        $http.get(url).success(function(data){
                $scope.geneData.pseq = '-' + data.seq.split('').join('--') + '-';                
                
                var cds = $scope.formInfo.restServer + '/map/cds/'+t.id+'/1..3000000?content-type=application/json';
                $http.get(cds).success(function(data){
                    var pEnd = -1;
                    var pSeq = $scope.geneData.pseq;
                    var gStrand = $scope.geneData.strand;
                    var gStart = $scope.geneData.start;
                    var gEnd = $scope.geneData.end;
                    var pseq = '';
                    var coding = $scope.formInfo.coding;
                    
                    if (coding) {
                        pseq = pSeq;                        
                    } else {
                        var s = 0;
                        var e = -1;
                    
                        for(var i in data.mappings) {
                            if (data.mappings[i].gap === 0) {
                                s = (gStrand < 0) ? gEnd - data.mappings[i].end : data.mappings[i].start - gStart;
                                e = (gStrand < 0) ? gEnd - data.mappings[i].start : data.mappings[i].end - gStart;
                                pseq = pseq + repeat(' ', s - pEnd - 1);
                                var len = e - s + 1;
                            
                                pseq = pseq + pSeq.substr(0, len);
                                pSeq = pSeq.substr(len);
                                pEnd = e;
                            }                                             
                        }
                    }
                    
                    //console.log(mappings);
                    var w = $scope.formInfo.width;
                    var restr = ".{1,"+w+"}";
                    var re = new RegExp(restr,'g');
        
                    var ps = pseq.match(re);
                    $scope.geneData.peptide = pseq;
                    $scope.geneData.psegments = ps;
                    $scope.geneData.isegments = [];
                    
                    // for protein numbering
                    var c = 1;
                    for (var i in ps) {
                        var m = ps[i].split(/[A-Z]/).length - 1;
                        if (m) {
                            $scope.geneData.isegments[i] = c;
                            c = c + m;
                        }
                    }                   
//                    console.log("DATA Z1:" + sizeof($scope.geneData));
                });                    
            });                                            
    };

    this.getCodingSeq = function(t) {
        // get CDS , if you need cdna ( i.e with UTRs ) use CDNA
        var url = $scope.formInfo.restServer + '/sequence/id/'+t.id+'?content-type=application/json;type=cds;mask_feature=1';        
        $http.get(url).success(function(data){
            $scope.geneData.cds = data.seq;
        });
    };
                                       
    this.selectTranscript = function(transcriptId) {
        $scope.clearAllMarkup();
        
        if (transcriptId) {
            this.currentTab = transcriptId;            
        }
        
        var t = $scope.getCurrentTranscript(self);
        
        if (t.pid) {
            self.getCodingSeq(t);
        }
        
        $scope.resetSequence();
        $scope.markupExons(t);
        if (t.pid) {
            $scope.markupTranslation(t);
        }
//        console.log("DATA Z0:" + sizeof($scope.geneData));
    };
                                       
   
    this.isSet = function(tabName){            
        return this.currentTab == tabName;            
    };
                                           
    this.hasTranslation = function() {
        var t = $scope.getCurrentTranscript(self);            
        if (t && t.pid) {
            return true;
        }
        return false;
    }
}]);
