var coord2Pixel = function(bounds, width, height, coords) {
        var pixelX = Math.round(width * (1 - ((bounds[2] - coords.lng) / (bounds[2] - bounds[0]))));
        var pixelY = Math.round(height * (1 - ((coords.lat - bounds[1]) / (bounds[3] - bounds[1]))));
        if (pixelY == height) {
            --pixelY;
        }
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

function hit(trimData, trimBounds, lat, lng, trimWidth, trimHeight, index) {
    var test = [];
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
    var imgDataPaste = new Uint8ClampedArray(trimData.data.length);
    var bufPaste = imgDataPaste.buffer;
    var data32 = new Uint32Array(bufPaste);
    newRadius = Math.round(trimData.width / 2);
    var originElevation = data16[(2 * (x0 + y0 * w))] + 1;
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
    trimData.data.set(imgDataPaste);
}
self.onmessage = function(e) {
    var imageData = e.data.data;
    var index = e.data.index;
    var trimBounds = e.data.trimBounds;
    var lat = e.data.coords[0];
    var lng = e.data.coords[1];
    var trimWidth = e.data.trimWidth;
    var trimHeight = e.data.trimHeight;
    var proc = hit(imageData, trimBounds, lat, lng, trimWidth, trimHeight, index);
    self.postMessage({
        result: imageData,
        index: index
    });
};