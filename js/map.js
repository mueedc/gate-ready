// Leaflet map wrapper: route drawing, origin/airport markers, live position.
/* global L */

let map, routeLine, originMarker, airportMarker, liveMarker;

export function initMap() {
  map = L.map("map", { zoomControl: true }).setView([39.5, -96], 4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);
}

function divIcon(emoji, size = 30) {
  return L.divIcon({
    html: `<div style="font-size:${size - 8}px; line-height:${size}px; text-align:center;
           filter: drop-shadow(0 2px 3px rgba(0,0,0,0.6));">${emoji}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function showRoute(origin, airport, route) {
  if (routeLine) routeLine.remove();
  if (originMarker) originMarker.remove();
  if (airportMarker) airportMarker.remove();

  routeLine = L.polyline(route.coords, {
    color: "#38bdf8",
    weight: 5,
    opacity: 0.85,
    dashArray: route.estimated ? "8 10" : null,
  }).addTo(map);

  originMarker = L.marker([origin.lat, origin.lon], { icon: divIcon("🏠") })
    .addTo(map)
    .bindPopup(origin.label);
  airportMarker = L.marker([airport.lat, airport.lon], { icon: divIcon("✈️", 34) })
    .addTo(map)
    .bindPopup(`${airport.name} (${airport.code})`);

  map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

/** Move (or create) the live position marker at `progress` (0..1) along the route. */
export function updateLivePosition(route, progress, emoji) {
  const coords = route.coords;
  const idx = Math.min(coords.length - 1, Math.floor(progress * (coords.length - 1)));
  const pos = coords[idx];
  if (!liveMarker) {
    liveMarker = L.marker(pos, { icon: divIcon(emoji, 34), zIndexOffset: 1000 }).addTo(map);
  } else {
    liveMarker.setLatLng(pos);
  }
  return pos;
}

export function clearLivePosition() {
  if (liveMarker) {
    liveMarker.remove();
    liveMarker = null;
  }
}
