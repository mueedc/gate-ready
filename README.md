# ✈️ Gate Ready — Door-to-Gate Airport Trip Planner

Plan your trip to the airport backwards from boarding time: pick how you're
getting there (ride / drive+park+shuttle / train), see TSA wait times for every
line, tell the app how long you want to hang at the gate, and get a live
**"leave by"** time and full timeline on a map.

## Run it

No build step, no dependencies to install:

```sh
cd airport-trip-planner
python3 -m http.server 8123
# open http://localhost:8123
```

(Any static file server works; a server is required because the app uses ES modules.)

## How it works

1. **Your Flight** — enter a starting address (or 📍 use browser geolocation),
   pick an airport + airline, enter a flight number.
2. **Getting There** — all three modes are quoted side-by-side with door-to-curb
   ETAs and estimated cost, plus a ⭐ **recommended pick**. The recommendation
   scores each mode on time + cost (valued at ~$1 ≈ 0.8 min) + reliability risk
   (driving modes carry traffic risk proportional to time on the road, parking
   adds a hassle penalty, rail gets a small flat penalty), and explains its
   reasoning. Driving routes are real (OSRM over OpenStreetMap); train times are
   modeled from the airport's rail line characteristics.
3. **Security & Arrival Style** — live waits for Standard / PreCheck / CLEAR /
   CLEAR+PreCheck, a slider from "arrive right at boarding" to lounge time, and
   a **lounge panel**: tap your memberships (Priority Pass, Amex Platinum,
   Sapphire Reserve, Venture X, airline club, premium cabin) to see which
   lounges you can use, how busy they are, and estimated entry waits. Club
   lounges check the airline you're flying. With 40+ min of gate buffer, the
   timeline suggests the best available lounge.
4. **Your Plan** — the timeline is computed *backwards* from boarding:
   gate buffer → walk to gate → TSA wait (evaluated at the hour you'd actually
   reach the checkpoint, so rush hour is priced in) → curb-to-security →
   travel time × live traffic factor → **leave by**.
5. **Start Trip** — live mode: traffic drifts, your position advances along the
   route on the map, TSA waits refresh every 10 s, and the whole plan re-flows.

## Real vs. mocked data

| Data | Source | Status |
|---|---|---|
| Geocoding | OSM Nominatim | **Real** (free, no key) |
| Driving routes & ETAs | OSRM demo server | **Real** (free, no key; no live traffic) |
| Map tiles | CARTO / OpenStreetMap | **Real** |
| Flight schedule/gate | `js/services/flights.js` | **Mock** (deterministic) |
| TSA wait times | `js/services/tsa.js` | **Mock** (time-of-day rush model + jitter) |
| Lounge directory | `js/services/lounges.js` | **Static** (representative lounges + seat counts) |
| Lounge occupancy | `js/services/lounges.js` | **Modeled** — hourly departing pax (annual enplanements × departure-bank curve) × share of flyers with access (cabin mix, card penetration w/ regional multipliers, hub share for airline clubs) × visit rate × dwell time ÷ seats |
| Parking rates & transit fares | `js/data/airports.js` | **Static** (representative) |
| Live traffic | factor in `js/app.js` | **Simulated** (random walk) |
| Train routing | `js/services/routing.js` | **Estimated** (headway + avg line speed) |

Each mock lives behind a small function with a documented return shape — swap
the body, keep the shape:

- **Flights** → FlightAware AeroAPI, Aviationstack, or airline APIs
  (`lookupFlight` in `js/services/flights.js`).
- **TSA waits** → MyTSA app data or airport-published feeds (SEA, SFO, and
  others publish live waits) (`getWaitTimes` in `js/services/tsa.js`).
- **Lounges** → LoungeBuddy/Amex data or Priority Pass app data
  (`getLounges` in `js/services/lounges.js`).
- **Live traffic + transit routing** → Google Routes or Mapbox Directions
  (replace `drivingRoute`/`trainRoute` in `js/services/routing.js` and drop the
  traffic factor).
- **Live position** → `navigator.geolocation.watchPosition` instead of the
  simulated progress in `liveTick` (`js/app.js`).

## Layout

```
index.html            page shell
css/style.css         dark theme, sidebar + map layout
js/app.js             state, plan math, live tick, rendering
js/map.js             Leaflet: route, markers, live position
js/util.js            time/distance helpers
js/data/airports.js   12 major US airports + airline list
js/services/          flights, tsa, geocode, routing (swap points)
```
