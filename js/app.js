import { AIRPORTS, AIRLINES, getAirport } from "./data/airports.js";
import { lookupFlight } from "./services/flights.js";
import { getWaitTimes } from "./services/tsa.js";
import { geocode, currentLocation } from "./services/geocode.js";
import { drivingRoute, trainRoute } from "./services/routing.js";
import { CREDENTIALS, getLounges, credentialLabel } from "./services/lounges.js";
import { initMap, showRoute, updateLivePosition } from "./map.js";
import { fmtTime, fmtDuration, el } from "./util.js";

const MODE_META = {
  ride:  { icon: "🚗", name: "Ride (Uber/Lyft/taxi)", emoji: "🚗" },
  drive: { icon: "🅿️", name: "Drive + Park + Shuttle", emoji: "🚙" },
  train: { icon: "🚆", name: "Train / Transit", emoji: "🚆" },
};

const state = {
  origin: null,        // {lat, lon, label}
  airport: null,
  flight: null,
  routes: {},          // {ride, drive, train} → {durationMin, distanceKm, coords}
  mode: "ride",
  tsaLine: "precheck",
  bufferMin: 30,
  credentials: new Set(), // lounge access the traveler holds
  trafficFactor: 1.0,  // live multiplier on drive/ride durations
  plan: null,
  live: { active: false, startedAt: null, plannedTravelMin: null },
};

// ---------------------------------------------------------------------------
// Setup

initMap();

el("airport-select").innerHTML = AIRPORTS.map(
  (a) => `<option value="${a.code}">${a.name} (${a.code})</option>`,
).join("");
el("airline-select").innerHTML = AIRLINES.map(
  (a) => `<option value="${a.code}">${a.name}</option>`,
).join("");
el("cred-chips").innerHTML = CREDENTIALS.map(
  (c) => `<button class="chip" data-cred="${c.id}">${c.label}</button>`,
).join("");
el("cred-chips").addEventListener("click", (e) => {
  const id = e.target.dataset?.cred;
  if (!id) return;
  state.credentials.has(id) ? state.credentials.delete(id) : state.credentials.add(id);
  e.target.classList.toggle("on");
  recompute();
});

el("lookup-btn").addEventListener("click", onLookup);
el("locate-btn").addEventListener("click", onLocate);
for (const id of ["origin-input", "flight-input"]) {
  el(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") onLookup();
  });
}
el("edit-trip-btn").addEventListener("click", () => {
  el("setup-view").classList.remove("hidden");
  el("plan-view").classList.add("hidden");
});
// TSA tiles double as the line selector.
el("tsa-waits").addEventListener("click", (e) => {
  const tile = e.target.closest(".tsa-wait");
  if (!tile) return;
  state.tsaLine = tile.dataset.line;
  recompute();
});
el("buffer-slider").addEventListener("input", (e) => {
  state.bufferMin = Number(e.target.value);
  el("buffer-label").textContent = `${state.bufferMin} min`;
  el("buffer-hint").textContent =
    state.bufferMin <= 10 ? "Living dangerously — arriving right at boarding." :
    state.bufferMin <= 45 ? "A comfortable cushion." :
    "Lounge time. Enjoy a drink before boarding. 🍸";
  recompute();
});
el("start-trip-btn").addEventListener("click", startTrip);

// Live tick: traffic drifts and TSA waits refresh even before departure.
setInterval(liveTick, 10_000);

// ---------------------------------------------------------------------------
// Flight lookup flow

// alert() is suppressed in embedded previews — show errors inline instead.
function showSetupError(msg) {
  const box = el("setup-error");
  box.classList.toggle("hidden", !msg);
  box.textContent = msg ?? "";
}

async function onLocate() {
  try {
    showSetupError(null);
    el("origin-input").value = "Locating…";
    const loc = await currentLocation();
    state.origin = loc;
    el("origin-input").value = loc.label;
  } catch (err) {
    el("origin-input").value = "";
    showSetupError(err.message);
  }
}

async function onLookup() {
  const btn = el("lookup-btn");
  const addr = el("origin-input").value.trim();
  const flightNum = el("flight-input").value.trim();
  showSetupError(null);
  if (!addr) return showSetupError("Enter your starting address (or tap 📍 to use your location).");
  if (!flightNum) return showSetupError("Enter your flight number.");

  btn.disabled = true;
  btn.textContent = "Looking up flight & routes…";
  try {
    if (!state.origin || state.origin.label !== addr) {
      state.origin = await geocode(addr);
    }
    state.airport = getAirport(el("airport-select").value);

    const [flight, driving] = await Promise.all([
      lookupFlight(el("airline-select").value, flightNum, state.airport.code),
      drivingRoute(state.origin, state.airport),
    ]);
    state.flight = flight;
    state.routes = {
      ride: driving,
      drive: driving, // same road route; parking/shuttle added in plan math
      train: state.airport.train ? trainRoute(state.origin, state.airport) : null,
    };
    if (!state.routes[state.mode]) state.mode = "ride";

    renderSummary();
    el("setup-view").classList.add("hidden");
    el("plan-view").classList.remove("hidden");
    recompute();
  } catch (err) {
    showSetupError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Plan My Trip →";
  }
}

function renderSummary() {
  const f = state.flight;
  el("summary-text").innerHTML = `
    <div class="summary-flight">${f.airline} ${f.flightNumber} · ${f.origin} → ${f.destination} ·
      departs ${fmtTime(f.departure)} · gate ${f.gate}</div>
    <div class="summary-route">from ${state.origin.label.split(",").slice(0, 3).join(",")}</div>`;
}

// ---------------------------------------------------------------------------
// Transport modes: duration, cost, and recommendation

function modeDurationMin(mode) {
  const route = state.routes[mode];
  if (!route) return null;
  let mins = route.durationMin;
  if (mode === "ride" || mode === "drive") mins *= state.trafficFactor;
  if (mode === "drive") mins += state.airport.parking.shuttleMin;
  return mins;
}

function modeCostUsd(mode) {
  const route = state.routes[mode];
  if (!route) return null;
  if (mode === "ride") return 4 + route.distanceKm * 1.8 + route.durationMin * 0.35;
  if (mode === "drive") return state.airport.parking.dailyUsd + route.distanceKm * 0.15;
  return state.airport.train.fareUsd;
}

// Score = minutes + cost (valued at ~$1 ≈ 0.8 min) + unreliability penalty.
// Driving modes carry traffic risk proportional to time on the road; parking
// adds hassle; rail runs on a schedule so its penalty is small and flat.
function recommendMode() {
  const scored = ["ride", "drive", "train"]
    .filter((m) => state.routes[m])
    .map((mode) => {
      const duration = modeDurationMin(mode);
      const cost = modeCostUsd(mode);
      const risk =
        mode === "ride" ? 0.1 * duration :
        mode === "drive" ? 0.15 * duration + 8 :
        4;
      return { mode, duration, cost, risk, score: duration + cost * 0.8 + risk };
    })
    .sort((a, b) => a.score - b.score);

  const best = scored[0];
  const ride = scored.find((s) => s.mode === "ride");
  const train = scored.find((s) => s.mode === "train");

  let why;
  if (best.mode === "train") {
    why = `Immune to traffic and ~$${Math.round(ride.cost - best.cost)} cheaper than a ride, for ${Math.round(best.duration - ride.duration)} min more.`;
  } else if (best.mode === "ride") {
    why = train
      ? `Fastest door to curb — ${Math.round(train.duration - best.duration)} min quicker than transit, no parking hassle.`
      : "Fastest option, and no parking hassle or shuttle to catch.";
  } else {
    why = `Cheapest overall (~$${Math.round(best.cost)} parking + gas) and your car is waiting when you land.`;
  }
  return { ...best, why };
}

function renderModes() {
  const reco = recommendMode();
  el("mode-reco").innerHTML = `
    <div class="reco-title">⭐ Our pick: ${MODE_META[reco.mode].name}</div>
    <div class="reco-why">${reco.why}</div>`;

  const container = el("mode-options");
  container.innerHTML = "";
  for (const mode of ["ride", "drive", "train"]) {
    const meta = MODE_META[mode];
    const route = state.routes[mode];
    const div = document.createElement("div");
    div.className = "mode-option";

    if (!route) {
      div.classList.add("unavailable");
      div.innerHTML = `
        <span class="mode-icon">${meta.icon}</span>
        <div><div class="mode-name">${meta.name}</div>
        <div class="mode-detail">No rail connection at ${state.airport.code}</div></div>`;
      container.appendChild(div);
      continue;
    }

    const detail =
      mode === "drive" ? state.airport.parking.name :
      mode === "train" ? `${state.airport.train.name} (estimated)` :
      `${route.distanceKm.toFixed(0)} km via fastest roads`;

    if (mode === state.mode) div.classList.add("selected");
    div.innerHTML = `
      ${mode === reco.mode ? '<span class="reco-badge">RECOMMENDED</span>' : ""}
      <span class="mode-icon">${meta.icon}</span>
      <div><div class="mode-name">${meta.name}</div>
      <div class="mode-detail">${detail}</div></div>
      <div class="mode-eta">${fmtDuration(modeDurationMin(mode))}<small>~$${Math.round(modeCostUsd(mode))} · door to curb</small></div>`;
    div.addEventListener("click", () => {
      state.mode = mode;
      recompute();
    });
    container.appendChild(div);
  }
}

// ---------------------------------------------------------------------------
// Lounges

function eligibleLounges() {
  return getLounges(state.airport.code, state.flight.airline, state.credentials)
    .filter((l) => l.eligible);
}

function renderLounges() {
  const lounges = getLounges(state.airport.code, state.flight.airline, state.credentials);
  if (!lounges.length) {
    el("lounge-list").innerHTML = `<div class="lounge-empty">No lounge data for ${state.airport.code}.</div>`;
    return;
  }
  const anyCreds = state.credentials.size > 0;
  el("lounge-list").innerHTML =
    (anyCreds ? "" : `<div class="lounge-empty">Tap your memberships above to see which lounges you can use.</div>`) +
    lounges
      .map((l) => {
        const meta = l.eligible
          ? `${l.terminal} · via ${credentialLabel(l.via)}`
          : !l.airlineOk
            ? `${l.terminal} · ${l.airline} passengers only`
            : `${l.terminal} · needs ${l.access.map(credentialLabel).join(" or ")}`;
        const wait = l.eligible && l.waitMin ? ` · ~${l.waitMin} min entry wait` : "";
        return `<div class="lounge ${l.eligible ? "" : "locked"}">
          <div class="lounge-head">
            <span class="lounge-name">${l.eligible ? "✓ " : "🔒 "}${l.name}</span>
            <span class="lounge-status ${l.cls}">${l.status} · ~${l.pctFull}%</span>
          </div>
          <div class="lounge-meta">${meta}${wait}</div>
        </div>`;
      })
      .join("");
}

// ---------------------------------------------------------------------------
// Plan math — work backwards from boarding time

function buildPlan() {
  const { airport, flight } = state;
  const travelMin = modeDurationMin(state.mode);

  const gateArrival = new Date(flight.boarding.getTime() - state.bufferMin * 60_000);
  const securityDone = new Date(gateArrival.getTime() - airport.walkToGateMin * 60_000);

  // Evaluate the TSA wait at the time you'd actually reach the checkpoint:
  // first pass with the current wait, second pass with the wait at that hour.
  let wait = tsaWaitAt(securityDone);
  wait = tsaWaitAt(new Date(securityDone.getTime() - wait * 60_000));

  const securityStart = new Date(securityDone.getTime() - wait * 60_000);
  const curbArrival = new Date(securityStart.getTime() - airport.curbToSecurityMin * 60_000);
  const leave = new Date(curbArrival.getTime() - travelMin * 60_000);

  // If there's real hang time and a lounge to spend it in, say so.
  const lounge = state.bufferMin >= 40 ? eligibleLounges()[0] : null;
  const gateDetail =
    state.bufferMin === 0 ? "Right at boarding — no cushion" :
    lounge ? `${state.bufferMin} min — relax at ${lounge.name} (${lounge.terminal})` :
    `${state.bufferMin} min to relax before boarding`;

  const steps = [
    { time: leave, name: `Leave home by ${MODE_META[state.mode].icon}`, detail: `${fmtDuration(travelMin)} ${state.mode === "train" ? "via " + airport.train.name : "with current traffic"}` },
    { time: curbArrival, name: `Arrive at ${airport.code}`, detail: state.mode === "drive" ? `includes ${airport.parking.name}` : `${airport.name}` },
    { time: securityStart, name: "Enter security line", detail: `${lineLabel(state.tsaLine)} · ~${wait} min wait` },
    { time: securityDone, name: "Through security", detail: `${airport.walkToGateMin} min walk to gate ${flight.gate}` },
    { time: gateArrival, name: lounge ? "Lounge, then gate" : "At the gate", detail: gateDetail },
    { time: flight.boarding, name: "Boarding begins", detail: `Gate ${flight.gate}` },
    { time: flight.departure, name: "Wheels up 🛫", detail: `${flight.airline} ${flight.flightNumber} to ${flight.destination}` },
  ];

  return { leave, curbArrival, travelMin, wait, steps };
}

function tsaWaitAt(when) {
  const lines = getWaitTimes(state.airport.code, when, false);
  return lines.find((l) => l.id === state.tsaLine).minutes;
}

function lineLabel(id) {
  return { standard: "Standard", precheck: "TSA PreCheck", clear: "CLEAR", clear_precheck: "CLEAR + PreCheck" }[id];
}

// ---------------------------------------------------------------------------
// Rendering

function recompute() {
  if (!state.flight) return;
  state.plan = buildPlan();
  renderTsaWaits();
  renderModes();
  renderLounges();
  renderPlan();
  showRoute(state.origin, state.airport, state.routes[state.mode]);
  renderMapEta();
}

function renderTsaWaits() {
  const waits = getWaitTimes(state.airport.code);
  el("tsa-waits").innerHTML = waits
    .map((w) => {
      const cls = w.minutes <= 12 ? "short" : w.minutes <= 25 ? "medium" : "long";
      const sel = w.id === state.tsaLine ? "selected" : "";
      return `<button class="tsa-wait ${sel}" data-line="${w.id}">
        <div class="tsa-name">${sel ? "✓ " : ""}${w.label}</div>
        <div class="tsa-mins ${cls}">${w.minutes} min</div>
      </button>`;
    })
    .join("");
}

function renderPlan() {
  const { plan } = state;
  const minsUntilLeave = (plan.leave.getTime() - Date.now()) / 60_000;

  const doorToGate = (plan.steps[4].time - plan.leave) / 60_000;
  const banner = el("leave-banner");
  banner.classList.toggle("urgent", minsUntilLeave < 15);
  banner.innerHTML = `
    <div class="leave-main">
      <span class="leave-caption">Leave by</span>
      <span class="leave-time">${fmtTime(plan.leave)}</span>
    </div>
    <div class="leave-sub">door → gate <strong>${fmtDuration(doorToGate)}</strong> · ${
      state.live.active ? "trip in progress" :
      minsUntilLeave < 0 ? "⚠️ you should already be on your way!" :
      `that's in <strong>${fmtDuration(minsUntilLeave)}</strong>`
    }</div>`;

  const now = Date.now();
  el("timeline").innerHTML = plan.steps
    .map(
      (s) => `<li class="${s.time.getTime() < now && state.live.active ? "done" : ""}">
        <span class="step-time">${fmtTime(s.time)}</span>
        <span><span class="step-name">${s.name}</span>
        <span class="step-detail">${s.detail}</span></span>
      </li>`,
    )
    .join("");
}

function renderMapEta() {
  const box = el("map-eta");
  box.classList.remove("hidden");
  const doorToGate = (state.plan.steps[4].time - state.plan.leave) / 60_000;
  box.innerHTML = `
    <div class="eta-big">${fmtDuration(doorToGate)}</div>
    <div class="eta-caption">door → gate · ${state.airport.code} · ${lineLabel(state.tsaLine)}</div>
    <div class="eta-caption">traffic ×${state.trafficFactor.toFixed(2)}</div>`;
}

// ---------------------------------------------------------------------------
// Live mode — traffic drifts, position advances, plan re-flows

function startTrip() {
  state.live = {
    active: true,
    startedAt: Date.now(),
    plannedTravelMin: modeDurationMin(state.mode),
  };
  el("start-trip-btn").classList.add("hidden");
  el("live-status").classList.remove("hidden");
  liveTick();
}

function liveTick() {
  if (!state.flight) return;

  // Traffic random-walk: gentle before departure, choppier once driving.
  const volatility = state.live.active && state.mode !== "train" ? 0.06 : 0.02;
  state.trafficFactor = Math.min(1.7, Math.max(0.8, state.trafficFactor + (Math.random() - 0.48) * volatility));

  if (state.live.active) {
    const elapsedMin = (Date.now() - state.live.startedAt) / 60_000;
    const currentTravelMin = modeDurationMin(state.mode);
    const progress = Math.min(1, elapsedMin / currentTravelMin);
    updateLivePosition(state.routes[state.mode], progress, MODE_META[state.mode].emoji);

    const remainingMin = Math.max(0, currentTravelMin - elapsedMin);
    const eta = new Date(Date.now() + remainingMin * 60_000);
    const deltaMin = Math.round(currentTravelMin - state.live.plannedTravelMin);
    const status =
      deltaMin > 3 ? `🔴 Traffic is heavier — running ~${deltaMin} min behind plan.` :
      deltaMin < -3 ? `🟢 Traffic cleared up — ~${-deltaMin} min ahead of plan.` :
      "🟢 On track.";
    el("live-status").innerHTML = `
      <div class="live-headline"><span class="pulse"></span>Live · arriving ${state.airport.code} ${fmtTime(eta)}</div>
      <div>${status} TSA waits refresh every 10s.</div>`;
  }

  recompute();
}
