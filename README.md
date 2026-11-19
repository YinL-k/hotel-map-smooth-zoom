# Smooth Hotel Map Zoom

A small, offline-friendly MapLibre GL JS demo of continuous map zoom with hotel-price markers.

**[Open the live demo](https://yinl-k.github.io/hotel-map-smooth-zoom/)** · [Download the standalone HTML](https://raw.githubusercontent.com/YinL-k/hotel-map-smooth-zoom/main/index.html)

- Scroll or pinch to zoom. Nearby hotels merge as you zoom out and split as you zoom in.
- Click a cluster to animate to the zoom level where it expands. A cluster is a rounded pill, while a single-hotel price marker uses a pointer to indicate its location.
- Price markers slide out from a cluster on split and move toward the new center on merge. Transitions combine position and opacity and respect the system's reduced-motion preference.
- Each animation frame checks the space occupied by the bubbles, with priority given to the selected hotel or its cluster. The upper-left arrow resets the camera.

The map starts in Beijing with 49 synthetic hotels. The basemap is bundled with the page, so the downloadable HTML also works offline in a recent browser with WebGL. No account, API key, or tile service is required.

## Implementation

- [Camera and UI](src/app.js) sets up the MapLibre map and initial viewport.
- [Marker rendering and clustering](src/hotel-markers.js) uses a clustered GeoJSON source, symbol collision, and the cluster's expansion zoom.
- [Cluster transitions](src/cluster-motion.js) match markers through their shared hotels, interpolate positions, and check for collisions on each animation frame.
- [Basemap style](src/basemap.js) draws roads, parks and water from the bundled geographic data.

To rebuild with Node.js 18 or later:

~~~sh
node scripts/build.mjs
~~~

Open the generated [index.html](index.html) in a browser.

## Data and engine

The Beijing basemap is derived from [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), via [Geofabrik's Beijing extract](https://download.geofabrik.de/asia/china/beijing.html). The [bundled data](data/beijing.json.gz) is available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

The demo embeds MapLibre GL JS 4.7.1 from its official npm distribution. See the [upstream license](vendor/LICENSE.txt).
