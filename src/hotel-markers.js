function createHotelMarkers({ map, hotels, home, drawLogo, padding, onSelect, onError }) {
  const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const priority = { none: 1, plain: 2, perk: 3, advantage: 4 };
  const hotelById = new Map(hotels.map(hotel => [hotel.hotelId, hotel]));
  const hotelByRank = new Map(hotels.map(hotel => [hotel.rank, hotel]));
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const time = ms => media.matches ? 0 : ms;
  const easing = t => 1 - Math.pow(1 - t, 3);
  const fc = features => ({ type: 'FeatureCollection', features });
  const amount = hotel => money.format(hotel.priceMinor / 100);
  let sourceRevision = 0, markerAction = 0;

  function sprite(id) {
    const [type, first, second, selected] = id.split('|');
    const place = type === 'place';
    const group = type === 'group';
    if (!place && !group && type !== 'price') return null;
    const hotel = group ? hotelByRank.get(Number(second)) : undefined;
    const kind = group ? hotel?.kind ?? 'plain' : first;
    const value = group && hotel ? (hotel.priceMinor === null ? '—' : amount(hotel)) : second;
    const countLabel = group ? first + ' 家' : '';
    const countOnly = group && !hotel;
    const highlighted = selected === '1' || Boolean(hotel);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const missing = kind === 'none';
    const branded = kind === 'advantage' || kind === 'perk';
    const dark = highlighted || kind === 'advantage';
    const font = place ? (kind === 'city' ? '650 13px' : '500 11px') + ' "Microsoft YaHei", sans-serif'
      : missing ? '500 10px sans-serif' : '600 12px sans-serif';
    ctx.font = font;
    const textWidth = Math.ceil(ctx.measureText(value).width);
    const priceWidth = Math.max(23, textWidth + (missing ? 12 : 23) + (branded ? 15 : 0));
    const countFont = '600 11px "Microsoft YaHei", sans-serif';
    ctx.font = countFont;
    const countWidth = Math.ceil(ctx.measureText(countLabel).width);
    const width = place ? textWidth + 6 : countOnly ? countWidth + 20 : priceWidth + (group ? countWidth + 12 : 0);
    const boxHeight = place || missing && !group ? 18 : 25;
    const tailHeight = place || group ? 0 : missing ? 5 : 6;
    canvas.width = width * 2;
    canvas.height = (boxHeight + tailHeight) * 2;
    ctx.scale(2, 2);
    ctx.font = font;
    ctx.textBaseline = 'middle';
    if (place) {
      ctx.textAlign = 'center';
      ctx.lineWidth = 2.7;
      ctx.strokeStyle = '#faf9f3';
      ctx.strokeText(value, width / 2, boxHeight / 2);
      ctx.fillStyle = kind === 'city' ? '#414644' : '#71746c';
      ctx.fillText(value, width / 2, boxHeight / 2);
    } else {
      ctx.fillStyle = highlighted ? '#000' : kind === 'advantage' ? '#7c1e1e' : missing ? '#ffffffe6' : '#fff';
      ctx.beginPath();
      ctx.roundRect(0, 0, width, boxHeight, boxHeight / 2);
      ctx.fill();
      if (tailHeight) {
        ctx.beginPath();
        ctx.moveTo(width / 2 - tailHeight + 1, boxHeight - .5);
        ctx.lineTo(width / 2 + tailHeight - 1, boxHeight - .5);
        ctx.lineTo(width / 2, boxHeight + tailHeight);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = dark ? '#fff' : missing ? '#8e8e93' : '#222';
      if (countOnly) {
        ctx.font = countFont;
        ctx.textAlign = 'center';
        ctx.fillText(countLabel, width / 2, boxHeight / 2);
      } else if (missing) {
        ctx.textAlign = 'center';
        ctx.fillText(value, priceWidth / 2, boxHeight / 2);
      } else {
        let x = 8;
        if (branded) {
          drawLogo(ctx, x, 6.5, dark);
          x += 15;
        }
        ctx.font = '600 10px sans-serif';
        ctx.fillText('¥', x, 13);
        ctx.font = '600 12px sans-serif';
        ctx.fillText(value, x + 7, 13);
      }
      if (group && hotel) {
        ctx.fillStyle = '#ffffff55';
        ctx.fillRect(priceWidth - 3, 6, 1, boxHeight - 12);
        ctx.fillStyle = '#fff';
        ctx.font = countFont;
        ctx.textAlign = 'left';
        ctx.fillText(countLabel, priceWidth + 3, boxHeight / 2);
      }
    }
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  function addSprite(id) {
    if (map.hasImage(id)) return;
    const image = sprite(id);
    if (image) map.addImage(id, image, { pixelRatio: 2 });
  }
  function addHotelLayer() {
    map.addSource('hotels', {
      type: 'geojson', data: fc([]), buffer: 160, maxzoom: 18,
      cluster: true, clusterRadius: 58, clusterMaxZoom: 16, clusterMinPoints: 2,
      clusterProperties: {
        selectedRank: ['max', ['get', 'selectedRank']],
        revision: ['max', ['get', 'revision']],
      },
    });
    const grouped = ['has', 'point_count'];
    const picked = ['>', ['get', 'selectedRank'], 0];
    map.addLayer({
      id: 'hotel-prices', source: 'hotels', type: 'symbol',
      layout: {
        'icon-image': ['case', grouped,
          ['concat', 'group|', ['to-string', ['get', 'point_count']], '|', ['to-string', ['get', 'selectedRank']]],
          ['get', 'icon']],
        'icon-anchor': 'bottom', 'icon-padding': 3,
        'icon-allow-overlap': false, 'icon-ignore-placement': false,
        // Placement gives lower keys first choice, including when the selected hotel belongs to a cluster.
        'symbol-sort-key': ['case', picked, 0, grouped, 1, ['-', 6, ['get', 'z']]],
      },
    });
    if (!home) return;
    map.addSource('location', { type: 'geojson', data: fc([{ type: 'Feature', geometry: { type: 'Point', coordinates: home } }]) });
    map.addLayer({
      id: 'location-dot', source: 'location', type: 'circle',
      paint: { 'circle-radius': 5.5, 'circle-color': '#3a9fff', 'circle-stroke-color': 'white', 'circle-stroke-width': 2 },
    }, 'hotel-prices');
  }
  function update(hotelList, selectedHotel) {
    const revision = ++sourceRevision;
    const features = hotelList.map(hotel => {
      const selected = selectedHotel?.hotelId === hotel.hotelId;
      const icon = ['price', hotel.kind, hotel.kind === 'none' ? '—' : amount(hotel), Number(selected)].join('|');
      addSprite(icon);
      return {
        type: 'Feature', id: hotel.hotelId,
        geometry: { type: 'Point', coordinates: [hotel.longitude, hotel.latitude] },
        properties: {
          hotelId: hotel.hotelId, icon, z: selected ? 5 : priority[hotel.kind],
          selectedRank: selected ? hotel.rank : 0, revision,
        },
      };
    });
    map.getSource('hotels').setData(fc(features));
  }
  async function onMarkerClick(event) {
    const feature = event.features?.[0];
    if (!feature || feature.properties.revision !== sourceRevision) return;
    const ticket = ++markerAction;
    const props = feature.properties;
    if (!props.cluster) {
      onSelect(hotelById.get(props.hotelId));
      return;
    }
    try {
      const zoom = await map.getSource('hotels').getClusterExpansionZoom(props.cluster_id);
      if (props.revision !== sourceRevision || ticket !== markerAction) return;
      map.easeTo({
        center: feature.geometry.coordinates,
        zoom: Math.min(map.getMaxZoom(), Math.max(zoom + .08, map.getZoom() + .45)),
        padding: padding(), duration: time(370), easing,
      });
    } catch (error) {
      if (props.revision === sourceRevision && ticket === markerAction) {
        onError(error.message);
      }
    }
  }

  function cancelPending() { markerAction++; }
  map.on('styleimagemissing', event => addSprite(event.id));
  function attach() {
    addHotelLayer();
    map.on('click', 'hotel-prices', onMarkerClick);
    map.on('movestart', event => { if (event.originalEvent) cancelPending(); });
    map.on('mouseenter', 'hotel-prices', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'hotel-prices', () => { map.getCanvas().style.cursor = ''; });
  }
  return { attach, update, cancelPending };
}
