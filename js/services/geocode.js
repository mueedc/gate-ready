// Address geocoding. Uses Mapbox when CONFIG.MAPBOX_TOKEN is set (better US
// address matching, generous free tier); otherwise falls back to OSM Nominatim
// (free, no key, fine for development).

import { CONFIG } from "../config.js";

export async function geocode(query) {
  return CONFIG.MAPBOX_TOKEN ? mapboxGeocode(query) : nominatimGeocode(query);
}

async function mapboxGeocode(query) {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?limit=1&country=us&access_token=${CONFIG.MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  if (!data.features?.length) throw new Error("Address not found — try adding a city or ZIP.");
  const f = data.features[0];
  return { lat: f.center[1], lon: f.center[0], label: f.place_name };
}

async function nominatimGeocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const results = await res.json();
  if (!results.length) throw new Error("Address not found — try adding a city or ZIP.");
  const { lat, lon, display_name } = results[0];
  return { lat: parseFloat(lat), lon: parseFloat(lon), label: display_name };
}

export function currentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation unavailable in this browser."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Current location" }),
      (err) => reject(new Error(`Location error: ${err.message}`)),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}
