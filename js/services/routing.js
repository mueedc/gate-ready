// Driving routes. Two backends, picked automatically:
//  - Mapbox Directions `driving-traffic` when CONFIG.MAPBOX_TOKEN is set —
//    durations include LIVE traffic (the single biggest accuracy win).
//  - Public OSRM demo server otherwise — real road geometry, no traffic,
//    fine for development but rate-limited (not for production use).

import { CONFIG } from "../config.js";
import { haversineKm } from "../util.js";

/**
 * @returns {Promise<{durationMin: number, distanceKm: number,
 *                    coords: [lat, lon][], liveTraffic: boolean}>}
 */
export async function drivingRoute(from, to) {
  return CONFIG.MAPBOX_TOKEN ? mapboxRoute(from, to) : osrmRoute(from, to);
}

async function mapboxRoute(from, to) {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
    `${from.lon},${from.lat};${to.lon},${to.lat}` +
    `?overview=full&geometries=geojson&access_token=${CONFIG.MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  if (!data.routes?.length) throw new Error("No route found.");
  return toRoute(data.routes[0], true);
}

async function osrmRoute(from, to) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lon},${from.lat};${to.lon},${to.lat}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route found.");
  return toRoute(data.routes[0], false);
}

function toRoute(route, liveTraffic) {
  return {
    durationMin: route.duration / 60,
    distanceKm: route.distance / 1000,
    coords: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    liveTraffic,
  };
}

/**
 * ESTIMATED transit trip — there is no free nationwide transit-routing API,
 * so this models: walk to station + average headway wait + rail travel at the
 * line's average speed. Geometry is a straight line, drawn dashed on the map.
 * (With a Mapbox/Google key you can swap in their transit directions here.)
 */
export function trainRoute(from, airport) {
  const t = airport.train;
  const km = haversineKm(from.lat, from.lon, airport.lat, airport.lon);
  const rideMin = (km / t.avgSpeedKmh) * 60;
  const durationMin = t.stationWalkMin + t.headwayMin / 2 + rideMin;
  return {
    durationMin,
    distanceKm: km,
    coords: [
      [from.lat, from.lon],
      [airport.lat, airport.lon],
    ],
    estimated: true,
  };
}
