// MOCK TSA wait times. There is no free official real-time API; real options
// include scraping the MyTSA app data or airport-specific feeds (e.g. SEA and
// SFO publish live waits). Keep the same return shape when swapping in.
//
// The model: each airport has a base wait that scales with time-of-day rush
// curves (morning and afternoon peaks), plus small live jitter so refreshes
// feel real.

const LINES = [
  { id: "standard", label: "Standard" },
  { id: "precheck", label: "TSA PreCheck" },
  { id: "clear", label: "CLEAR" },
  { id: "clear_precheck", label: "CLEAR + PreCheck" },
];

// Multiplier vs. the standard line.
const LINE_FACTOR = { standard: 1, precheck: 0.35, clear: 0.45, clear_precheck: 0.2 };

// Busier hubs start with longer standard-line baselines (minutes).
const BASE_WAIT = {
  ATL: 28, JFK: 25, LAX: 26, ORD: 24, EWR: 24, MIA: 22,
  SFO: 20, SEA: 22, DEN: 20, BOS: 18, LGA: 18, DCA: 15,
};

function rushFactor(date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  // Morning peak ~05:30–08:30, afternoon peak ~15:00–18:30.
  const morning = Math.exp(-((hour - 7) ** 2) / 3);
  const evening = Math.exp(-((hour - 16.5) ** 2) / 4);
  return 0.5 + morning + 0.8 * evening;
}

/**
 * Wait times for every line at `airportCode`, as of `when` (defaults to now).
 * `jitter` adds live variance for refreshes.
 * @returns {{id, label, minutes}[]}
 */
export function getWaitTimes(airportCode, when = new Date(), jitter = true) {
  const base = BASE_WAIT[airportCode] ?? 20;
  const standard = base * rushFactor(when);
  return LINES.map((line) => {
    let minutes = standard * LINE_FACTOR[line.id];
    if (jitter) minutes += (Math.random() - 0.5) * 4;
    return { ...line, minutes: Math.max(2, Math.round(minutes)) };
  });
}

export function getWaitFor(airportCode, lineId, when = new Date()) {
  return getWaitTimes(airportCode, when, false).find((l) => l.id === lineId).minutes;
}
