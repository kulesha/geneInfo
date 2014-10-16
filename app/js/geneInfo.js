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

var geneFields = ['start', 'end', 'strand', 'description', 'display_name', 'seq_region_name'];
var exonStart = "<div class='exon'>";
var exonEnd = "</div>";

// Define the app, ngSanitize is needed to enable passing plain html into ng-repeat
var myApp = angular.module('geneInfoApp', ['ngSanitize', 'ui.bootstrap']) .filter('baseCount', function() {    
        return function(input) { 
            if (input) {
                return input.split(re).length -1;                
            }
            return 0;
        }
    });
    
// main controller - it accepts the input gene name and fetches the gene info
myApp.controller('geneInfoCtrl', ['$scope', '$http', '$sce','$location', '$anchorScroll', '$window', 
                                  function ($scope, $http, $sce, $location, $anchorScroll, $window) {

    var self = this;
    // to enable html in ng-bind - used in sequence display                                  
    self.trustedHtml = $sce.trustAsHtml(this.textContent);                                    
                                      
    // by default we'll look for BRCA2, HIST1H4F - smallest
    $scope.formInfo = {
        //gene: 'HIST1H4F', 
        //gene: 'BRCA2',
        
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
    
                                      
    this.reset = function() {
        $scope.message = '';
        $scope.location = 0;
        if ($scope.geneData) {
            for (var i in $scope.geneData) {
                $scope.geneData[i] = '';
            }
        }
        $scope.geneData = {};
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
                                          

    this.resetForm = function() {
        self.foundSeq = '';
        $scope.currentpTag = -1;
        $scope.currentTag = -1;
        $scope.currentpcTag = -1;
        $scope.currentcTag = -1;    
        $scope.geneInfo = {};
    };
                                      
    this.updateSpecies = function() {                                  
        var surl = $scope.formInfo.restServer + '/info/species?content-type=application/json;division='+$scope.formInfo.division;                                   
        self.species = 'homo_sapiens';   
        $http.get(surl).success(function(sdata ){
            self.speciesList = sdata.species;
        });
        $scope.formInfo.blast = $scope.formInfo.eServer + self.species + '/Tools/Blast';    
        self.resetForm(); 
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
                                          
                                      
    self.getFontWidth();                                                              
    self.updateServer();                                      
    self.recordVisit("/");
                                      

                                      
    // function that will be called on form submit
    this.findGene = function() {
        self.reset();
        $scope.loading = true;
        
        
        $scope.geneInfo = {};
        
        var gene = $scope.formInfo.gene.toUpperCase();
        $scope.message = "Looking for " + gene;

        self.recordVisit($scope.formInfo.source+'/gene/'+gene);
    
        
        $scope.formInfo.coding = false;
        $scope.clearTags();
        
        // first we look for the gene
        var url = $scope.formInfo.restServer + '/lookup/symbol/'+self.species+'/' + gene
                + '?content-type=application/json;expand=1';
            
        $http.get(url).success(function(data){
            // hooray - we have found the gene
            $scope.geneInfo = data;
            if ($scope.geneInfo.strand === 1) {
                $scope.geneInfo.strand_str = 'forward';
            } else {
                $scope.geneInfo.strand_str = 'reverse';
            }
            
            $scope.geneInfo.url = $scope.formInfo.eServer + '/'+self.species+'/Gene/Summary?g=' + data.id;
            $scope.loading = true;
            
            // now let's get the sequence
            var surl = $scope.formInfo.restServer + '/sequence/region/'+self.species+'/' + data.seq_region_name + ':' + data.start + '..' + data.end + ':'+data.strand+'?content-type=application/json';
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
            $scope.message = '';
            
        }).error(function(data, status, header, config){
            if (status === 400) {
                $scope.message = data.error;
            }
            $scope.loading = false;
        });
        
    };
                                      
                                      
                                      
    $scope.baseCount = function(str) {
        if(str) {            
            return str.split(/[A-Z]/).length - 1;
        }
        return 1;
    };
          
                                      

        
                                      
    // the rest api call will fill this object
    $scope.geneInfo = {}; 

    
                                      
    
    $scope.currentSelect = { start: -1, stop: -1 };                                  
    
    
    var ctrl = this;
    
                                      
                           
    
                                      
    // when changing species - change the url of the blast tool                                  
    this.update_blast = function() {
        $scope.formInfo.blast = $scope.formInfo.restServer + ctrl.species + '/Tools/Blast';    
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
        if (t.Translation) {
            t.plen = t.Translation.length;
            if (t.is_canonical === "1") { // longest coding sequence is 80K
                t.plen += 100000;
            }
        } else {
            t.plen = 0;
        }
    };
                                      
    
                                      
    this.findBP = function(tab) {
        $scope.clearTags();
        var ipos = $scope.formInfo.pos; //parseInt($scope.formInfo.pos.replace(/\,/g, ''));
        
        if (! ipos) { // this will be set only if validation passes in html
            return;
        }

        var w = $scope.formInfo.width;
        
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
        
        var ipos = $scope.formInfo.pos; //parseInt($scope.formInfo.pos.replace(/\,/g, ''));
        
        if (! ipos) { // this will be set only if validation passes in html
            return;
        }

        
        var t;
        for(var i in $scope.geneInfo.Transcript) {
            if ($scope.geneInfo.Transcript[i].id === tab.currentTab) {
                t = $scope.geneInfo.Transcript[i];
            }
        }
            
        if (t && t.Translation) {
            var coding = $scope.formInfo.coding;
     
            var tmp = coding ? t.pseq : t.ppseq;
//            console.log(t);
            if (ipos > t.Translation.length) {
                ctrl.foundSeq = 'Length is only ' + t.Translation.length + ' aa';
                return;
            }
            
            var w = $scope.formInfo.width;
            // first find the letter
            var ppos = tmp.split(/[A-Z]/, ipos).join('X').length;          
            // then find the preceeding - and then following - ( as the AA can be split between exons )
            var pposA = tmp.split(/\-/, ipos*2-1).join('X').length;          
            var pposB = tmp.split(/\-/, ipos*2).join('X').length;          
            var gpos = [pposA, ppos, pposB];

//            console.log(gpos);
            var sbin = Math.floor(ppos / w);
            var spos = ppos % w;
            var tagStart = '<span class="tag">';
            var tagEnd = '</span>';
    
            var tmp2 = coding ? $scope.geneInfo.pcsegments[sbin] : $scope.geneInfo.psegments[sbin];
            var str = tmp2.substr(0, spos) + tagStart + tmp2.substr(spos, 1) + tagEnd + tmp2.substr(spos+1);

            var foundExtra = '';
            
            if (coding) {
                $scope.geneInfo.pcsegments[sbin] = str;
                $scope.currentpcTag = sbin;        
                $location.hash('b_'+sbin);
            } else {
                $scope.geneInfo.psegments[sbin] = str;
                $scope.currentpTag = sbin;   
                $location.hash('a_'+sbin);            
                if ($scope.geneInfo.strand === -1) {
                    var aStart = $scope.geneInfo.end - pposA;
                    var i = 0;
                    var exons = t.Exon;
                    for (var j in exons) {
                        if (t.Exon[j].end >= aStart) {
                            i++;
                        }
                    }
                } else {
                    var aStart = pposA + $scope.geneInfo.start;
                    var i = 0;
                    var exons = t.Exon;
                    for (var j in exons) {
                        if (t.Exon[j].start <= aStart) {
                            i++;
                        }
                    }
                }
                
                foundExtra = '<div style="margin:0">at ' + aStart + " bp</div>";
                if (pposB - pposA == 2) {
                    foundExtra = foundExtra + 'in exon ' + i;
                } else {
                    foundExtra = foundExtra + 'in exons ' + i + ' and ' + (i+1);
                }
            
            }
            $anchorScroll();            
            
            var tmp3 = coding ? t.cdna : $scope.geneInfo.sequence.seq;
            var str3 = tmp3.substr(gpos[0], 1) + tmp3.substr(gpos[1], 1) + tmp3.substr(gpos[2], 1);
            
            var resStr = "Found aa: " + tmp2.substr(spos, 1) + " = " + str3 + foundExtra; 
                
            
            ctrl.foundSeq = resStr;
            // now let's find the exon number
            
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
            
    this.clearMarkup = function() {
        var coding = $scope.formInfo.coding;
        if (coding) {
            for (var i in $scope.geneInfo.csegments) {
                var tmp = $scope.geneInfo.csegments[i];
                var re = new RegExp('\<h5 class=\"find\">','g');
                var re2 = new RegExp('\<\/h5\>','g');
                var tmp2 = tmp.replace(re, '');
                var tmp3 = tmp2.replace(re2, '');
                $scope.geneInfo.csegments[i] = tmp3;            
            }
        } else {
            for (var i in $scope.geneInfo.segments) {
                var tmp = $scope.geneInfo.segments[i];
                var re = new RegExp('\<h5 class=\"find\">','g');
                var re2 = new RegExp('\<\/h5\>','g');
                var tmp2 = tmp.replace(re, '');
                var tmp3 = tmp2.replace(re2, '');
                $scope.geneInfo.segments[i] = tmp3;            
            }
        }
        
    };

    this.OldclearMarkup = function() {
        var coding = $scope.formInfo.coding;
        if (coding) {
            for (var i in $scope.geneInfo.csegments) {
                var tmp = $scope.geneInfo.csegments[i];
                var re = new RegExp('\<h5 class=\"find\">(.+)<\/h5>','g');
                var tmp2 = tmp.replace(re, "$1");
                $scope.geneInfo.csegments[i] = tmp2;            
            }
        } else {
            for (var i in $scope.geneInfo.segments) {
                var tmp = $scope.geneInfo.segments[i];
                var re = new RegExp('\<h5 class=\"find\">(.+)<\/h5>','g');
                var tmp2 = tmp.replace(re, "$1");
                $scope.geneInfo.segments[i] = tmp2;            
            }
        }
        
    };
                                      
                                      
    this.markDNAMulti = function(coding, s, e, mark) {
        var w = $scope.formInfo.width;
        var sbin = Math.floor(s / w);
        var spos = s % w;
        var ebin = Math.floor(e / w);
        var epos = e % w;
  //      console.log(s + ' ... ' + e);
//        console.log(" * " + sbin + ' [' + spos + ']' + '..' + ebin + ' [' + epos + ']');            
        
        var tagStart = '<h5 class="find">';
        var tagEnd= '</h5>';
        
        var segments;
        var tmp;
        
        if (coding) {
            segments = $scope.geneInfo.csegments;
            
        } else {
            segments = $scope.geneInfo.segments;            
        }
        tmp = segments[sbin];        
        var ppos = tmp.split(/[A-Z]/, spos+1).join('X').length;            
//        console.log(ppos);
        var str = tmp.substr(0, ppos) + tagStart + tmp.substr(ppos);
//        console.log(str);
            
        if (coding) {
            $scope.geneInfo.csegments[sbin] = str;
        } else {
            $scope.geneInfo.segments[sbin] = str;
        }
            
        while (sbin < ebin) {
//            console.log( "SBIN : " + sbin);
            var epos2 = str.split(/[A-Z]/, w).join('X').length +1;            
//            console.log("epos " + epos2);
                
            var str2 = str.substr(0, epos2) + tagEnd + str.substr(epos2);
//            console.log(str2);
        
                   
            var str5 = str2.replace(/<h5 class="find">([A-Z]*)<div class="exon">/g,'<h5 class="find">$1</h5><div class="exon"><h5 class="find">');
                //console.log("S5:" + str5);
            var str6 = str5.replace(/<h5 class="find">([A-Z]*)<\/div>/g,'<h5 class="find">$1</h5><\/div><h5 class="find">');
        
            
            if (coding) {
                $scope.geneInfo.csegments[sbin] = str6;
            } else {
                $scope.geneInfo.segments[sbin] = str6;
            }
            sbin++;
            
            if (coding) {
                var sspos = $scope.geneInfo.csegments[sbin].split(/[A-Z]/, 1).join('X').length;
//                console.log("sspos " + sspos);
                var str3 = $scope.geneInfo.csegments[sbin].substr(0, sspos) + tagStart + $scope.geneInfo.csegments[sbin].substr(sspos);
//                console.log(str3);
                $scope.geneInfo.csegments[sbin] = str3;
                str = str3;
            } else {
                var sspos = $scope.geneInfo.segments[sbin].split(/[A-Z]/, 1).join('X').length;
//                console.log("sspos " + sspos);
                var str3 = $scope.geneInfo.segments[sbin].substr(0, sspos) + tagStart + $scope.geneInfo.segments[sbin].substr(sspos);
//                console.log(str3);
                $scope.geneInfo.segments[sbin] = str3;
                str = str3;
            }
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
            if (coding) {
                $scope.geneInfo.csegments[ebin] = str6;                                    
            } else {
                $scope.geneInfo.segments[ebin] = str6;                                    
            }
        
        
    };

// to mark the whole matched substring is not trivial as markups clash especially on the edge of exon/intron
// lets see if just marking the first matched char will suffice                                      
    this.markDNA = function(coding, s, e, mark) {
        var w = $scope.formInfo.width;
        var sbin = Math.floor(s / w);
        var spos = s % w;
        var ebin = Math.floor(e / w);
        var epos = e % w;
//        console.log(" * " + sbin + ' [' + spos + ']' + '..' + ebin + ' [' + epos + ']');            
        
        var tagStart = '<h5 class="find">';
        var tagEnd= '</h5>';
        
            
        if (coding) {
        } else {
            var segments = $scope.geneInfo.segments;
            var tmp = segments[sbin];
            var ppos = tmp.split(/[A-Z]/, spos+1).join('X').length;            
            var str = tmp.substr(0, ppos) + tagStart + tmp.substr(ppos, 1) + tagEnd + tmp.substr(ppos+1);            
            $scope.geneInfo.segments[sbin] = str;
            
        }
        
    };
    
                                      
    this.findDNA = function() {
        self.clearMarkup();
        
        var ostr = $scope.formInfo.pos.toUpperCase();
        var coding = $scope.formInfo.coding;
        var str = coding ? $scope.geneInfo.cdna : $scope.geneInfo.sequence.seq;
        var index, startIndex, indices = [];
        var searchStrLen = ostr.length;
        var w = $scope.formInfo.width;
        var tagStart = '<h5 class="mark">';
        var tagEnd= '</h5>';
        var count = 0;
        
        while ((index = str.indexOf(ostr, startIndex)) > -1) {
            var s = index;
            var e = index + searchStrLen;
            self.markDNAMulti(coding, s, e, 'mark');
            count ++;            
            startIndex = index + searchStrLen;
        }
        ctrl.foundSeq = 'Found '+ count + ' matches';        
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


myApp.controller('TabController', ['$scope', '$http', '$location', '$anchorScroll', '$window', 
                                   function($scope, $http, $location, $anchorScroll, $window){    
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

        var exonStart = '<div class="exon">';
        var exonEnd = '</div>';

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
            var purl = $scope.formInfo.restServer + '/sequence/id/'+t.Translation.id +'?content-type=application/json';
            
            
            $http.get(purl).success(function(data){
                t.protein = data.seq;
                t.pseq = '-' + data.seq.split('').join('--') + '-';
            
                var curl = $scope.formInfo.restServer + '/sequence/id/'+t.id+'?content-type=application/json;type=cds';
            
                $http.get(curl).success(function(data){
                    t.cdna = data.seq;
                    var w = $scope.formInfo.width;
                    var restr = ".{1,"+w+"}";
                    var re = new RegExp(restr,'g');
        
                    var ps = data.seq.match(re);
                    
                    $scope.geneInfo.cdna = t.cdna;
                    
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
            
                
                var cds = $scope.formInfo.restServer + '/map/cds/'+t.id+'/1..3000000?content-type=application/json';
                $http.get(cds).success(function(data){
                    var pEnd = -1;
                    var pSeq = t.pseq;
                    var pseq = '';
                    //var mappings = [];        
                    for(var i in data.mappings) {
                        if (data.mappings[i].gap === 0) {
                            var s = (strand < 0) ? gEnd - data.mappings[i].end : data.mappings[i].start - gStart;
                            var e = (strand < 0) ? gEnd - data.mappings[i].start : data.mappings[i].end - gStart;
                            pseq = pseq + repeat(' ', s - pEnd - 1);
                            var len = e - s + 1;
                            
                            //var a = [s, e];
                            //console.log(a);
                            //mappings.push(a);
                            pseq = pseq + pSeq.substr(0, len);
                            pSeq = pSeq.substr(len);
                            pEnd = e;
                        }                                             
                    }
                    
                    t.ppseq = pseq;
                    //console.log(mappings);
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
