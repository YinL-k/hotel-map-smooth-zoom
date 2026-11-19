const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { gzipSync } = require('node:zlib');

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/extract-map.cjs /path/to/beijing.gpkg');
const db = new DatabaseSync(input, { readOnly: true });
const wide = [116.02, 39.63, 116.88, 40.26];
const center = [116.27, 39.81, 116.54, 40.03];
const envelopeBytes = [0, 32, 48, 48, 64];
const rounded = value => Math.round(value * 1e5) / 1e5;

function boundsMatch(buffer, [west, south, east, north]) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const flags = view.getUint8(3);
  const little = Boolean(flags & 1);
  if (((flags >> 1) & 7) === 0) return true;
  return view.getFloat64(8, little) <= east && view.getFloat64(16, little) >= west
    && view.getFloat64(24, little) <= north && view.getFloat64(32, little) >= south;
}

function geometry(buffer, spacing) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 8 + envelopeBytes[(view.getUint8(3) >> 1) & 7];
  function read() {
    const little = view.getUint8(offset++) === 1;
    function uint() { const v = view.getUint32(offset, little); offset += 4; return v; }
    function position() {
      const x = rounded(view.getFloat64(offset, little));
      const y = rounded(view.getFloat64(offset + 8, little));
      offset += 16;
      return [x, y];
    }
    function positions() {
      const length = uint(), result = [];
      for (let i = 0; i < length; i++) {
        const point = position(), last = result.at(-1);
        if (!last || i === length - 1 || Math.abs(point[0] - last[0]) + Math.abs(point[1] - last[1]) >= spacing) result.push(point);
      }
      return result;
    }
    const type = uint();
    if (type === 1) return { type: 'Point', coordinates: position() };
    if (type === 2) return { type: 'LineString', coordinates: positions() };
    if (type === 3) return { type: 'Polygon', coordinates: Array.from({ length: uint() }, positions).filter(ring => ring.length >= 4) };
    if (type === 6) return { type: 'MultiPolygon', coordinates: Array.from({ length: uint() }, () => read().coordinates).filter(polygon => polygon.length) };
    throw new Error('Unhandled geometry type ' + type);
  }
  return read();
}
function collection(table, classes, region, spacing, properties) {
  const placeholders = classes.map(() => '?').join(',');
  const stmt = db.prepare('SELECT fclass,name,geom FROM gis_osm_' + table + '_free WHERE fclass IN (' + placeholders + ')');
  const features = [];
  for (const row of stmt.iterate(...classes)) {
    if (!boundsMatch(row.geom, region)) continue;
    const attrs = properties(row);
    if (!attrs) continue;
    const shape = geometry(row.geom, spacing);
    if (shape.coordinates.length < 1) continue;
    if (shape.type === 'Point' && (shape.coordinates[0] < region[0] || shape.coordinates[0] > region[2]
      || shape.coordinates[1] < region[1] || shape.coordinates[1] > region[3])) continue;
    features.push({ type: 'Feature', properties: attrs, geometry: shape });
  }
  return { type: 'FeatureCollection', features };
}

function hasSpan(buffer, threshold) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const little = Boolean(view.getUint8(3) & 1);
  return view.getFloat64(16, little) - view.getFloat64(8, little)
    + view.getFloat64(32, little) - view.getFloat64(24, little) > threshold;
}
function groupLines(collection) {
  const groups = new Map();
  for (const { geometry, properties } of collection.features) {
    const [x, y] = geometry.coordinates[0];
    const key = [properties.kind, Math.floor(x * 20), Math.floor(y * 20)].join('|');
    if (!groups.has(key)) groups.set(key, {
      type: 'Feature', properties, geometry: { type: 'MultiLineString', coordinates: [] },
    });
    groups.get(key).geometry.coordinates.push(geometry.coordinates);
  }
  return { type: 'FeatureCollection', features: [...groups.values()] };
}
const local = collection('roads', ['residential','living_street','tertiary','unclassified'], center, .00019,
  row => row.fclass === 'tertiary' || hasSpan(row.geom, .0011) ? { kind: row.fclass === 'tertiary' ? 'tertiary' : 'local' } : null);
const main = collection('roads', ['motorway','trunk','primary','secondary'], wide, .00029,
  row => ({ kind: row.fclass === 'motorway' || row.fclass === 'trunk' ? 'highway' : row.fclass }));
const green = collection('landuse_a', ['forest','park','grass','recreation_ground'], wide, .00028, row => {
  if (!row.name && !hasSpan(row.geom, .0033)) return null;
  return { kind: row.fclass };
});
const water = collection('water_a', ['water','riverbank','reservoir'], wide, .00022,
  row => row.name || hasSpan(row.geom, .0015) ? { kind: row.fclass } : null);
const rivers = collection('waterways', ['river','canal'], wide, .00032, row => ({ kind: row.fclass }));
const labels = collection('places', ['national_capital','city','town','suburb'], wide, 0,
  row => row.name && /[\u4e00-\u9fff]/u.test(row.name) ? { label: row.name.split(/[;\/]/u)[0], kind: row.fclass } : null);
const dataset = { local: groupLines(local), main: groupLines(main), green, water, rivers: groupLines(rivers), labels };
fs.writeFileSync(path.join(__dirname, '../data/beijing.json.gz'), gzipSync(JSON.stringify(dataset)));
console.log(Object.fromEntries(Object.entries(dataset).map(([name, value]) => [name, value.features.length])));
