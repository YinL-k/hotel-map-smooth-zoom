import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const data = await readFile(new URL('data/beijing.json.gz', root));
const engine = (await read('vendor/maplibre-gl.js')).replace(/\n\/\/# sourceMappingURL=.*$/m, '');
const notices = (await read('vendor/LICENSE.txt')).replaceAll('*/', '* /');
const parts = {
  CSS: await read('src/page.css'),
  MAPLIBRE: '/*\n' + notices + '\n*/\n' + engine,
  DATA: (await read('src/demo-hotels.js')) + '\n' + (await read('src/hotel-fixtures.js')),
  BASE: (await read('src/basemap.js')).replace('/*__MAP_DATA__*/', data.toString('base64')),
  MARKERS: await read('src/hotel-markers.js'),
  APP: await read('src/app.js'),
};

let html = await read('src/page.html');
for (const [name, value] of Object.entries(parts)) {
  const token = '/*__' + name + '__*/';
  if (html.split(token).length !== 2) throw new Error('Expected exactly one template token: ' + token);
  const code = name === 'CSS' ? value : value.replace(/<\/script/gi, '<\\/script');
  html = html.replace(token, () => code);
}
await writeFile(new URL('index.html', root), html);
console.log('Built index.html');
