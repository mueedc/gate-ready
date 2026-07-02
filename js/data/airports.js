// Major US airports with coordinates and ground-transport characteristics.
// `train` is null when there is no rail connection to the terminal.
// `dailyUsd` / `fareUsd` are representative economy-parking and transit fares
// used by the mode-recommendation engine.
export const AIRPORTS = [
  {
    code: "JFK", name: "New York JFK", lat: 40.6413, lon: -73.7781,
    walkToGateMin: 14, curbToSecurityMin: 8,
    train: { name: "LIRR / E train + AirTrain", headwayMin: 10, avgSpeedKmh: 42, stationWalkMin: 8, fareUsd: 13 },
    parking: { name: "Long-term lot + AirTrain", shuttleMin: 15, dailyUsd: 20 },
  },
  {
    code: "LGA", name: "New York LaGuardia", lat: 40.7769, lon: -73.874,
    walkToGateMin: 10, curbToSecurityMin: 6,
    train: null,
    parking: { name: "Terminal garage", shuttleMin: 8, dailyUsd: 25 },
  },
  {
    code: "EWR", name: "Newark Liberty", lat: 40.6895, lon: -74.1745,
    walkToGateMin: 12, curbToSecurityMin: 7,
    train: { name: "NJ Transit + AirTrain", headwayMin: 15, avgSpeedKmh: 50, stationWalkMin: 8, fareUsd: 16 },
    parking: { name: "P6 economy + shuttle", shuttleMin: 14, dailyUsd: 27 },
  },
  {
    code: "SFO", name: "San Francisco Intl", lat: 37.6213, lon: -122.379,
    walkToGateMin: 12, curbToSecurityMin: 7,
    train: { name: "BART", headwayMin: 12, avgSpeedKmh: 55, stationWalkMin: 7, fareUsd: 10 },
    parking: { name: "Long-term + AirTrain", shuttleMin: 12, dailyUsd: 25 },
  },
  {
    code: "LAX", name: "Los Angeles Intl", lat: 33.9416, lon: -118.4085,
    walkToGateMin: 13, curbToSecurityMin: 8,
    train: { name: "Metro C/K + LAX shuttle", headwayMin: 12, avgSpeedKmh: 38, stationWalkMin: 10, fareUsd: 3.5 },
    parking: { name: "Economy lot E + shuttle", shuttleMin: 15, dailyUsd: 25 },
  },
  {
    code: "ORD", name: "Chicago O'Hare", lat: 41.9742, lon: -87.9073,
    walkToGateMin: 14, curbToSecurityMin: 8,
    train: { name: "CTA Blue Line", headwayMin: 8, avgSpeedKmh: 40, stationWalkMin: 7, fareUsd: 5 },
    parking: { name: "Economy lot F + shuttle", shuttleMin: 13, dailyUsd: 22 },
  },
  {
    code: "ATL", name: "Atlanta Hartsfield-Jackson", lat: 33.6407, lon: -84.4277,
    walkToGateMin: 16, curbToSecurityMin: 8,
    train: { name: "MARTA Red/Gold", headwayMin: 10, avgSpeedKmh: 45, stationWalkMin: 6, fareUsd: 2.5 },
    parking: { name: "Park-Ride + shuttle", shuttleMin: 12, dailyUsd: 19 },
  },
  {
    code: "BOS", name: "Boston Logan", lat: 42.3656, lon: -71.0096,
    walkToGateMin: 10, curbToSecurityMin: 6,
    train: { name: "Silver Line SL1", headwayMin: 10, avgSpeedKmh: 30, stationWalkMin: 6, fareUsd: 2.4 },
    parking: { name: "Economy lot + shuttle", shuttleMin: 10, dailyUsd: 29 },
  },
  {
    code: "SEA", name: "Seattle-Tacoma", lat: 47.4502, lon: -122.3088,
    walkToGateMin: 12, curbToSecurityMin: 7,
    train: { name: "Link Light Rail", headwayMin: 10, avgSpeedKmh: 40, stationWalkMin: 8, fareUsd: 3 },
    parking: { name: "Off-site lot + shuttle", shuttleMin: 12, dailyUsd: 32 },
  },
  {
    code: "DEN", name: "Denver Intl", lat: 39.8561, lon: -104.6737,
    walkToGateMin: 15, curbToSecurityMin: 8,
    train: { name: "RTD A Line", headwayMin: 15, avgSpeedKmh: 60, stationWalkMin: 6, fareUsd: 10 },
    parking: { name: "Pikes Peak lot + shuttle", shuttleMin: 14, dailyUsd: 17 },
  },
  {
    code: "DCA", name: "Washington Reagan", lat: 38.8512, lon: -77.0402,
    walkToGateMin: 9, curbToSecurityMin: 6,
    train: { name: "Metro Blue/Yellow", headwayMin: 8, avgSpeedKmh: 45, stationWalkMin: 5, fareUsd: 2.5 },
    parking: { name: "Economy lot + shuttle", shuttleMin: 10, dailyUsd: 25 },
  },
  {
    code: "MIA", name: "Miami Intl", lat: 25.7959, lon: -80.287,
    walkToGateMin: 12, curbToSecurityMin: 7,
    train: { name: "Metrorail Orange + MIA Mover", headwayMin: 12, avgSpeedKmh: 40, stationWalkMin: 8, fareUsd: 2.25 },
    parking: { name: "Economy lot + shuttle", shuttleMin: 12, dailyUsd: 17 },
  },
];

export const AIRLINES = [
  { code: "AA", name: "American Airlines" },
  { code: "DL", name: "Delta Air Lines" },
  { code: "UA", name: "United Airlines" },
  { code: "WN", name: "Southwest Airlines" },
  { code: "B6", name: "JetBlue" },
  { code: "AS", name: "Alaska Airlines" },
  { code: "NK", name: "Spirit Airlines" },
  { code: "F9", name: "Frontier Airlines" },
];

export function getAirport(code) {
  return AIRPORTS.find((a) => a.code === code);
}
