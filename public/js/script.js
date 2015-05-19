(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var distance = require('turf-distance');

module.exports = function(gpx, segInMeters) {
	var allPoints = gpx2json(gpx);
	var withoutDuplicates = removeDuplicates(allPoints);
	var withDist = addDist(withoutDuplicates);
	var withSeg = addSegment(withDist, segInMeters);
	var segments = createSegments(withSeg, segInMeters);
	var segMinMax = findMinMax(withSeg, segments);
	var segPoints = calcSegPoint(segMinMax,withoutDuplicates, segInMeters);
	return toLines(segPoints, segInMeters);
}

function toLines(geojson, segInMeters) {
	var newGeojson = {
		"type": "FeatureCollection",
    	"features": []
	}
	for(i=0;i<geojson.features.length;i++) {
		if(i != 0) {
			var prev = geojson.features[i - 1];
			var feat = geojson.features[i];
			newGeojson.features.push({
				"type": "Feature",
				"geometry": {
					"type": "LineString",
					"coordinates": [prev.geometry.coordinates, feat.geometry.coordinates]
				},
				"properties": {
					"id": feat.properties.id,
					"dist": feat.properties.dist,
					"pcElev": (feat.properties.elev - prev.properties.elev) * 100 / segInMeters,
					"elev": feat.properties.elev
				}
			
			})
		}
	}
	return newGeojson;
}

function calcSegPoint(segments, features, segInMeters) {
	var geojson = {
		"type": "FeatureCollection",
    	"features": []
	}
	for(i=0;i<segments.length;i++) {
		if(i == 0) {
			geojson.features.push({
				"type": "Feature",
				"geometry": {
					"type": "Point",
					"coordinates" : [
						features[0].geometry.coordinates[0],
						features[0].geometry.coordinates[1]
					]
				},
				"properties": {
					"id": 0,
					"dist": 0,
					"elev": features[0].properties.ele
				}								
			})
		} else {
			var nextPt; 
			var prevPt;
			for(j=0;j<features.length;j++) {
				var feat = features[j];
				if(feat.properties.id == segments[i].minPt) {
					nextPt = feat;
				}
				if(feat.properties.id == segments[i-1].maxPt) {
					prevPt = feat;
				}
			}
			var point = {
				"type": "Feature",
				"geometry": {
					"type": "Point",
					"coordinates" : [
						(+prevPt.geometry.coordinates[0] + +nextPt.geometry.coordinates[0]) / 2,
						(+prevPt.geometry.coordinates[1] + +nextPt.geometry.coordinates[1]) / 2,
					]
				},
				"properties" : {
					"id": segments[i].seg,
					"dist": segments[i].seg * segInMeters,
					"elev": (+prevPt.properties.ele + +nextPt.properties.ele) / 2
				}
			}
			geojson.features.push(point)
		}
	}
	return geojson
}

function findMinMax(features, segments) {
	for(i=0;i<features.length;i++) {
		var feat = features[i];
		for(j=0;j<segments.length;j++) {
			if(feat.properties.seg == segments[j].seg) {
				if(segments[j].maxPt == null) { segments[j].maxPt =  feat.properties.id; }
				if(segments[j].minPt == null) { segments[j].minPt =  feat.properties.id; }
				if(segments[j].maxPt < feat.properties.id) { segments[j].maxPt = feat.properties.id; }
				if(segments[j].minPt > feat.properties.id) { segments[j].minPt = feat.properties.id; }
			}
		}
	}
	return segments;
}

function createSegments(features, meters) {
	var maxDist = features[features.length - 1].properties.seg;
	var segs = [];
	for(i=0;i<maxDist + 1;i++) {
		segs.push({seg: i, maxPt: null, minPt: null})
	}
	return segs;
}

function addSegment(features, meters) {
	for(i=0;i<features.length;i++) {
		var feature = features[i];
		feature.properties.seg = Math.floor(feature.properties.dist * (1000/meters));
	}
	return features;
}

function addDist(features) {
	var feats = [];
	var totalDist = 0;
	for(i=0;i<features.length;i++) {
		var f = features[i];
		if(i != 0) {
			var prevI = i - 1;
			var p = features[prevI];
			var d = distance(f,p,'kilometers');
			totalDist = totalDist + d;
			f.properties.dist = totalDist;
			feats.push(f)
		}
	}
	return feats;
}

function removeDuplicates(features) {
	var feats = [];
	
	for(i=0;i<features.length;i++) {
		var f = features[i];
		if(i != 0) {
			var prevI = i - 1;
			var p = features[prevI];
			if(f.geometry.coordinates != p.geometry.coordinates) {
				feats.push(f);
			}
		}
	}
	return feats
}

function gpx2json(gpx) {
	var points = [];
	parser=new DOMParser();
	var xml = parser.parseFromString(gpx,"text/xml");
	var trkpts = xml.getElementsByTagName("trkpt");
	for(i=0;i<trkpts.length;i++) {
		p = trkpts[i];
		pt = {}

		for(j=0;j<p.attributes.length;j++) {
			var key = p.attributes[j].nodeName;
			var val = p.attributes[j].nodeValue;
			pt[key] = val;
		}

		for(k=0;k<p.children.length;k++) {
			var key = p.children[k].nodeName;
			var val = p.children[k].innerHTML;	
			pt[key] = val;		
		}

		var lon = Math.floor(+pt.lon * 1000000) / 1000000;
		var lat = Math.floor(+pt.lat * 1000000) / 1000000;

		var feat = {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: [lon, lat]
			},
			properties: {
				id: i,
				ele: +pt.ele,
				time: pt.time
			}
		}
		points.push(feat)
	}
	return points
}

},{"turf-distance":3}],2:[function(require,module,exports){
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

},{"./lib/convert.js":1}],3:[function(require,module,exports){
var invariant = require('turf-invariant');
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html

/**
 * Takes two {@link Point} features and calculates
 * the distance between them in degress, radians,
 * miles, or kilometers. This uses the
 * [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula)
 * to account for global curvature.
 *
 * @module turf/distance
 * @category measurement
 * @param {Feature} from origin point
 * @param {Feature} to destination point
 * @param {String} [units=kilometers] can be degrees, radians, miles, or kilometers
 * @return {Number} distance between the two points
 * @example
 * var point1 = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-75.343, 39.984]
 *   }
 * };
 * var point2 = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-75.534, 39.123]
 *   }
 * };
 * var units = "miles";
 *
 * var points = {
 *   "type": "FeatureCollection",
 *   "features": [point1, point2]
 * };
 *
 * //=points
 *
 * var distance = turf.distance(point1, point2, units);
 *
 * //=distance
 */
module.exports = function(point1, point2, units){
  invariant.featureOf(point1, 'Point', 'distance');
  invariant.featureOf(point2, 'Point', 'distance');
  var coordinates1 = point1.geometry.coordinates;
  var coordinates2 = point2.geometry.coordinates;

  var dLat = toRad(coordinates2[1] - coordinates1[1]);
  var dLon = toRad(coordinates2[0] - coordinates1[0]);
  var lat1 = toRad(coordinates1[1]);
  var lat2 = toRad(coordinates2[1]);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  var R;
  switch(units){
    case 'miles':
      R = 3960;
      break;
    case 'kilometers':
      R = 6373;
      break;
    case 'degrees':
      R = 57.2957795;
      break;
    case 'radians':
      R = 1;
      break;
    case undefined:
      R = 6373;
      break;
    default:
      throw new Error('unknown option given to "units"');
  }

  var distance = R * c;
  return distance;
};

function toRad(degree) {
  return degree * Math.PI / 180;
}

},{"turf-invariant":4}],4:[function(require,module,exports){
module.exports.geojsonType = geojsonType;
module.exports.collectionOf = collectionOf;
module.exports.featureOf = featureOf;

/**
 * Enforce expectations about types of GeoJSON objects for Turf.
 *
 * @alias geojsonType
 * @param {GeoJSON} value any GeoJSON object
 * @param {string} type expected GeoJSON type
 * @param {String} name name of calling function
 * @throws Error if value is not the expected type.
 */
function geojsonType(value, type, name) {
    if (!type || !name) throw new Error('type and name required');

    if (!value || value.type !== type) {
        throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + value.type);
    }
}

/**
 * Enforce expectations about types of {@link Feature} inputs for Turf.
 * Internally this uses {@link geojsonType} to judge geometry types.
 *
 * @alias featureOf
 * @param {Feature} feature a feature with an expected geometry type
 * @param {string} type expected GeoJSON type
 * @param {String} name name of calling function
 * @throws Error if value is not the expected type.
 */
function featureOf(value, type, name) {
    if (!name) throw new Error('.featureOf() requires a name');
    if (!value || value.type !== 'Feature' || !value.geometry) {
        throw new Error('Invalid input to ' + name + ', Feature with geometry required');
    }
    if (!value.geometry || value.geometry.type !== type) {
        throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + value.geometry.type);
    }
}

/**
 * Enforce expectations about types of {@link FeatureCollection} inputs for Turf.
 * Internally this uses {@link geojsonType} to judge geometry types.
 *
 * @alias collectionOf
 * @param {FeatureCollection} featurecollection a featurecollection for which features will be judged
 * @param {string} type expected GeoJSON type
 * @param {String} name name of calling function
 * @throws Error if value is not the expected type.
 */
function collectionOf(value, type, name) {
    if (!name) throw new Error('.collectionOf() requires a name');
    if (!value || value.type !== 'FeatureCollection') {
        throw new Error('Invalid input to ' + name + ', FeatureCollection required');
    }
    for (var i = 0; i < value.features.length; i++) {
        var feature = value.features[i];
        if (!feature || feature.type !== 'Feature' || !feature.geometry) {
            throw new Error('Invalid input to ' + name + ', Feature with geometry required');
        }
        if (!feature.geometry || feature.geometry.type !== type) {
            throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + feature.geometry.type);
        }
    }
}

},{}]},{},[2]);
