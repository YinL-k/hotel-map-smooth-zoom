// Synthetic hotel coordinates and prices for exercising the map.
(() => {
  let seed = 917;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const hotels = [];
  function add(longitude, latitude, price) {
    const rank = hotels.length + 1;
    hotels.push({
      hotelId: 'demo-' + String(rank).padStart(3, '0'),
      longitude, latitude,
      priceMinor: price === null ? null : price * 100,
      rank,
    });
    random(); // Retain the fixture sequence used by the original demo.
  }

  add(116.453, 39.921, 776);
  add(116.420, 39.876, 707);
  add(116.390, 39.880, 574);
  add(116.428, 39.921, 1130);
  add(116.444, 39.975, 1155);
  add(116.460, 39.945, 2158);
  add(116.435, 39.952, null);

  const groups = [
    [26, 116.39, 39.97, .27, .18], [8, 116.40, 39.70, .08, .05],
    [3, 116.70, 39.52, .04, .03], [3, 116.78, 40.02, .06, .04],
  ];
  const prices = [498, 575, 658, 472, 1256, 657, 620, 830, 990];
  for (const [count, longitude, latitude, width, height] of groups) {
    for (let i = 0; i < count; i++) {
      add(longitude + (random() - .5) * width, latitude + (random() - .5) * height, prices[i % prices.length]);
    }
  }
  add(116.93, 40.20, 302);
  add(116.20, 40.22, null);
  window.DEMO_HOTELS = hotels;
})();
