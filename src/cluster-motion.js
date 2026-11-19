function createClusterMotion({ map, onMarkerClick }) {
  const layer = 'hotel-prices';
  const canvas = document.createElement('canvas');
  canvas.className = 'hotel-motion';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  map.getContainer().append(canvas);
  const ctx = canvas.getContext('2d');
  const images = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stats = { splits: 0, merges: 0 };
  let active = new Map();
  let departing = [];
  let drawn = [];
  let running = false;

  function imageFor(key) {
    if (images.has(key)) return images.get(key);
    const image = map.getImage(key)?.data;
    if (!image) return null;
    const sprite = document.createElement('canvas');
    sprite.width = image.width;
    sprite.height = image.height;
    sprite.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    images.set(key, sprite);
    return sprite;
  }

  function position(record, now) {
    const target = map.project(record.coordinates);
    const progress = record.duration ? Math.min(1, (now - record.started) / record.duration) : 1;
    if (progress === 1) return { x: target.x, y: target.y, progress, offset: 0 };
    const origin = map.project(record.origin);
    const remaining = (1 - progress) ** 3;
    const dx = (origin.x - target.x) * remaining;
    const dy = (origin.y - target.y) * remaining;
    return { x: target.x + dx, y: target.y + dy, progress, offset: Math.hypot(dx, dy) };
  }

  function related(record, candidates) {
    let best, longest = 0;
    for (const candidate of candidates) {
      if (!record.feature.properties.cluster && !candidate.feature.properties.cluster) continue;
      const shared = record.ranks.filter(rank => candidate.ranks.includes(rank)).length;
      if (shared > longest || shared === longest && shared > 0 && candidate.selected && !best?.selected) {
        best = candidate;
        longest = shared;
      }
    }
    return best;
  }

  function animateIn(record, parent, now) {
    const from = position(parent, now);
    const to = map.project(record.coordinates);
    const dx = from.x - to.x, dy = from.y - to.y;
    const scale = Math.min(1, 58 / Math.max(1, Math.hypot(dx, dy)));
    record.origin = map.unproject([to.x + dx * scale, to.y + dy * scale]).toArray();
    record.started = now;
    record.duration = 240;
  }

  function sync(now) {
    const next = new Map();
    for (const feature of map.queryRenderedFeatures({ layers: [layer] })) {
      const p = feature.properties;
      const ranks = String(p.members ?? '').split(',').filter(Boolean).map(Number).sort((a,b) => a - b);
      if (!ranks.length) continue;
      const key = ranks.join(',');
      if (next.has(key)) continue;
      const record = active.get(key) ?? { key, ranks, duration: 0 };
      record.feature = feature;
      record.coordinates = feature.geometry.coordinates;
      record.selected = p.selectedRank > 0;
      record.priority = p.cluster ? 1 : 6 - p.z;
      record.icon = p.cluster ? ['group', p.point_count, p.selectedRank].join('|') : p.icon;
      next.set(key, record);
    }
    if (!reducedMotion.matches) {
      const previous = [...active.values()];
      for (const record of next.values()) {
        if (active.has(record.key)) continue;
        const linked = related(record, previous);
        if (!linked) continue;
        if (record.ranks.length < linked.ranks.length) stats.splits++;
        else if (record.ranks.length > linked.ranks.length) stats.merges++;
        animateIn(record, linked, now);
      }
      departing = departing.filter(record => !next.has(record.key) && now - record.started < record.duration);
      for (const record of previous) {
        if (next.has(record.key)) continue;
        const target = related(record, next.values());
        if (!target || target.ranks.length <= record.ranks.length) continue;
        const from = position(record, now);
        departing.push({
          ...record, leaving: true, started: now, duration: 175,
          origin: map.unproject([from.x, from.y]).toArray(), coordinates: target.coordinates,
        });
      }
    } else {
      departing = [];
      for (const record of next.values()) record.duration = 0;
    }
    active = next;
  }

  function render() {
    const now = performance.now();
    sync(now);
    const { clientWidth, clientHeight } = map.getContainer();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(clientWidth * ratio), height = Math.round(clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, clientWidth, clientHeight);
    drawn = [];
    let moving = false;
    const records = [...active.values(), ...departing].map(record => {
      const projected = position(record, now);
      const order = record.leaving ? 20 : record.selected ? 0 : record.priority + (projected.progress < 1 ? 8 : 0);
      return { record, projected, order };
    }).sort((a,b) => a.order - b.order);
    for (const { record, projected } of records) {
      const sprite = imageFor(record.icon);
      if (!sprite) continue;
      const { x, y, progress, offset } = projected;
      moving ||= progress < 1;
      const w = sprite.width / 2, h = sprite.height / 2;
      const left = x - w / 2, top = y - h;
      if (left + w < 0 || left > clientWidth || y < 0 || top > clientHeight) continue;
      if (drawn.some(box => left < box.left + box.w + 2 && left + w + 2 > box.left
        && top < box.top + box.h + 2 && top + h + 2 > box.top)) continue;
      ctx.globalAlpha = record.leaving ? (1 - progress) : .55 + .45 * progress;
      ctx.drawImage(sprite, left, top, w, h);
      drawn.push({ key: record.key, feature: record.feature, leaving: Boolean(record.leaving), left, top, w, h, offset });
    }
    ctx.globalAlpha = 1;
    running = moving;
    if (running) map.triggerRepaint();
  }

  function hit(point) {
    return drawn.find(box => !box.leaving && point.x >= box.left && point.x <= box.left + box.w
      && point.y >= box.top && point.y <= box.top + box.h)?.feature;
  }

  map.on('render', render);
  map.on('click', event => onMarkerClick({ features: [hit(event.point)] }));
  map.on('mousemove', event => { map.getCanvas().style.cursor = hit(event.point) ? 'pointer' : ''; });
  map.on('mouseout', () => { map.getCanvas().style.cursor = ''; });
  map.once('remove', () => canvas.remove());
  return {
    snapshot: () => ({ ...stats, running, boxes: drawn.map(({ feature, ...box }) => box) }),
  };
}
