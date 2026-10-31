const EARTH_RADIUS_M = 6_371_000;
const WALK_METRES_PER_MINUTE = 80;

export type LatLng = { lat: number; lng: number };

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function walkingMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / WALK_METRES_PER_MINUTE));
}

/** A point `metres` due north, for the demo's 50 m and 500 m simulation. */
export function pointNorthOf(origin: LatLng, metres: number): LatLng {
  return {
    lat: origin.lat + (metres / EARTH_RADIUS_M) * (180 / Math.PI),
    lng: origin.lng,
  };
}
