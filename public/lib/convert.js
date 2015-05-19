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
