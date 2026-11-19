const perkFixtureRanks = new Set([1, 2, 4, 6, 12, 14, 16, 18, 25, 27, 32, 35, 36, 42]);
const offerFixtureRanks = new Set([1, 4, 6, 14, 18, 25, 32, 42]);

function demoHotelStyle(hotel) {
  const perk = perkFixtureRanks.has(hotel.rank);
  const advantage = hotel.priceMinor !== null && offerFixtureRanks.has(hotel.rank);
  return {
    perk,
    advantage,
    kind: hotel.priceMinor === null ? 'none' : advantage ? 'advantage' : perk ? 'perk' : 'plain',
  };
}
