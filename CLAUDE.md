# CLAUDE.md — Viewshed Codebase Guide

This document describes the structure, conventions, and workflows for the
**viewshed** project. It is intended for AI assistants working on this repo.

---

## Overview

A client-side geospatial web application that performs **viewshed analysis**
(line-of-sight visibility calculations) on elevation terrain data. Given a
point on a map, it computes and renders which surrounding pixels are visible
from that point based on the terrain elevation.

- **No backend, no build step, no package manager** — pure static HTML/CSS/JS.
- Runs directly in a browser served from any static file host.
- Parallelizes computation using the **Web Workers API**.
- Displays results over an interactive map using **Mapbox.js / Leaflet**.

---

## Repository Layout

```
viewshed/
├── index.html                        # Entry point — loads all scripts
├── css/
│   └── style.css                     # UI styles (map, buttons, inputs)
├── js/
│   ├── myjs.js                       # App initialization (map setup, module wiring)
│   ├── vs.js                         # Core viewshed module (main thread)
│   ├── task.js                       # Web Worker script (parallel viewshed calc)
│   ├── int16Elevation.js             # Elevation overlay visualization
│   └── Leaflet.ImageOverlay.Canvas.js# Custom Leaflet canvas overlay extension
├── data/
│   ├── 38120_16bt.png                # Full-res elevation raster (10812×10812, ~49 MB)
│   ├── 38120_16bt_small.png          # Medium-res (3601×3601, ~10 MB)
│   └── 38120_16bt_merc_small.png     # Web Mercator small (2375×2994, ~6 MB) ← used at runtime
├── README.md
├── LICENSE.md
└── travis.yml                        # CI config (outdated Node.js versions, unused)
```

---

## External Dependencies (CDN, no install needed)

| Library | Version | Purpose |
|---|---|---|
| Mapbox.js (built on Leaflet) | v1.6.1 | Interactive slippy map |
| D3.js | v3 | DOM manipulation for UI elements |

Both are loaded from CDN in `index.html`. There is no `package.json` or local
`node_modules`.

---

## Running Locally

Because the app uses `XMLHttpRequest` / Canvas `drawImage` to load local PNG
files, it **must be served over HTTP** (not opened as a `file://` URL). Any
static file server works:

```bash
# Python 3
python3 -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080

# Node.js (npx)
npx serve .
```

Then open `http://localhost:8080` in a browser.

---

## How the Viewshed Algorithm Works

### Data Format

Elevation data is stored in PNG images where **each pixel encodes a 16-bit
elevation value** split across two 8-bit channels:

```
elevation (meters) = channel[1] * 255 + channel[0]
```

Valid range: ~0–3000 m. The active file is `data/38120_16bt_merc_small.png`,
covering **[37°–38°N, 120°–119°W]** (Yosemite area).

### Coordinate ↔ Pixel Conversion

`coord2Pixel(bounds, width, height, {lat, lng})` maps geographic coordinates
to raster pixel coordinates. `bounds` is `[west, south, east, north]`.

### Line-of-Sight Calculation

1. **`sweep(x0, y0, maxx, maxy, r)`** — generates endpoint pixels on a circle
   of radius `r` around the viewpoint by stepping through angles at `π/(4r)`
   increments.
2. **`line(x0, y0, x1, y1)`** — Bresenham's line algorithm: returns every
   pixel along the ray from viewpoint to each sweep endpoint.
3. **Gradient comparison** — for each pixel along a ray, compute
   `(originElevation − testElevation) / distance`. A pixel is visible when
   its gradient exceeds all previous gradients along the ray (i.e., it "rises
   above the horizon" established by closer terrain).
4. Visible pixels are painted blue (`RGBA 0,0,255,255`).

### Single-threaded vs. Web Worker path

- `calc()` — reference single-threaded implementation (commented out in
  production but kept for comparison).
- `calcWebWorker()` — production path. Splits the bounding-box image
  horizontally into **top half (worker 0)** and **bottom half (worker 1)**.
  Each `Worker` runs `js/task.js`, performs `hit()`, and `postMessage`s the
  result canvas back. Both results are composited in `onWorkEnded`.

---

## Module API

### `viewshed(map, data, bounds)` — `js/vs.js`

Factory function. Call once during initialization.

| Param | Type | Description |
|---|---|---|
| `map` | Leaflet map instance | The active map |
| `data` | string (URL) | Path to elevation PNG |
| `bounds` | `[west, south, east, north]` | Geographic extent of PNG |

Returns an object (`vs`) with a `canvasLayer` property (the current result
overlay, replaced on each recalculation).

A **"Viewshed"** button and a **radius input** (default 5000 m) are injected
into the DOM automatically.

### `int16Elevation(map, data, bounds)` — `js/int16Elevation.js`

Same signature as `viewshed`. Adds an elevation grayscale overlay to the map's
layer control.

### Web Worker message protocol — `js/task.js`

**Main → Worker (`postMessage`):**
```js
{
  data:        ImageData,   // pixel data for this half of the bounding box
  index:       0 | 1,       // 0 = top half, 1 = bottom half
  trimBounds:  [w, s, e, n],
  coords:      [lat, lng],
  trimWidth:   number,
  trimHeight:  number       // half of the full trim height
}
```

**Worker → Main (`postMessage`):**
```js
{
  result: ImageData,   // modified pixel data with visible pixels painted blue
  index:  0 | 1
}
```

---

## Code Conventions

- **Language**: ES5 vanilla JavaScript (no transpilation, no modules, no `'use strict'`).
- **Naming**: `camelCase` for all functions and variables. No constants pattern.
- **Module pattern**: Factory functions (closures) rather than classes.
  ```js
  var myModule = function(args) {
      var private = ...;
      var obj = {};
      obj.publicMethod = function() { ... };
      return obj;
  };
  ```
- **Globals**: `map`, `control`, `sightline`, `sightlineView` are intentional
  globals set in `myjs.js`.
- **No linting** is configured. Follow the existing indentation style (mixed,
  lean toward 4-space).
- **No type annotations** — document intent in comments when adding non-obvious logic.

---

## Key Gotchas & Known Issues

1. **`0 < x < maxx` does not work in JS.** In `sweep()` (both `vs.js` and
   `task.js`), the boundary check `0 < x < maxx && 0 < y < maxy` is always
   truthy due to JS comparison chaining. Points outside bounds can cause
   out-of-bounds array reads. Fix by using `x > 0 && x < maxx && y > 0 && y < maxy`.

2. **Implicit globals in `calc()`** — `toRad`, `toDeg`, `R`, `lat1`, `lon1`,
   `lat2`, `lon2` inside `destLoc()` are missing `var`/`let` and leak to
   `window`. Both `calc` and `calcWebWorker` duplicate this inner function.

3. **`calc()` is disabled** — production uses `calcWebWorker()`. The `calc()`
   function is kept only as reference and is invoked via commented-out lines.

4. **Elevation index formula inconsistency** — `vs.js` uses
   `data16[(dataLocOrig / 2)]` while `task.js` uses `data16[(2 * (x0 + y0 * w))]`.
   The `task.js` formula is correct.

5. **Canvas CORS** — loading the elevation PNG into a hidden canvas for pixel
   reads requires the PNG to be same-origin or served with CORS headers.

6. **Travis CI config** (`travis.yml`) specifies ancient Node.js versions
   (0.6–0.11). There are no actual tests; the CI file does nothing useful.

---

## Files NOT to Modify

| File | Reason |
|---|---|
| `data/38120_16bt.png` | Large binary raster — do not alter or commit changes |
| `data/38120_16bt_small.png` | Same |
| `data/38120_16bt_merc_small.png` | Same — this is the active runtime data file |

---

## Development Workflow

1. **No build step** — edit source files and reload the browser.
2. **No tests** — validate changes manually in browser DevTools.
3. **Branch**: work on `claude/add-claude-documentation-al4ux`; never push to
   `master` directly.
4. **Commit style**: brief imperative present-tense messages, e.g.
   `Fix boundary check in sweep()`.

---

## Geographic Context

| Parameter | Value |
|---|---|
| Area covered | Yosemite National Park, California, USA |
| Bounds | 37°–38°N, 120°–119°W |
| Default map center | 37.741°N, 119.560°W |
| Default zoom | 12 |
| Elevation range | ~0–3000 m |
| Mapbox tile ID | `examples.map-i86nkdio` (demo token) |
