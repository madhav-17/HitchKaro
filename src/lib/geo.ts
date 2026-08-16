import type { GeoLocation } from './types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function projectPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay, t: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy, t };
}

export function distanceToRoute(
  point: GeoLocation,
  routePoints: GeoLocation[]
): { distance: number; withinRoute: boolean } {
  if (routePoints.length === 0) return { distance: Infinity, withinRoute: false };
  if (routePoints.length === 1) {
    const d = haversineDistance(point.lat, point.lng, routePoints[0].lat, routePoints[0].lng);
    return { distance: d, withinRoute: d <= 5 };
  }

  let minDist = Infinity;
  for (let i = 0; i < routePoints.length - 1; i++) {
    const proj = projectPointToSegment(
      point.lng,
      point.lat,
      routePoints[i].lng,
      routePoints[i].lat,
      routePoints[i + 1].lng,
      routePoints[i + 1].lat
    );
    const d = haversineDistance(point.lat, point.lng, proj.y, proj.x);
    if (d < minDist) minDist = d;
  }
  return { distance: minDist, withinRoute: minDist <= 5 };
}

export function buildRoutePoints(
  source: GeoLocation,
  destination: GeoLocation,
  stops: GeoLocation[]
): GeoLocation[] {
  return [source, ...stops, destination];
}

export function isOnRoute(
  pickup: GeoLocation,
  dropoff: GeoLocation,
  source: GeoLocation,
  destination: GeoLocation,
  stops: GeoLocation[]
): { pickupValid: boolean; dropoffValid: boolean; pickupDist: number; dropoffDist: number } {
  const route = buildRoutePoints(source, destination, stops);
  const pickupResult = distanceToRoute(pickup, route);
  const dropoffResult = distanceToRoute(dropoff, route);

  const pickupIdx = findNearestSegmentIndex(pickup, route);
  const dropoffIdx = findNearestSegmentIndex(dropoff, route);
  const correctOrder = pickupIdx <= dropoffIdx;

  return {
    pickupValid: pickupResult.withinRoute && correctOrder,
    dropoffValid: dropoffResult.withinRoute && correctOrder,
    pickupDist: pickupResult.distance,
    dropoffDist: dropoffResult.distance,
  };
}

function findNearestSegmentIndex(point: GeoLocation, route: GeoLocation[]): number {
  if (route.length <= 1) return 0;
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const proj = projectPointToSegment(
      point.lng,
      point.lat,
      route[i].lng,
      route[i].lat,
      route[i + 1].lng,
      route[i + 1].lat
    );
    const d = haversineDistance(point.lat, point.lng, proj.y, proj.x);
    if (d < minDist) {
      minDist = d;
      minIdx = i + Math.round(proj.t);
    }
  }
  return Math.min(minIdx, route.length - 1);
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
