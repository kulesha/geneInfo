var geneFields = ['id', 'start', 'end', 'strand', 'description', 'display_name', 'seq_region_name', 'url'];
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
    
    document.getElementById('copy-button').setAttribute('data-clipboard-text', text);
    
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
myApp.controller('geneSpyCtrl', ['$scope', '$http', '$sce','$location', '$anchorScroll', '$window', '$filter',
                                  function ($scope, $http, $sce, $location, $anchorScroll, $window, $filter) {

    var self = this;
    // to enable html in ng-bind - used in sequence display                                  
    self.trustedHtml = $sce.trustAsHtml(this.textContent);                                    
                                      
    $scope.chunks = [
        { id: 120000, name: '120K'},
        { id: 250000, name: '250K'},
        { id: 400000, name: '400K'}
    ];
                                      
    // by default we'll look for BRCA2, TRDD1 - smallest
    $scope.formInfo = {
        //gene: 'HIST1H4F', 
        //gene: 'BRCA2',
        gene: '',
        width: 100, 
        coding: false, 
        restServer: 'http://rest.ensembl.org',
        eServer: 'http://www.ensembl.org/',
        source: 'egrch37',
        division: 'ensembl',
        chunkSize : 250000        
    };
                                      
    $scope.serverList = [
        { name: 'elatest', division: 'ensembl', label: 'Ensembl ( GRCh38 )' , url: 'http://rest.ensembl.org', eurl: 'http://www.ensembl.org'},
        { name: 'egrch37', division: 'ensembl', label: 'Ensembl ( GRCh37 )' , url: 'http://grch37.rest.ensembl.org', eurl: 'http://grch37.ensembl.org'}
// eg rest is too slow        { name: 'eplants', division: 'plants', label: 'Plants' , url: 'http://rest.ensemblgenomes.org', eurl: 'http://plants.ensembl.org'}
    ];

    $scope.range = function(min, max, step){
        step = step || 1;
        var input = [];
        for (var i = min; i <= max; i += step) input.push(i);
        return input;
    };

                                      
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
        $scope.chunksNum = 0;
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
            if ($scope.geneData.mappings) {
                for (var i in $scope.geneData.mappings) {
                    $scope.geneData.mappings[i] = null;
                }
            }
            
            
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
        $scope.species = 'homo_sapiens';   
        $scope.crispr_db = 'hg19';
        
        $http.get(surl).success(function(sdata ){
            self.speciesList = sdata.species;
        });
        $scope.formInfo.blast = $scope.formInfo.eServer + '/' +$scope.species + '/Tools/Blast';    
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
    
    $scope.extlinks = [
        { id : 'crispr', name: 'CRISPRdirect', url : 'http://crispr.dbcls.jp', stat : '/tool/crispr',
            on : {
                'homo_sapiens' : { 'assembly' : 'GRCh37', 'db' : 'hg19' },
                'mus_musculus' : { 'assembly' : 'GRCm38', 'db' : 'mm10' },
                'rattus_norvegicus' : { 'assembly' : 'Rnor_5.0', 'db' : 'rn5' },
                'sus_scrofa' : { 'assembly' : 'Sscrofa10.2', 'db' : 'calJac3' },
                'callithrix_jacchus': { 'assembly' : 'C_jacchus3.2.1', 'db' : 'susScr3' },
                'gallus_gallus': { 'assembly' : 'Galgal4', 'db' : 'galGal4' },
                'xenopus_tropicalis': { 'assembly' : 'JGI_4.2', 'db' : 'xenTro3' },
                'xenopus_laevis': { 'assembly' : 'JGI_7.1', 'db' : 'Xenla7' }, // not in e!
                'danio_rerio': { 'assembly' : 'Zv9', 'db' : 'danRer7' },
                'ciona_intestinalis':  { 'assembly' : 'JGI_2.1', 'db' : 'ci2' }, // in e! it is KH
                'drosophila_melanogaster': { 'assembly' : 'BDGP R5', 'db' : 'dm3' },
                'caenorhabditis_elegans': { 'assembly' : 'WS220', 'db' : 'ce10' },
                'arabidopsis_thaliana': { 'assembly' : 'TAIR10', 'db' : 'TAIR10' },
                'oryza_sativa': { 'assembly' : 'Os-Nipponbare-Reference-IRGSP-1.0', 'db' : 'rice' },
                'sorghum_bicolor': { 'assembly' : 'Sorghum bicolor v2.1', 'db' : 'sorBic' },            
                'bombyx_mori': { 'assembly' : 'Bmor1', 'db' : 'bmor1' },
                'saccharomyces_cerevisiae': { 'assembly' : 'sacCer3', 'db' : 'sacCer3' },
                'schizosaccharomyces_pombe': { 'assembly' : 'ASM294v2', 'db' : 'pombe' }
            },
            params : {
                'homo_sapiens' : { 'assembly' : 'GRCh37', 'db' : 'hg19' },
                'mus_musculus' : { 'assembly' : 'GRCm38', 'db' : 'mm10' },
                'rattus_norvegicus' : { 'assembly' : 'Rnor_5.0', 'db' : 'rn5' },
                'sus_scrofa' : { 'assembly' : 'Sscrofa10.2', 'db' : 'calJac3' },
                'callithrix_jacchus': { 'assembly' : 'C_jacchus3.2.1', 'db' : 'susScr3' },
                'gallus_gallus': { 'assembly' : 'Galgal4', 'db' : 'galGal4' },
                'xenopus_tropicalis': { 'assembly' : 'JGI_4.2', 'db' : 'xenTro3' },
                'xenopus_laevis': { 'assembly' : 'JGI_7.1', 'db' : 'Xenla7' }, // not in e!
                'danio_rerio': { 'assembly' : 'Zv9', 'db' : 'danRer7' },
                'ciona_intestinalis':  { 'assembly' : 'JGI_2.1', 'db' : 'ci2' }, // in e! it is KH
                'drosophila_melanogaster': { 'assembly' : 'BDGP R5', 'db' : 'dm3' },
                'caenorhabditis_elegans': { 'assembly' : 'WS220', 'db' : 'ce10' },
                'arabidopsis_thaliana': { 'assembly' : 'TAIR10', 'db' : 'TAIR10' },
                'oryza_sativa': { 'assembly' : 'Os-Nipponbare-Reference-IRGSP-1.0', 'db' : 'rice' },
                'sorghum_bicolor': { 'assembly' : 'Sorghum bicolor v2.1', 'db' : 'sorBic' },            
                'bombyx_mori': { 'assembly' : 'Bmor1', 'db' : 'bmor1' },
                'saccharomyces_cerevisiae': { 'assembly' : 'sacCer3', 'db' : 'sacCer3' },
                'schizosaccharomyces_pombe': { 'assembly' : 'ASM294v2', 'db' : 'pombe' }
            },
         
        },
        { id : 'nblast', name: 'BLAST(ncbi)', url : 'http://www.ncbi.nlm.nih.gov/blast/Blast.cgi', stat : '/tool/nblast', 'all' : 1 },
        { id : 'eblast', name: 'BLAST(ensembl)', url : $scope.formInfo.blast, stat : '/tool/eblast', 'all' : 1 }
    ];

/* some tools don;t work for all available species : this function checks if the tool is available for the current species/assembly */                                      
    $scope.valid_link = function(link_id) {        
        var tool;
        for (var i in $scope.extlinks) {
            if ($scope.extlinks[i].id == link_id) {
                tool = $scope.extlinks[i];
                break;
            }
        }
        if ( tool ) {
            if (tool.all) {
                return true;
            }
            
            if (tool.on) {
                var tool_assembly = tool.on[$scope.species].assembly;
                var sobj;
                for (var i in self.speciesList) {
                    if (self.speciesList[i].name == $scope.species) {
                        sobj = self.speciesList[i];
                        break;
                    }
                }
                
                if (sobj && sobj.assembly == tool_assembly) {                
                    return true;
                }
            }
        }        
        return false;
    };
                                      
    $scope.findGene = function() {
        self.reset();

        $scope.loading = true;
        
        var gene = $scope.formInfo.gene.toUpperCase();
        
        $scope.message = "Looking for " + gene;
        
        self.recordVisit($scope.formInfo.source+'/gene/'+gene);
    
        // first we look for the gene
        var url = $scope.formInfo.restServer + '/lookup/symbol/'+$scope.species+'/' + gene + '?content-type=application/json;expand=1';
                
        $http.get(url).success(function(data){
            // hooray - we have found the gene
            data.url = $scope.formInfo.eServer + '/' + $scope.species + '/Gene/Summary?g=' + data.id;
            
            geneFields.map(function(item) {
                $scope.geneData[item] = data[item];
            });
            
            var seqlen =  data.end - data.start+ 1;
            $scope.geneData.seqlen = seqlen;
            var chunkSize = $scope.formInfo.chunkSize;           
            
            if (seqlen > chunkSize) {
                $scope.chunksNum = Math.floor(seqlen / chunkSize) + 1;
            }
            
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

            $scope.setPage(1);
            
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
            if ($scope.geneData.Transcript[i].id === $scope.currentTab) {
                t = $scope.geneData.Transcript[i];
            }
        }
        return t;
    };
    
    this.getExonNumber = function(gene, t, pos) {
        var exons = t.Exon;
        var i = 0;
            
        if (gene.strand === -1) {
            var aStart = gene.end - pos;
            for (var j in exons) {
                if (exons[j].end >= aStart) {
                    i++;
                }
            }
        } else {
            var aStart = pos + gene.start;            
            for (var j in exons) {
                if (exons[j].start <= aStart) {
                    i++;
                }
            }
        }            
        return { bp : aStart, exon : i};
    };
            
    $scope.getBPfromAA = function(aa) {
        
        var coding = $scope.formInfo.coding;        
        var aapos = [];
        
        if (coding) {
            aapos.push((aa - 1) * 3); 
            aapos.push((aa - 1) * 3 + 1); 
            aapos.push((aa - 1) * 3 + 2); 
            return aapos;
        }
        
        var gStrand = $scope.geneData.strand;
        var gStart = $scope.geneData.start;
        var gEnd = $scope.geneData.end;
        var bppos = (aa  - 1 ) * 3 + 1;
                    
        var mappings = $scope.geneData.mappings;
        var s, e;
        var curpos = 0;
        
        
        
        for(var i in mappings) {
            if (mappings[i].gap === 0) {
                s = (gStrand < 0) ? gEnd - mappings[i].end : mappings[i].start - gStart;
                e = (gStrand < 0) ? gEnd - mappings[i].start : mappings[i].end - gStart;

                curpos ++;
                var es = curpos + e - s;
                
                while (aapos.length < 3) {
                    if (bppos >= curpos  && bppos <= es) {
                        var xpos = s + bppos - curpos;
                        aapos.push(xpos);
                        bppos ++;
                    } else {
                        break;
                    }
                }
                
                if (aapos.length == 3) {
                    return aapos;
                }
                curpos = es;
            }
        }
        return aapos;
    };
                                      
    $scope.findAA = function(tab) {
        $scope.resetFound();
        var ipos = $scope.formInfo.pos; //parseInt($scope.formInfo.pos.replace(/\,/g, ''));        
        if (! ipos) { // this will be set only if validation passes in html
            return;
        }
                
        var t = $scope.getCurrentTranscript(tab);        
        
        if (ipos > (t.plen % 100000)) {
            self.foundSeq = 'Length is only ' + (t.plen % 100000) + ' aa';
            return;
        }
        
        
        if (t && t.pid) {            
            var bp = $scope.getBPfromAA(ipos);
            
            var chunkSize = $scope.formInfo.chunkSize;
            var iposPage = $scope.chunksNum ? Math.ceil(bp[1] / chunkSize) : 1;
        
            if (iposPage !== $scope.geneData.currentPage) {
                $scope.setPage(iposPage, $scope.findAA);            
            }
        
            var gpos = bp.map(function(item) {
                return item - chunkSize * ($scope.geneData.currentPage - 1);
            });

            var aaPos = gpos[1];            
            
            // now mark the AA - only the letter
            var w = $scope.formInfo.width;            
            var sbin = Math.floor(aaPos / w);
            var spos = aaPos % w;
            
            var binseq = $scope.geneData.psegments[sbin];
            if (binseq) {                             
            // first find the letter                                                         
                var str = binseq.substr(0, spos) + foundStart + binseq.substr(spos, 1) + foundEnd + binseq.substr(spos+1);
                $scope.geneData.psegments[sbin] = str;
                $location.hash('a_'+sbin);            
            
            var foundExtra = '';
            var bpPos = self.getExonNumber($scope.geneData, t, bp[0]);

            foundExtra = '<div style="margin:0">at ' + $filter('number')(bpPos.bp) + " bp</div>";
            if (gpos[2] - gpos[0] == 2) {
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
            var binnum = $scope.geneData.segments.length;
            
            for(var i in gpos) {
                if (gpos[i] > 0) {
                    var sbin = Math.floor(gpos[i] / w);
                    var spos = gpos[i] % w;
                    if (sbin < binnum ) {                    
                        $scope.currentAA.push(sbin);                
                        var binseq = $scope.geneData.segments[sbin];
                        var pos = binseq.getDNAPos(spos+1);
                        var str = binseq.substr(0, pos) + foundStart + binseq.substr(pos, 1) + foundEnd + binseq.substr(pos+1);
                        $scope.geneData.segments[sbin] = str;                        
                    }
                }
            }
            }
        }        
    };

                                      
    $scope.findBP = function() {
        $scope.resetFound();
        var ipos = $scope.formInfo.pos; //parseInt($scope.formInfo.pos.replace(/\,/g, ''));
        
        if (! ipos) { // this will be set only if validation passes in html
            return;
        }

        var w = $scope.formInfo.width;
        
        var coding = $scope.formInfo.coding;
        var sequence = coding ? $scope.geneData.cds : $scope.geneData.dna;
        if (ipos > $scope.geneData.seqlen) {
            self.foundSeq = 'Length is only ' + $scope.geneData.seqlen + ' bp';
            return;
        }
        var chunkSize = $scope.formInfo.chunkSize;
        var iposPage = $scope.chunksNum ? Math.ceil(ipos / chunkSize) : 1;
        
        if (iposPage !== $scope.geneData.currentPage) {
            $scope.setPage(iposPage, $scope.findBP);            
        }
        
        ipos -= chunkSize * ($scope.geneData.currentPage - 1);
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

    $scope.setPage = function(page, callback) {
        var data = $scope.geneData;
        var chunkSize = $scope.formInfo.chunkSize;
                
        $scope.loading = true;
            
            // now let's get the sequence
        var seqStart, seqEnd;
        
        if (data.strand > 0) {
            seqStart = data.start + chunkSize * (page -1);
            seqEnd = chunkSize ? (seqStart + chunkSize -1) : data.end;
            if (seqEnd > data.end) {
                seqEnd = data.end;
            }
        } else {
            seqEnd = data.end - chunkSize * (page -1);
            seqStart = chunkSize ? (seqEnd - chunkSize +1) : data.start;
            if (seqStart < data.start) {
                seqStart = data.start;
            }
        }
        
        $scope.geneData.currentPage = page;
        $scope.geneData.seqStart = seqStart;
        $scope.geneData.seqEnd = seqEnd;
     
        var surl = $scope.formInfo.restServer + '/sequence/region/'+$scope.species+'/' + data.seq_region_name + ':' + seqStart + '..' + seqEnd + ':'+data.strand+'?content-type=application/json';
        $http.get(surl).success(function(seq){                                
            var w = $scope.formInfo.width;
            var restr = ".{1,"+w+"}";
            var re = new RegExp(restr,'g');
                
            var s = seq.seq.match(re);
                
            $scope.geneData.dna = seq.seq;
            $scope.geneData.segments = s;
                
            $scope.loading = false;  
            var gene = $scope.formInfo.gene.toUpperCase();
            $location.path("gene\/"+ gene);
            if ($scope.geneData.currentTranscript) {
                $scope.selectTranscript($scope.geneData.currentTranscript,callback);
            } else {           
                if (callback) { // in case of some operations we need to load a new chunk and then do something, e.g jump to a position
                    console.log( "call callback" );
                    callback();
                }
            }
            
        });
            
        $scope.message = '';            
        
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

    $scope.selectTranscript = function(transcriptId, callback) {
        $scope.clearAllMarkup();

        if (transcriptId) {
            $scope.currentTab = transcriptId;            
        }
        
        var t = $scope.getCurrentTranscript(self);
        
        $scope.geneData.currentTranscript = t.id;
        
        if (t.pid) {
            $scope.getCodingSeq(t);
        }
        
        $scope.resetSequence();
        $scope.markupExons(t);
        if (t.pid) {
            $scope.markupTranslation(t, callback);
        } else {
            if (callback) {
                callback();
            }
        }
//        console.log("DATA Z0:" + sizeof($scope.geneData));
    };

    $scope.getCodingSeq = function(t) {
        // get CDS , if you need cdna ( i.e with UTRs ) use CDNA
        var url = $scope.formInfo.restServer + '/sequence/id/'+t.id+'?content-type=application/json;type=cds;mask_feature=1';        
        $http.get(url).success(function(data){
            $scope.geneData.cds = data.seq;
        });
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
        $scope.formInfo.blast = $scope.formInfo.restServer + '/' + $scope.species + '/Tools/Blast';    
        $scope.crispr_db = $scope.extlinks[0].params[$scope.species].db;        
        $("#blast_form").action = $scope.formInfo.blast;
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
        
        var seqStart = $scope.geneData.seqStart;
        var seqEnd = $scope.geneData.seqEnd;
        var chunkSize = $scope.formInfo.chunkSize;
        var offset =  chunkSize * ($scope.geneData.currentPage - 1);
        
        for(var i in exons) {
//            console.log( exons[i].start + " - " +  exons[i].end);
            
            if ((exons[i].start > seqEnd) || (exons[i].end < seqStart)) {
                continue;
            }
            if (coding) {
                e = exons[i].end;
                s = exons[i].start;
            } else {
                s = (gStrand < 0) ? gEnd - t.Exon[i].end : t.Exon[i].start - gStart;
                e = (gStrand < 0) ? gEnd - t.Exon[i].start +1 : t.Exon[i].end - gStart + 1;
            }

            
            s = s - offset;
            if (s < 0) {
                s = 0;
            }
            e = e - offset;
            if ( e >= chunkSize) {
                e = chunkSize -1;
            }
            
            //console.log(t.Exon[i].id + ' : ' + s + ' ... ' + e);
            var sbin = Math.floor(s / w);
            var spos = s % w;
            var ebin = Math.floor(e / w);
            var epos = e % w;
        
            //console.log(s + '['+sbin+':'+spos+']'+' .. ' + e+ '['+ebin+':'+epos+']');
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
            
            if (epos >= tmp.length -1) { // if we need to mark up the line to the end
                str = tmp + exonEnd;
            } else {            
                str = tmp.substr(0, epos) + exonEnd + tmp.substr(epos);
            }
            $scope.geneData.segments[ebin] = str;    
        }       
        
    
    };
    $scope.markupTranslation = function(t, callback) {
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
                    var chunkSize = $scope.formInfo.chunkSize ;
                    var offset = chunkSize * ($scope.geneData.currentPage - 1);
                    // pOffset to count how much of the coding sequence is on the previous pages and then used to trim the protein sequence
                    // pidOffset will remember pOffset value for sequence numbering later
                    var pOffset = 0, pidOffset = 0;
                    
                    $scope.geneData.mappings = data.mappings;
                    
                    if (coding) {
                        pseq = pSeq;                        
                    } else {
                        var s = 0;
                        var e = -1;
                        
                        for(var i in data.mappings) {
                            if (data.mappings[i].gap === 0) {
                                s = (gStrand < 0) ? gEnd - data.mappings[i].end : data.mappings[i].start - gStart;
                                e = (gStrand < 0) ? gEnd - data.mappings[i].start : data.mappings[i].end - gStart;
                                //console.log( '# ' + s + ' .. ' + e);
                                if (e < offset) { // exon is on previous pages
                                    pOffset = pOffset + ( e - s + 1); 
                                    continue;
                                }
                                
                                if ( s < offset ) { 
                                    // exon starts on the previous page - let's count how many nucleotides it has
                                    pOffset = pOffset + ( offset - s );
                                    s = offset;
                                }
                                
                                s = s - offset;
                                if (s > chunkSize) { // exon is on the following pages
                                    continue;
                                }
                                
                                e = e - offset;
                                if (e >= chunkSize) { // exon ends on the following page
                                    e = chunkSize -1;
                                }
                                pseq = pseq + repeat(' ', s - pEnd - 1);
                                var len = e - s + 1;
                                if (pOffset) { 
                                    pSeq = pSeq.substr(pOffset);
                                    pidOffset = pOffset;
                                    pOffset = 0;
                                }
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
//                    $scope.geneData.peptide = pseq;
//                    $scope.geneData.peplen = pseq.length;

                    $scope.geneData.psegments = ps;
                    $scope.geneData.isegments = [];
                    
                    // for protein numbering
                    var c = 1;
                    if (pidOffset) { // there are some AA on the previous pages 
                        c = c +  Math.ceil(pidOffset / 3) ;
                    }
                    for (var i in ps) {
                        var m = ps[i].split(/[A-Z]/).length - 1;
                        if (m) {
                            $scope.geneData.isegments[i] = c;
                            c = c + m;
                        }
                    }                   
//                    console.log("DATA Z1:" + sizeof($scope.geneData));
                    if (callback) {
                        callback();
                    }
                });                    
            });                                            
    };
                                      
    // for selecting sequence to send to BLAST
    $scope.currentSelect = { start: -1, stop: -1 };                                          
}]);


myApp.controller('TabController', ['$scope', '$http', '$location', '$anchorScroll', '$window', '$filter', 
                                   function($scope, $http, $location, $anchorScroll, $window, $filter){    
    $scope.currentTab = '-';
                                       
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
    
    this.sendto = function(dest, tool) {               
        ctrl.menuHide();
        ctrl.clear_select();        
        document.blast_form.action = $scope.formInfo.blast;        // in case it is one of ensembl servers

        if (tool.url) {
            document.blast_form.action = tool.url;            
        }
                
        if ($window.ga){
            path = tool.stat;
            $window.ga('send', 'pageview', { page: path });
        }
        
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
            var offset = $scope.chunksNum ? ($scope.geneData.currentPage -1) * $scope.formInfo.chunkSize : 0;
            
            var pos = row * $scope.formInfo.width + rowpos + offset;
            var genomic = $scope.geneData.strand > 0 ? $scope.geneData.start + pos -1 : $scope.geneData.end - pos + 1;
            $scope.location = $filter('number')(pos) + " " + ' [' + $filter('number')(genomic) + ' bp]';
        }
        $("#location").css({top: e.clientY + 10, left: e.clientX + 20}).show();
    };

                                       
                                                                      
   
    this.isSet = function(tabName){            
        return $scope.currentTab == tabName;            
    };
                                           
    this.hasTranslation = function() {
        var t = $scope.getCurrentTranscript(self);            
        if (t && t.pid) {
            return true;
        }
        return false;
    }
}]);
