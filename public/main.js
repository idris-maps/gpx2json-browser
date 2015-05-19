var convert = require('./lib/convert.js');

window.data = {};

var inputElement = document.getElementById("input");
inputElement.addEventListener("change", handleFiles, false);
function handleFiles(e) {
	var geojson;
	var fileList = this.files;
	var reader = new FileReader();
	reader.onload = (function(tf) {
		return function(e) { 

			var gpx = e.target.result;
			geojson = convert(gpx, 100);

		}
	})(fileList[0]);
	reader.readAsText(fileList[0]);
	reader.onloadend = function() { 
		data.geojson = geojson;
		download();
		console.log('done');
	}
}

function download() {
	var json = JSON.stringify(data.geojson);
	var blob = new Blob([json], {type: "application/json"});
	var url  = URL.createObjectURL(blob);

	document.getElementById('content').innerHTML = '<a id="dlBtn"><button>Download</button></a>';
	document.getElementById('dlBtn').setAttribute('download', Date.now() + 'geodata.json');
	document.getElementById('dlBtn').setAttribute('href', url);
		
}
