// Flight lookup. Uses your flight proxy when CONFIG.FLIGHT_PROXY_URL is set
// (a tiny server-side wrapper around FlightAware AeroAPI — see
// docs/API_KEYS.md for a copy-paste Cloudflare Worker); otherwise a
// deterministic mock so the app is fully usable without keys.
//
// The proxy is expected to respond to GET {FLIGHT_PROXY_URL}?ident=AA100 with:
//   { destination, gate, terminal, departureIso, boardingIso? }
// (boarding defaults to departure - 40 min when omitted.)

import { CONFIG } from "../config.js";

const DESTINATIONS = ["LHR", "CDG", "MEX", "AUS", "PHX", "MSP", "SLC", "SAN", "RDU", "BNA", "HNL", "YYZ"];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * @returns {Promise<{airline, flightNumber, origin, destination, gate, terminal,
 *                    departure: Date, boarding: Date}>}
 */
export async function lookupFlight(airlineCode, flightNumber, airportCode) {
  if (CONFIG.FLIGHT_PROXY_URL) {
    try {
      return await proxyLookup(airlineCode, flightNumber, airportCode);
    } catch (err) {
      console.warn("Flight proxy failed, falling back to mock:", err);
    }
  }
  return mockLookup(airlineCode, flightNumber, airportCode);
}

async function proxyLookup(airlineCode, flightNumber, airportCode) {
  const url = `${CONFIG.FLIGHT_PROXY_URL}?ident=${airlineCode}${flightNumber}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Flight lookup failed (${res.status})`);
  const f = await res.json();
  const departure = new Date(f.departureIso);
  return {
    airline: airlineCode,
    flightNumber: String(flightNumber),
    origin: airportCode,
    destination: f.destination ?? "—",
    gate: f.gate ?? "TBD",
    terminal: f.terminal ?? "TBD",
    departure,
    boarding: f.boardingIso ? new Date(f.boardingIso) : new Date(departure.getTime() - 40 * 60_000),
  };
}

// Deterministic: the same airline + flight number always returns the same
// departure time and gate, so the app feels consistent while testing.
async function mockLookup(airlineCode, flightNumber, airportCode) {
  // Simulate network latency so the UI's loading state is exercised.
  await new Promise((r) => setTimeout(r, 500));

  const h = hashCode(`${airlineCode}${flightNumber}${airportCode}`);

  // Departure sometime 2.5–9 hours from now, rounded to :00/:05, so the
  // planning math always has a realistic future flight to work with.
  const minutesOut = 150 + (h % 390);
  const departure = new Date(Date.now() + minutesOut * 60_000);
  departure.setMinutes(Math.round(departure.getMinutes() / 5) * 5, 0, 0);

  const boarding = new Date(departure.getTime() - 40 * 60_000);

  return {
    airline: airlineCode,
    flightNumber: String(flightNumber),
    origin: airportCode,
    destination: DESTINATIONS[h % DESTINATIONS.length],
    gate: `${"ABCD"[h % 4]}${(h % 38) + 1}`,
    terminal: `${(h % 5) + 1}`,
    departure,
    boarding,
  };
}
