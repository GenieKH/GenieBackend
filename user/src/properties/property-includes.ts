/** Public fields of a property owner (never includes the password hash). */
export const OWNER_SUMMARY_SELECT = {
  id: true,
  username: true,
  name: true,
  phone: true,
  email: true,
  avatarUrl: true,
} as const;

/** Relations returned together with a property in every read endpoint. */
export const PROPERTY_WITH_RELATIONS = {
  images: { orderBy: { order: 'asc' } },
  user: { select: OWNER_SUMMARY_SELECT },
} as const;

/** What the map shows of a listing. The same for every visitor, so it can be cached. */
export const MAP_SELECT = {
  id: true,
  title: true,
  description: true,
  price: true,
  lat: true,
  lng: true,
  propertyType: true,
  boundaryPoints: true,
  createdAt: true,
  status: true,
  bedrooms: true,
  bathrooms: true,
  landSize: true,
  buildingSize: true,
  unitSize: true,
  images: { orderBy: { order: 'asc' } },
  user: { select: OWNER_SUMMARY_SELECT },
  _count: { select: { favorites: true, contacts: true } },
} as const;

/** What strangers may see: published listings of accounts that are not deactivated. */
export const PUBLISHED = {
  status: 'Active',
  user: { deactivatedAt: null },
} as const;
