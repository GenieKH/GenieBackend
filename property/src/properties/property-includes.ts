/** Public fields of a property owner (never includes the password hash). */
export const OWNER_SUMMARY_SELECT = {
  id: true,
  username: true,
  name: true,
  phone: true,
  email: true,
  avatarUrl: true,
} as const;

/**
 * Relations returned together with a property in every read endpoint. The
 * `_count` each read also sends is added by `PropertyEngagementCounts`.
 */
export const PROPERTY_WITH_RELATIONS = {
  images: { orderBy: { order: 'asc' } },
  keywords: { select: { keyword: true }, orderBy: { keyword: 'asc' } },
  // Closest first within each category; the app groups them by category.
  nearbyPlaces: {
    select: {
      category: true,
      rank: true,
      name: true,
      lat: true,
      lng: true,
      straightMeters: true,
      roadMeters: true,
      driveSeconds: true,
    },
    orderBy: { rank: 'asc' },
  },
  user: { select: OWNER_SUMMARY_SELECT },
} as const;

/**
 * What the map shows of a listing, besides its `_count`. The same for every
 * visitor, so it can be cached.
 */
export const MAP_SELECT = {
  id: true,
  title: true,
  description: true,
  price: true,
  lat: true,
  lng: true,
  propertyType: true,
  listingType: true,
  discountType: true,
  discountValue: true,
  boundaryPoints: true,
  createdAt: true,
  status: true,
  bedrooms: true,
  bathrooms: true,
  landSize: true,
  buildingSize: true,
  unitSize: true,
  // The app filters by them too, while a newly filtered list is on its way.
  keywords: { select: { keyword: true } },
  images: { orderBy: { order: 'asc' } },
  user: { select: OWNER_SUMMARY_SELECT },
} as const;

/** What strangers may see: published listings of accounts that are not deactivated. */
export const PUBLISHED = {
  status: 'Active',
  user: { deactivatedAt: null },
} as const;
