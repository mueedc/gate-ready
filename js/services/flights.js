// Flight lookup, in order of preference:
//
//  1. Your flight proxy (CONFIG.FLIGHT_PROXY_URL) — real schedules, gates,
//     and the correct leg for the day. See docs/API_KEYS.md for the
//     copy-paste Cloudflare Worker around FlightAware AeroAPI.
//  2. adsbdb.com route database (free, no key) — the airline's registered
//     route for that flight number. Crowd-sourced and sometimes stale or a
//     different leg, so it is only trusted when its origin matches the
//     airport you picked.
//  3. Honest fallback — unknown fields show as "—"/"TBD" rather than
//     fabricated values. Departure time comes from your "Departs at" input
//     (or a deterministic placeholder so the planner still works).
//
// The proxy is expected to respond to GET {FLIGHT_PROXY_URL}?ident=AA100 with:
//   { destination, gate, terminal, departureIso, boardingIso? }
// (boarding defaults to departure - 40 min when omitted.)

import { CONFIG } from "../config.js";

// IATA airline code → ICAO callsign prefix (what route databases index by).
const ICAO_PREFIX = {
  AA: "AAL", DL: "DAL", UA: "UAL", WN: "SWA",
  B6: "JBU", AS: "ASA", NK: "NKS", F9: "FFT",
};

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * `departAt` (optional Date) is the user-confirmed departure time — a flight
 * number can fly the same route several times a day, so this pins the leg.
 *
 * @returns {Promise<{airline, flightNumber, origin, destination, gate, terminal,
 *                    departure: Date, boarding: Date}>}
 */
export async function lookupFlight(airlineCode, flightNumber, airportCode, departAt = null) {
  if (CONFIG.FLIGHT_PROXY_URL) {
    try {
      return await proxyLookup(airlineCode, flightNumber, airportCode, departAt);
    } catch (err) {
      console.warn("Flight proxy failed, falling back:", err);
    }
  }
  return routeDbLookup(airlineCode, flightNumber, airportCode, departAt);
}

async function proxyLookup(airlineCode, flightNumber, airportCode, departAt) {
  const timeParam = departAt ? `&time=${encodeURIComponent(departAt.toISOString())}` : "";
  const url = `${CONFIG.FLIGHT_PROXY_URL}?ident=${airlineCode}${flightNumber}${timeParam}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Flight lookup failed (${res.status})`);
  const f = await res.json();
  const departure = new Date(f.departureIso);
  return {
    airline: airlineCode,
    flightNumber: String(flightNumber),
    origin: airportCode,
    destination: f.destination ?? null,
    gate: f.gate ?? "TBD",
    terminal: f.terminal ?? "TBD",
    departure,
    boarding: f.boardingIso ? new Date(f.boardingIso) : new Date(departure.getTime() - 40 * 60_000),
  };
}

// Registered route from adsbdb. Only trusted when its origin matches the
// airport the traveler picked — route DBs lag when numbers are reassigned,
// and a wrong destination is worse than none.
async function fetchRoute(airlineCode, flightNumber, airportCode) {
  const prefix = ICAO_PREFIX[airlineCode];
  if (!prefix) return null;
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${prefix}${flightNumber}`);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.response?.flightroute;
    if (route?.origin?.iata_code === airportCode) return route.destination?.iata_code ?? null;
  } catch {
    /* offline or rate-limited — fall through */
  }
  return null;
}

async function routeDbLookup(airlineCode, flightNumber, airportCode, departAt) {
  const destination = await fetchRoute(airlineCode, flightNumber, airportCode);

  // User-confirmed time wins; otherwise a deterministic placeholder 2.5–9
  // hours out so the planner still has a future flight to work with.
  let departure;
  if (departAt) {
    departure = new Date(departAt);
  } else {
    const h = hashCode(`${airlineCode}${flightNumber}${airportCode}`);
    departure = new Date(Date.now() + (150 + (h % 390)) * 60_000);
    departure.setMinutes(Math.round(departure.getMinutes() / 5) * 5, 0, 0);
  }

  return {
    airline: airlineCode,
    flightNumber: String(flightNumber),
    origin: airportCode,
    destination, // null → shown as "—" until a real flight API is connected
    gate: "TBD",
    terminal: "TBD",
    departure,
    boarding: new Date(departure.getTime() - 40 * 60_000),
  };
}
