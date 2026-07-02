// API configuration. Fill these in as you get keys — each one upgrades a mock
// to live data with no other code changes. See docs/API_KEYS.md for the
// priority order, where to sign up, and how to keep keys safe.
//
// IMPORTANT: anything in this file ships to the browser. Only put keys here
// that the provider lets you RESTRICT BY DOMAIN (Mapbox tokens support this).
// Keys that can't be restricted (FlightAware AeroAPI) must live behind a tiny
// server-side proxy instead — set FLIGHT_PROXY_URL to that proxy's URL.

export const CONFIG = {
  // Mapbox public token (pk.*), URL-restricted to your deployed domain.
  // Unlocks: live-traffic driving ETAs + better address search.
  // https://account.mapbox.com/access-tokens/
  MAPBOX_TOKEN: "",

  // URL of your flight-lookup proxy (see docs/API_KEYS.md for a ready-made
  // Cloudflare Worker). Unlocks: real departure/boarding times and gates.
  // Example: "https://gate-ready-flights.yourname.workers.dev"
  FLIGHT_PROXY_URL: "",
};
