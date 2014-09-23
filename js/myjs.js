(function() {
    map = L.mapbox.map('map', 'examples.map-i86nkdio').setView([37.74139927315054, -119.56043243408202], 12);
    control = L.control.layers({}, {
        'elevation': L.imageOverlay('data/38120_16bt_merc_small.png', [
            [37, -120],
            [38, -119]
        ])
    });
    control.addTo(map);
    var data = 'data/38120_16bt_merc_small.png';
    var bounds = [-120, 37, -119, 38];
    sightline = viewshed(map, data, bounds);
    sightlineView = int16Elevation(map, data, bounds);
})();
var costDistance = function() {
        console.log('cd');
    };