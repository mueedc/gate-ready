# API Keys — priority order

Every integration below is already wired into the code: paste a value into
[`js/config.js`](../js/config.js) and the corresponding mock upgrades to live
data. No other code changes needed.

**Security rule of thumb:** `config.js` ships to every visitor's browser.
Only put keys there if the provider lets you restrict them by domain (Mapbox
does). Anything else goes behind a proxy (step 2 includes one ready to paste).

---

## 1. Mapbox token — live traffic ETAs + better address search
**The single biggest accuracy win.** OSRM gives road geometry but no traffic;
Mapbox `driving-traffic` durations reflect conditions right now, which is the
whole point of "when should I leave."

- Sign up: https://account.mapbox.com/ (free tier: 100k directions requests
  + 100k geocodes/month — plenty)
- Create a **public token (pk.…)** and under *Token restrictions → URLs* add
  your deployed domain (e.g. `https://yourname.github.io`) and
  `http://localhost:8123` for dev.
- Paste into `MAPBOX_TOKEN` in `js/config.js`.
- Unlocks automatically: `drivingRoute()` switches to live-traffic ETAs and
  `geocode()` switches to Mapbox address search.

## 2. FlightAware AeroAPI — real flight times, gates, delays
Real departure/boarding times, gate assignments, and delay updates.

- Sign up: https://www.flightaware.com/commercial/aeroapi/ — the **Personal**
  tier includes $5/month of free usage (a flight lookup is ~$0.005, so
  ~1,000 free lookups/month).
- AeroAPI keys cannot be domain-restricted, so they must NOT go in `config.js`.
  Deploy this free Cloudflare Worker as a proxy instead
  (https://workers.cloudflare.com, free tier 100k requests/day):

```js
// Cloudflare Worker: gate-ready-flights
// Set AEROAPI_KEY as a Secret in the Worker's Settings → Variables.
export default {
  async fetch(request, env) {
    const ident = new URL(request.url).searchParams.get("ident");
    if (!/^[A-Z0-9]{2}\d{1,4}$/.test(ident ?? ""))
      return json({ error: "bad ident" }, 400);

    const r = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/flights/${ident}`,
      { headers: { "x-apikey": env.AEROAPI_KEY } },
    );
    if (!r.ok) return json({ error: `aeroapi ${r.status}` }, 502);

    const data = await r.json();
    // First upcoming (not yet departed) leg.
    const f = (data.flights ?? []).find((f) => !f.actual_off) ?? data.flights?.[0];
    if (!f) return json({ error: "flight not found" }, 404);

    return json({
      destination: f.destination?.code_iata ?? f.destination?.code,
      gate: f.gate_origin,
      terminal: f.terminal_origin,
      departureIso: f.estimated_out ?? f.scheduled_out,
      boardingIso: null, // app defaults to departure − 40 min
    });
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // Lock this to your deployed domain once live:
      "access-control-allow-origin": "*",
    },
  });
}
```

- Paste the Worker URL into `FLIGHT_PROXY_URL` in `js/config.js`.
- Cheaper alternative if volume grows: Aviationstack (https://aviationstack.com,
  free 100 req/month) — adjust the Worker to map its response fields.

## 3. TSA wait times — no single API exists (yet)
There is no official nationwide real-time TSA API. Realistic paths, in order:

- **Per-airport feeds:** some airports publish live security waits (SEA, SFO,
  LAX, MCO among others) as JSON on their websites. Add a per-airport fetcher
  in `js/services/tsa.js` (`getWaitTimes()` is the one function to extend) and
  fall back to the current time-of-day model elsewhere.
- **TSA's MyTSA data** (crowd-sourced + historical) can be scraped via
  `https://www.tsa.gov/travel/security-screening/wait-times` — historical
  averages by day/hour, good for improving the rush-curve model even without
  live data.
- The current mock already models rush-hour curves per airport, so the app
  degrades gracefully wherever live data isn't available.

## 4. Lounge data — stay curated for now
Priority Pass, Amex, and airline clubs have no public APIs (LoungeBuddy's API
died when Amex acquired it). The curated directory in
`js/services/lounges.js` is the practical approach; revisit if you pursue a
partnership. Real-time occupancy is only published by a few operators (e.g.
Amex Centurion shows it in their app) and isn't publicly accessible.

---

## Suggested order of operations
1. Mapbox token (10 minutes, free) → live traffic + solid geocoding.
2. Cloudflare Worker + AeroAPI key (~30 minutes, free tier) → real flights.
3. Per-airport TSA feeds for the airports you actually use (an hour each).
4. Lounge partnerships — later, if ever.
