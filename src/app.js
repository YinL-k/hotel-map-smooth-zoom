(() => {
  'use strict';
  const hotels = window.DEMO_HOTELS.map(hotel => ({ ...hotel, kind: demoHotelStyle(hotel).kind }));
  const errors = [];
  const initial = {
    center: [116.425, 39.919], zoom: 10.35,
    padding: { top: 90, right: 16, bottom: 25, left: 16 },
  };
  const state = { selected: hotels[0] };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function drawHotel(ctx, x, y, dark) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = dark ? '#fff' : '#7c1e1e';
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.roundRect(.6, .6, 10.8, 10.8, 2.1);
    ctx.moveTo(3.3, 9.4);
    ctx.lineTo(3.3, 2.9);
    ctx.lineTo(8.7, 2.9);
    ctx.lineTo(8.7, 9.4);
    ctx.moveTo(4.7, 4.7);
    ctx.lineTo(5.5, 4.7);
    ctx.moveTo(6.5, 4.7);
    ctx.lineTo(7.3, 4.7);
    ctx.moveTo(4.7, 6.4);
    ctx.lineTo(5.5, 6.4);
    ctx.moveTo(6.5, 6.4);
    ctx.lineTo(7.3, 6.4);
    ctx.moveTo(5.4, 9.4);
    ctx.lineTo(5.4, 8);
    ctx.lineTo(6.6, 8);
    ctx.lineTo(6.6, 9.4);
    ctx.stroke();
    ctx.restore();
  }
  async function start() {
    const map = new maplibregl.Map({
      container: 'map', style: await loadMapStyle(), ...initial,
      minZoom: 8.7, maxZoom: 18, dragRotate: false, touchPitch: false,
      attributionControl: false, renderWorldCopies: false, fadeDuration: reduceMotion.matches ? 0 : 160,
      maxBounds: [[115.95, 39.52], [116.98, 40.35]],
    });
    map.touchZoomRotate.disableRotation();
    window.HotelDemo = { map, state, ready: false, errors };
    map.on('error', event => errors.push(event.error?.message));
    const markers = createHotelMarkers({
      map, hotels, drawLogo: drawHotel, padding: () => initial.padding,
      onSelect(hotel) {
        if (!hotel || hotel === state.selected) return;
        state.selected = hotel;
        markers.update(hotels, hotel);
      },
      onError: message => errors.push(message),
    });
    map.once('load', () => {
      markers.attach();
      markers.update(hotels, state.selected);
      document.getElementById('back').onclick = () => {
        markers.cancelPending();
        map.easeTo({ ...initial, duration: reduceMotion.matches ? 0 : 380 });
      };
      document.getElementById('map').setAttribute('aria-busy', 'false');
      window.HotelDemo.ready = true;
    });
  }
  start().catch(error => {
    const status = document.getElementById('mapError');
    status.textContent = '地图载入失败';
    status.hidden = false;
    console.error(error);
  });
})();
