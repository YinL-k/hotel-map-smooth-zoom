async function loadMapStyle() {
  const data = await new Response(
    new Blob([Uint8Array.from(atob('/*__MAP_DATA__*/'), byte => byte.charCodeAt(0))]).stream()
      .pipeThrough(new DecompressionStream('gzip'))
  ).json();
  const sources = Object.fromEntries(Object.entries(data).map(([key, geojson]) =>
    [key, { type: 'geojson', data: geojson, tolerance: .6 }]));
  const kind = ['get', 'kind'];
  const scale = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
  const layer = (id, type, source, paint, extra) => ({ id, type, source, paint, ...extra });
  const road = (id, source, filter, color, width, minzoom, opacity = 1) => layer(
    id, 'line', source, { 'line-color': color, 'line-width': width, 'line-opacity': opacity },
    { minzoom, filter, layout: { 'line-cap': 'round', 'line-join': 'round' } }
  );
  const mainRoad = value => ['==', kind, value];
  const nonHighway = ['!=', kind, 'highway'];
  const layers = [
    { id: 'paper', type: 'background', paint: { 'background-color': '#f2f0e9' } },
    layer('parks', 'fill', 'green', { 'fill-color': ['match', kind, 'forest', '#c7e3b8', 'park', '#cbe8bf', '#d7eac5'], 'fill-opacity': .9 }),
    layer('water', 'fill', 'water', { 'fill-color': '#a8cfe9' }),
    road('rivers', 'rivers', null, '#afd5eb', scale(9, .7, 12, 1.7, 15, 3), 8),
    road('local-edges', 'local', null, '#dedbd2', scale(10.8, .4, 12, 1.2, 15, 5), 10.7, .65),
    road('local-streets', 'local', null, '#fffdf9', scale(10.8, .35, 12, 1, 15, 4.4), 10.7),
    road('regional-edges', 'main', nonHighway, '#d6bb92', scale(8.7, .25, 11, 1.1, 14, 4.7), 8.7, .77),
    road('regional-streets', 'main', nonHighway, ['match', kind, 'primary', '#ffedc5', '#fffaf0'], scale(8.7, .2, 11, .8, 14, 3.8), 8.7),
    road('highway-edges', 'main', mainRoad('highway'), '#dba164', scale(8.5, .55, 11, 1.65, 14, 5.2), 8.5, .9),
    road('highways', 'main', mainRoad('highway'), '#ffda9c', scale(8.5, .42, 11, 1.16, 14, 4.1), 8.5),
    {
      id: 'place-labels', type: 'symbol', source: 'labels',
      layout: {
        'icon-image': ['concat', 'place|', ['get', 'kind'], '|', ['get', 'label']],
        'icon-allow-overlap': false, 'icon-padding': 13,
        'symbol-sort-key': ['match', kind, 'national_capital', 0, 'city', 1, 'suburb', 2, 3],
      },
      filter: ['any', ['match', kind, ['national_capital','city'], true, false], ['>=', ['zoom'], 10.55]],
    }
  ].map(item => {
    if (item.filter === null) delete item.filter;
    return item;
  });
  return { version: 8, sources, layers };
}
