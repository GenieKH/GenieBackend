/** The basic needs a buyer asks about, looked up for listings tagged with them. */
export const NEARBY_CATEGORIES = ['market', 'hospital', 'school'] as const;
export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number];

/** The keyword that asks for each category. */
export const CATEGORY_BY_KEYWORD: Readonly<Record<string, NearbyCategory>> = {
  near_market: 'market',
  near_hospital: 'hospital',
  near_school: 'school',
};

/** How far around the listing to look, in a straight line. */
export const SEARCH_RADIUS_METERS = 5000;

/** How many places to show per category. */
export const PLACES_PER_CATEGORY = 3;

/** The categories `keywords` ask for, in display order. */
export function categoriesFor(keywords: Iterable<string>): NearbyCategory[] {
  const wanted = new Set<NearbyCategory>();
  for (const keyword of keywords) {
    const category = CATEGORY_BY_KEYWORD[keyword];
    if (category) wanted.add(category);
  }
  return NEARBY_CATEGORIES.filter((category) => wanted.has(category));
}

const EARTH_RADIUS_METERS = 6_371_000;

/** Distance in a straight line over the earth's surface, in whole meters. */
export function straightMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a)));
}
