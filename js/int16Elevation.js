var int16Elevation = function (map, data, bounds) {
    var vs = {};
    var vsButton = d3.select("body").append("div").attr('class', 'vsButton').text('View Elevation').style({
        'cursor': 'pointer',
        'background-color': '#000',
        'color': '#fff',
        'position': 'relative',
        'z-index': 99,
        'margin': '5px',
        'margin-right': '100px',
        'padding': '3px',
        'display': 'inline-block',
        'float': 'right'
    });
    vsButton.on("click", function (d, i) {
        calc();
    });
    var coord2Pixel = function (bounds, width, height, coords) {
        var pixelX = Math.round(width * (1 - ((bounds[2] - coords.lng) / (bounds[2] - bounds[0]))));
        var pixelY = Math.round(height * (1 - ((coords.lat - bounds[1]) / (bounds[3] - bounds[1]))));
        return [pixelX, pixelY]
    };
    var calc = function () {
        var w = vs.w;
        var h = vs.h;
        var wb = map.getBounds()._southWest.lng;
        var sb = map.getBounds()._southWest.lat;
        var eb = map.getBounds()._northEast.lng;
        var nb = map.getBounds()._northEast.lat;
        var NE = coord2Pixel(bounds, w, h, {
            lat: nb,
            lng: eb
        });
        var SW = coord2Pixel(bounds, w, h, {
            lat: sb,
            lng: wb
        });
        var trimWidth = NE[0] - SW[0];
        var trimHeight = SW[1] - NE[1];
        // var trimWidth = map.getSize().x;
        //var trimHeight = map.getSize().y;console.log(SW[0], NE[1], trimWidth, trimHeight)
        var trimData = vs.context.getImageData(SW[0], NE[1], trimWidth, trimHeight);
        var _canvas = document.createElement('canvas');
        _canvas.id = 'someId';
        // document.body.appendChild(_canvas);
        _canvas.width = trimWidth;
        _canvas.height = trimHeight;
        var _context = _canvas.getContext("2d");
        _context.putImageData(trimData, 0, 0);
        var trimBounds = [wb, sb, eb, nb];
        var w = trimWidth;
        var h = trimHeight;
        data = trimData.data;
        var buf = trimData.data.buffer;
        var data16 = new Uint16Array(buf);
        //var data32 = new Uint32Array(buf);
        // var imgDataPaste = _context.createImageData(w, h);
        // var bufPaste = imgDataPaste.data.buffer;
        // var data32 = new Uint32Array(bufPaste);
        //var max = Math.max.apply( Math, [1,2,3] );
        for (var i = 0; i < data.length; i += 4) {
            //testElevation = data16[(((y3 * w + x3) * 4) / 2)];
            var testElevation = data[i + 1] * 255 + data[i];
            var color = Math.round(255 * (testElevation / 3000));
            // red
            data[i] = color;
            // green
            data[i + 1] = color;
            // blue
            data[i + 2] = color;
        }
        // overwrite original image
        _context.putImageData(trimData, 0, 0);
        if (vs.canvasLayer) {
            map.removeLayer(vs.canvasLayer)
        }
        var canvasLayer = L.imageOverlay.canvas(L.latLngBounds([sb, wb], [nb, eb]));
        canvasLayer.addTo(map);
        control.addOverlay(canvasLayer,'Uint16Array Elevatio');
        canvasLayercontext = canvasLayer.canvas.getContext('2d');
        canvasLayercontext.drawImage(_canvas, 0, 0, canvasLayer.canvas.width, canvasLayer.canvas.height);
        vs.canvasLayer = canvasLayer;
    };
    var loadData = function (data) {
        var imageObj = new Image();
        imageObj.onload = function () {
            var canvasHidden = document.createElement('canvas');
            var w = imageObj.width;
            var h = imageObj.height;
            canvasHidden.width = w;
            canvasHidden.height = h;
            contextHidden = canvasHidden.getContext('2d');
            contextHidden.drawImage(imageObj, 0, 0);
            var dataHidden = contextHidden.getImageData(0, 0, w, h);
            vs.ImageData = dataHidden;
            vs.w = w;
            vs.h = h;
            vs.context = contextHidden;
            //vs.canvas = canvasHidden;
        };
        imageObj.src = data;
    }

    loadData(data);

    return vs;
}