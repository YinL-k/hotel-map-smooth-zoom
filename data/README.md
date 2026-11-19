# Beijing basemap data

**beijing.json.gz** contains a JSON object with six GeoJSON feature collections for road, park, water and place-label rendering. It is a simplified subset of the [Geofabrik Beijing extract](https://download.geofabrik.de/asia/china/beijing.html) and is redistributed under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Data copyright © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

To rebuild the data using Node.js 22.13 or later, extract **beijing.gpkg** from Geofabrik's **beijing-latest-free.gpkg.zip** and run:

~~~sh
node scripts/extract-map.cjs /path/to/beijing.gpkg
node scripts/build.mjs
~~~

The synthetic hotel points are listed in [a separate source file](../src/demo-hotels.js).
