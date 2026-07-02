// Lounge directory + demand-modeled occupancy.
//
// Occupancy is a CONSERVATIVE ESTIMATE built from outgoing-flight volume:
//
//   occupants(t) = hourly departing pax(t)            [enplanements × bank curve]
//                × share of flyers with access         [cabin mix + card penetration]
//                × hub share (airline-restricted only) [that airline's pax share]
//                × visit rate × dwell hours
//   fullness    = occupants / seats
//
// All shares are regional/national averages, deliberately on the low side —
// documented next to each constant. Swap in real data later (airline load
// feeds, lounge operator APIs) without changing the return shape.
//
// Access credential ids:
//   pp      Priority Pass
//   amex    Amex Platinum / Centurion card
//   csr     Chase Sapphire Reserve
//   v1x     Capital One Venture X
//   club    Airline club membership (must match the airline you're flying)
//   premium Business/First-class ticket (must match the airline you're flying)

export const CREDENTIALS = [
  { id: "pp", label: "Priority Pass" },
  { id: "amex", label: "Amex Platinum" },
  { id: "csr", label: "Sapphire Reserve" },
  { id: "v1x", label: "Venture X" },
  { id: "club", label: "Airline club" },
  { id: "premium", label: "Biz/First ticket" },
];

// Share of departing flyers holding each credential (conservative national
// averages). Card shares get the airport's regional multiplier; cabin/club
// shares don't (they travel with the flight mix, not the local population).
const CREDENTIAL_SHARE = {
  pp: 0.02,      // PP holders who actually use lounges
  amex: 0.025,   // Amex Platinum/Centurion penetration among flyers
  csr: 0.015,    // Chase Sapphire Reserve
  v1x: 0.008,    // Capital One Venture X
  club: 0.03,    // paid airline-club members among that airline's flyers
  premium: 0.06, // first/business cabin share of seats (domestic-weighted)
};
const CARD_CREDS = new Set(["pp", "amex", "csr", "v1x"]);
const MAX_ACCESS_SHARE = 0.12; // cap — credentials overlap heavily
const VISIT_RATE = 0.55;       // eligible flyers who actually stop in
const DWELL_HOURS = 1.3;       // average lounge stay

// Annual enplanements (departing pax, millions, ~2024), regional premium-card
// multiplier (coastal metros index higher), and each airline's share of the
// airport's departures (used for airline-restricted club lounges).
const AIRPORT_STATS = {
  ATL: { enplanementsM: 52, cardMult: 0.9, airlineShare: { DL: 0.70 } },
  LAX: { enplanementsM: 40, cardMult: 1.3, airlineShare: { DL: 0.18, UA: 0.15, AA: 0.15, AS: 0.07 } },
  DEN: { enplanementsM: 38, cardMult: 1.1, airlineShare: { UA: 0.40, WN: 0.30, DL: 0.07 } },
  ORD: { enplanementsM: 36, cardMult: 1.1, airlineShare: { UA: 0.45, AA: 0.35, DL: 0.07 } },
  JFK: { enplanementsM: 30, cardMult: 1.4, airlineShare: { DL: 0.30, B6: 0.25, AA: 0.12 } },
  SFO: { enplanementsM: 26, cardMult: 1.5, airlineShare: { UA: 0.45, DL: 0.10, AS: 0.09 } },
  SEA: { enplanementsM: 25, cardMult: 1.2, airlineShare: { AS: 0.50, DL: 0.20 } },
  MIA: { enplanementsM: 24, cardMult: 1.0, airlineShare: { AA: 0.65, DL: 0.07 } },
  EWR: { enplanementsM: 24, cardMult: 1.4, airlineShare: { UA: 0.65 } },
  BOS: { enplanementsM: 20, cardMult: 1.2, airlineShare: { B6: 0.30, DL: 0.20, AA: 0.12 } },
  LGA: { enplanementsM: 16, cardMult: 1.4, airlineShare: { DL: 0.30, AA: 0.25 } },
  DCA: { enplanementsM: 13, cardMult: 1.2, airlineShare: { AA: 0.50, DL: 0.12 } },
};
const DEFAULT_AIRLINE_SHARE = 0.10;

// Share of the day's departures leaving in each hour (US bank structure:
// big 6–9a push, steady midday, second bank 4–7p). Normalized below.
const HOURLY_DEPARTURE_WEIGHT = [
  0.2, 0.1, 0.1, 0.2, 0.8, 2.5, 3.5, 3.5, 3.0, 2.5, 2.2, 2.2, // 00–11
  2.2, 2.2, 2.3, 2.5, 2.8, 3.0, 2.8, 2.3, 1.8, 1.2, 0.6, 0.3, // 12–23
];
const WEIGHT_SUM = HOURLY_DEPARTURE_WEIGHT.reduce((a, b) => a + b, 0);

// `airline` restricts a lounge to passengers of that airline (club lounges).
// `seats` are approximate published/reported capacities.
const LOUNGES = {
  JFK: [
    { name: "Centurion Lounge", terminal: "T4", access: ["amex"], seats: 315 },
    { name: "Delta Sky Club", terminal: "T4", access: ["club", "premium", "amex"], airline: "DL", seats: 600 },
    { name: "Chase Sapphire Lounge", terminal: "T4", access: ["csr", "pp"], seats: 350 },
    { name: "Primeclass Lounge", terminal: "T1", access: ["pp"], seats: 150 },
  ],
  LGA: [
    { name: "Centurion Lounge", terminal: "Terminal B", access: ["amex"], seats: 300 },
    { name: "Chase Sapphire Lounge", terminal: "Terminal B", access: ["csr", "pp"], seats: 320 },
    { name: "Delta Sky Club", terminal: "Terminal C", access: ["club", "premium", "amex"], airline: "DL", seats: 500 },
  ],
  EWR: [
    { name: "United Club", terminal: "Terminal C", access: ["club", "premium"], airline: "UA", seats: 500 },
    { name: "United Polaris Lounge", terminal: "Terminal C", access: ["premium"], airline: "UA", seats: 400 },
    { name: "Art & Lounge", terminal: "Terminal B", access: ["pp"], seats: 120 },
  ],
  SFO: [
    { name: "Centurion Lounge", terminal: "T3", access: ["amex"], seats: 300 },
    { name: "United Club", terminal: "T3", access: ["club", "premium"], airline: "UA", seats: 400 },
    { name: "Air France-KLM Lounge", terminal: "Intl A", access: ["pp"], seats: 180 },
    { name: "Delta Sky Club", terminal: "T1", access: ["club", "premium", "amex"], airline: "DL", seats: 250 },
  ],
  LAX: [
    { name: "Centurion Lounge", terminal: "TBIT", access: ["amex"], seats: 320 },
    { name: "Delta Sky Club", terminal: "T3", access: ["club", "premium", "amex"], airline: "DL", seats: 450 },
    { name: "United Club", terminal: "T7", access: ["club", "premium"], airline: "UA", seats: 350 },
    { name: "Alaska Lounge", terminal: "T6", access: ["club", "premium"], airline: "AS", seats: 180 },
  ],
  ORD: [
    { name: "United Club", terminal: "T1", access: ["club", "premium"], airline: "UA", seats: 600 },
    { name: "Admirals Club", terminal: "T3", access: ["club", "premium"], airline: "AA", seats: 400 },
    { name: "Delta Sky Club", terminal: "T5", access: ["club", "premium", "amex"], airline: "DL", seats: 250 },
    { name: "Swissport Lounge", terminal: "T5", access: ["pp"], seats: 140 },
  ],
  ATL: [
    { name: "Delta Sky Club", terminal: "Concourse B", access: ["club", "premium", "amex"], airline: "DL", seats: 500 },
    { name: "The Club ATL", terminal: "Concourse F", access: ["pp"], seats: 150 },
    { name: "Centurion Lounge", terminal: "Concourse E", access: ["amex"], seats: 430 },
  ],
  BOS: [
    { name: "Delta Sky Club", terminal: "Terminal A", access: ["club", "premium", "amex"], airline: "DL", seats: 400 },
    { name: "Chase Sapphire Lounge", terminal: "Terminal B", access: ["csr", "pp"], seats: 300 },
    { name: "Air France Lounge", terminal: "Terminal E", access: ["pp"], seats: 150 },
  ],
  SEA: [
    { name: "Alaska Lounge", terminal: "Concourse C", access: ["club", "premium"], airline: "AS", seats: 350 },
    { name: "Centurion Lounge", terminal: "Concourse B", access: ["amex"], seats: 200 },
    { name: "The Club SEA", terminal: "South Satellite", access: ["pp"], seats: 140 },
    { name: "Delta Sky Club", terminal: "Concourse A", access: ["club", "premium", "amex"], airline: "DL", seats: 450 },
  ],
  DEN: [
    { name: "Centurion Lounge", terminal: "Concourse C", access: ["amex"], seats: 320 },
    { name: "Capital One Lounge", terminal: "Concourse A", access: ["v1x"], seats: 300 },
    { name: "United Club", terminal: "Concourse B", access: ["club", "premium"], airline: "UA", seats: 450 },
    { name: "Delta Sky Club", terminal: "Concourse A", access: ["club", "premium", "amex"], airline: "DL", seats: 300 },
  ],
  DCA: [
    { name: "Admirals Club", terminal: "Terminal C", access: ["club", "premium"], airline: "AA", seats: 350 },
    { name: "Delta Sky Club", terminal: "Terminal B", access: ["club", "premium", "amex"], airline: "DL", seats: 200 },
  ],
  MIA: [
    { name: "Centurion Lounge", terminal: "Concourse D", access: ["amex"], seats: 300 },
    { name: "Admirals Club", terminal: "Concourse D", access: ["club", "premium"], airline: "AA", seats: 350 },
    { name: "LATAM VIP Lounge", terminal: "Concourse J", access: ["pp"], seats: 250 },
  ],
};

function occupancy(lounge, airportCode, when = new Date()) {
  const stats = AIRPORT_STATS[airportCode] ?? { enplanementsM: 20, cardMult: 1, airlineShare: {} };

  const dailyPax = (stats.enplanementsM * 1e6) / 365;
  const hourlyPax = dailyPax * (HOURLY_DEPARTURE_WEIGHT[when.getHours()] / WEIGHT_SUM);

  let accessShare = lounge.access.reduce(
    (sum, c) => sum + CREDENTIAL_SHARE[c] * (CARD_CREDS.has(c) ? stats.cardMult : 1),
    0,
  );
  accessShare = Math.min(accessShare, MAX_ACCESS_SHARE);

  const airlineShare = lounge.airline
    ? (stats.airlineShare[lounge.airline] ?? DEFAULT_AIRLINE_SHARE)
    : 1;

  const occupants = hourlyPax * accessShare * airlineShare * VISIT_RATE * DWELL_HOURS;
  const pct = occupants / lounge.seats;

  const pctFull = Math.min(120, Math.round(pct * 100));
  if (pct < 0.4) return { status: "Quiet", cls: "quiet", waitMin: 0, pctFull };
  if (pct < 0.7) return { status: "Moderate", cls: "moderate", waitMin: 0, pctFull };
  if (pct < 0.95) return { status: "Busy", cls: "busy", waitMin: 0, pctFull };
  return {
    status: "At capacity",
    cls: "busy",
    waitMin: Math.min(45, Math.round((pct - 0.95) * 80) + 10),
    pctFull,
  };
}

/**
 * All lounges at the airport, annotated with eligibility for this traveler
 * and estimated fullness. `credentials` is a Set of credential ids;
 * `airlineCode` is the airline flown. Eligible lounges sort first, quietest
 * first.
 */
export function getLounges(airportCode, airlineCode, credentials, when = new Date()) {
  return (LOUNGES[airportCode] ?? [])
    .map((l) => {
      const airlineOk = !l.airline || l.airline === airlineCode;
      const matched = l.access.filter((c) => credentials.has(c));
      return {
        ...l,
        ...occupancy(l, airportCode, when),
        eligible: airlineOk && matched.length > 0,
        via: matched[0] ?? null,
        airlineOk,
      };
    })
    .sort((a, b) => (b.eligible - a.eligible) || (a.pctFull - b.pctFull));
}

export function credentialLabel(id) {
  return CREDENTIALS.find((c) => c.id === id)?.label ?? id;
}
