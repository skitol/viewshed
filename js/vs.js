
var viewshed = function(map, data, bounds) {
        var vs = {};
        var vsButton = d3.select("body").append("div").attr('class', 'vsbtn').text('Viewshed').on("click", function() {
            vsActivate(map);
        });
        var vsRad = d3.select("body").append("input").attr('type', 'text').attr('placeholder', 'Radius').attr('value', 5000).attr('class', 'vsrad');
        var width, height, imageData, context, contextHidden;
        var generateCanvas = function(imageObj) {
                var canvasHidden = document.createElement('canvas');
                canvasHidden.width = width = imageObj.width;
                canvasHidden.height = height = imageObj.height;
                contextHidden = canvasHidden.getContext('2d');
                contextHidden.drawImage(imageObj, 0, 0);
                var dataHidden = contextHidden.getImageData(0, 0, width, height);
            };
        var loadData = function(data) {
                var imageObj = new Image();
                imageObj.onload = function() {
                    generateCanvas(imageObj);
                };
                imageObj.src = data;
            };
        var vsActivate = function(map) {
                var ltln = [map.getCenter().lat, map.getCenter().lng];
                var marker = L.marker(ltln, {
                    draggable: true,
                }).addTo(map);
                //calc(map.getCenter().lat, map.getCenter().lng);
                calcWebWorker(map.getCenter().lat, map.getCenter().lng);
                marker.on('dragend', function(evt) {
                    //calc(evt.target.getLatLng().lat,evt.target.getLatLng().lng);
                    calcWebWorker(evt.target.getLatLng().lat, evt.target.getLatLng().lng);
                });
            };
        var coord2Pixel = function(bounds, width, height, coords) {
                var pixelX = Math.round(width * (1 - ((bounds[2] - coords.lng) / (bounds[2] - bounds[0]))));
                var pixelY = Math.round(height * (1 - ((coords.lat - bounds[1]) / (bounds[3] - bounds[1]))));
                return [pixelX, pixelY];
            };
        var Pixel2coord = function(xWidth, yHeight, widthLng, heightLat, coords) {
                var pixelX = xWidth * (widthLng * (1 - (coords.y / (xWidth))));
                var pixelY = yHeight * (heightLat * (1 - (coords.x / (yHeight))));
                return [pixelX, pixelY];
            };
        var line = function(x0, y0, x1, y1) {
                var ar = [];
                var dx = Math.abs(x1 - x0),
                    sx = x0 < x1 ? 1 : -1;
                var dy = Math.abs(y1 - y0),
                    sy = y0 < y1 ? 1 : -1;
                var err = (dx > dy ? dx : -dy) / 2;
                while (true) {
                    ar.push([x0, y0]);
                    if (x0 === x1 && y0 === y1) break;
                    var e2 = err;
                    if (e2 > -dx) {
                        err -= dy;
                        x0 += sx;
                    }
                    if (e2 < dy) {
                        err += dx;
                        y0 += sy;
                    }
                }
                return ar;
            };
        var sweep = function(x0, y0, maxx, maxy, r) {
                var points = [];
                var count = r * 4;
                var degreeStep = (Math.PI) / count;
                var i = degreeStep;
                var fullCircle = Math.PI * 2;
                while (i < fullCircle) {
                    i += degreeStep;
                    var x = Math.floor(x0 + r * (Math.cos(i)));
                    var y = Math.floor(y0 + r * (Math.sin(i)));
                    if (0 < x < maxx && 0 < y < maxy) {
                        points.push([x, y]);
                    }
                }
                return points;
            };
        var calc = function(lat, lng) {
                var radius = +vsRad.property('value');
                var w = width;
                var h = height;

                function destLoc(lat, lon, d, brng) {
                    toRad = function(num) {
                        return num * Math.PI / 180;
                    };
                    toDeg = function(num) {
                        return num * 180 / Math.PI;
                    };
                    R = 6378100;
                    brng = toRad(brng);
                    lat1 = toRad(lat);
                    lon1 = toRad(lon);
                    lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
                    lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));
                    lat2 = toDeg(lat2);
                    lon2 = toDeg(lon2);
                    return [+lat2.toFixed(20), +lon2.toFixed(20)];
                }
                var wb = destLoc(lat, lng, radius, 270)[1];
                var sb = destLoc(lat, lng, radius, 180)[0];
                var eb = destLoc(lat, lng, radius, 90)[1];
                var nb = destLoc(lat, lng, radius, 0)[0];
                var NE = coord2Pixel(bounds, w, h, {
                    lat: nb,
                    lng: eb
                });
                var SW = coord2Pixel(bounds, w, h, {
                    lat: sb,
                    lng: wb
                });
                var trimWidth = SW[1] - NE[1];
                var trimHeight = NE[0] - SW[0];
                var trimData = contextHidden.getImageData(SW[0], NE[1], trimWidth, trimHeight);
                //Pixel count
                //console.log('pixels-' + Math.round(Math.PI * (Math.pow((trimWidth / 2), 2))))
                var _canvas = document.createElement('canvas');
                //document.body.appendChild(_canvas);
                _canvas.id = 'someId';
                _canvas.width = trimWidth;
                _canvas.height = trimHeight;
                var _context = _canvas.getContext("2d");
                _context.putImageData(trimData, 0, 0);
                var trimBounds = [wb, sb, eb, nb];
                var pixel = coord2Pixel(trimBounds, trimWidth, trimHeight, {
                    lat: lat,
                    lng: lng
                });
                var x0 = pixel[0];
                var y0 = pixel[1];
                var w = trimWidth;
                var h = trimHeight;
                var buf = trimData.data.buffer;
                var data16 = new Uint16Array(buf);
                var imgDataPaste = _context.createImageData(w, h);
                var bufPaste = imgDataPaste.data.buffer;
                var data32 = new Uint32Array(bufPaste);
                var newRadius = Math.round(trimData.width / 2);
                var dataLocOrig = (y0 * w + x0) * 4;
                var originElevation = data16[(dataLocOrig / 2)] + 1;
                var outterArray = sweep(pixel[0], pixel[1], w, h, newRadius);
                var length = outterArray.length;
                var j = 0;
                while (j < length) {
                    var x1 = outterArray[j][0];
                    var y1 = outterArray[j][1];
                    var testGrad, testElevation, testDistance, dataLoc, array = line(x0, y0, x1, y1),
                        len = array.length,
                        i = 1,
                        x3, y3, setGrad = -5 / 0;
                    while (i < len) {
                        x3 = array[i][0];
                        y3 = array[i][1];
                        testElevation = data16[(((y3 * w + x3) * 4) / 2)];
                        testDistance = Math.sqrt((x0 - x3) * (x0 - x3) + (y0 - y3) * (y0 - y3));
                        testGrad = (originElevation - testElevation) / (-testDistance);
                        if (testGrad >= setGrad) {
                            setGrad = testGrad;
                            dataLoc = [(y3 * w + x3) * 4];
                            data32[y3 * w + x3] = (255 << 24) | // alpha
                            (255 << 16) | // blue
                            (0 << 8) | // green
                            0; // red
                        }
                        i++;
                    }
                    j++;
                }
                //imageData.data.set(dataCopy);
                _context.putImageData(imgDataPaste, 0, 0);
                if (vs.canvasLayer) {
                    map.removeLayer(vs.canvasLayer);
                }
                var canvasLayer = L.imageOverlay.canvas(L.latLngBounds([sb, wb], [nb, eb]));
                canvasLayer.addTo(map);
                canvasLayer.canvas.getContext('2d').drawImage(_canvas, 0, 0, canvasLayer.canvas.width, canvasLayer.canvas.height);
                vs.canvasLayer = canvasLayer;
            };
        var calcWebWorker = function(lat, lng) {
                var radius = +vsRad.property('value');
                var w = width;
                var h = height;

                function destLoc(lat, lon, d, brng) {
                    toRad = function(num) {
                        return num * Math.PI / 180;
                    };
                    toDeg = function(num) {
                        return num * 180 / Math.PI;
                    };
                    R = 6378100;
                    brng = toRad(brng);
                    lat1 = toRad(lat);
                    lon1 = toRad(lon);
                    lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
                    lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));
                    lat2 = toDeg(lat2);
                    lon2 = toDeg(lon2);
                    return [+lat2.toFixed(20), +lon2.toFixed(20)];
                }
                var wb = destLoc(lat, lng, radius, 270)[1];
                var sb = destLoc(lat, lng, radius, 180)[0];
                var eb = destLoc(lat, lng, radius, 90)[1];
                var nb = destLoc(lat, lng, radius, 0)[0];
                var NE = coord2Pixel(bounds, w, h, {
                    lat: nb,
                    lng: eb
                });
                var SW = coord2Pixel(bounds, w, h, {
                    lat: sb,
                    lng: wb
                });
                var trimWidth = SW[1] - NE[1];
                var trimHeight = NE[0] - SW[0];
                var trimData = contextHidden.getImageData(SW[0], NE[1], trimWidth, trimHeight);
                //console.log('pixels-' + Math.round(Math.PI * (Math.pow((trimWidth / 2), 2))))
                var _canvas = document.createElement('canvas');
                _canvas.id = 'someId';
                //document.body.appendChild(_canvas);
                _canvas.width = trimWidth;
                _canvas.height = trimHeight;
                var _context = _canvas.getContext("2d");
                _context.putImageData(trimData, 0, 0);
                var workersCount = 2;
                var finished = 0;
                var onWorkEnded = function(e) {
                        var canvasData = e.data.result;
                        var indexx = e.data.index;
                        if (indexx == 0) {
                            _context.putImageData(canvasData, 0, 0);
                        } else if (indexx == 1) {
                            _context.putImageData(canvasData, 0, trimHeight / 2);
                        }
                        finished++;
                        if (finished == workersCount) {
                            if (vs.canvasLayer) {
                                map.removeLayer(vs.canvasLayer);
                            }
                            var canvasLayer = L.imageOverlay.canvas(L.latLngBounds([sb, wb], [nb, eb]));
                            canvasLayer.addTo(map);
                            canvasLayer.canvas.getContext('2d').drawImage(_canvas, 0, 0, canvasLayer.canvas.width, canvasLayer.canvas.height);
                            vs.canvasLayer = canvasLayer;
                        }
                    };
                for (var index = 0; index < workersCount; index++) {
                    var worker = new Worker("js/task.js");
                    worker.onmessage = onWorkEnded;
                    if (index == 0) {
                        var canvasData = _context.getImageData(0, 0, _canvas.width, _canvas.height / 2);
                        var newSB = sb + ((nb - sb) / 2);
                        var newNB = nb;
                        var newEB = eb;
                        var newWB = wb;
                    } else if (index == 1) {
                        var canvasData = _context.getImageData(0, _canvas.height / 2, _canvas.width, _canvas.height / 2);
                        var newSB = sb;
                        var newNB = sb + ((nb - sb) / 2);
                        var newEB = eb;
                        var newWB = wb;
                    }
                    var newTrimHeight = trimHeight / workersCount;
                    var newTrimWidth = trimWidth;
                    worker.postMessage({
                        data: canvasData,
                        index: index,
                        trimBounds: [newWB, newSB, newEB, newNB],
                        coords: [lat, lng],
                        trimWidth: newTrimWidth,
                        trimHeight: newTrimHeight
                    });
                }
            };
        loadData(data);
        return vs;
    };