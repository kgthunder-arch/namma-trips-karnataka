import type { RoutePreview } from '../types';

export async function requestDrivingRoute(stops: string[], signal: AbortSignal): Promise<RoutePreview> {
  if (stops.length < 2 || stops.length > 10) throw new Error('Choose between two and ten sightseeing stops to preview a route.');
  const response = await fetch('/api/route-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ origin: stops[0], destination: stops[stops.length - 1], waypoints: stops.slice(1, -1) }),
    signal,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Driving route preview unavailable.');
  if (!payload || payload.provider !== 'Google Maps Directions' || !Array.isArray(payload.legs) || !payload.legs.every((leg: RoutePreview['legs'][number]) => Number.isFinite(leg.distanceMeters) && Number.isFinite(leg.durationSeconds))) {
    throw new Error('The route provider returned incomplete data.');
  }
  return payload as RoutePreview;
}
