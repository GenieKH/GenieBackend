import { MapBounds } from '../properties/services/public-property-cache.service';

/**
 * About 500 m. A place that is a single address or a short lane has a tiny
 * (or no) viewport; the listings "in" it are the ones around it.
 */
export const MIN_AREA_SPAN_DEGREES = 0.005;

/** `viewport` grown around `center` until each side spans at least `minSpan` degrees. */
export function withMinimumSpan(
  viewport: MapBounds,
  center: { lat: number; lng: number },
  minSpan = MIN_AREA_SPAN_DEGREES,
): MapBounds {
  const half = minSpan / 2;
  const latTooSmall = viewport.maxLat - viewport.minLat < minSpan;
  const lngTooSmall = viewport.maxLng - viewport.minLng < minSpan;
  return {
    minLat: latTooSmall
      ? Math.min(viewport.minLat, center.lat - half)
      : viewport.minLat,
    maxLat: latTooSmall
      ? Math.max(viewport.maxLat, center.lat + half)
      : viewport.maxLat,
    minLng: lngTooSmall
      ? Math.min(viewport.minLng, center.lng - half)
      : viewport.minLng,
    maxLng: lngTooSmall
      ? Math.max(viewport.maxLng, center.lng + half)
      : viewport.maxLng,
  };
}

interface Located {
  lat: number | null;
  lng: number | null;
}

/**
 * The `limit` items nearest `center`, nearest first. A planar distance with
 * longitude scaled by latitude: enough to rank listings inside one area.
 */
export function nearestFirst<T extends Located>(
  items: T[],
  center: { lat: number; lng: number },
  limit: number,
): T[] {
  const lngScale = Math.cos((center.lat * Math.PI) / 180);
  const distance = (item: T) => {
    if (item.lat === null || item.lng === null) return Number.POSITIVE_INFINITY;
    const dLat = item.lat - center.lat;
    const dLng = (item.lng - center.lng) * lngScale;
    return dLat * dLat + dLng * dLng;
  };

  return items
    .map((item) => ({ item, distance: distance(item) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ item }) => item);
}
