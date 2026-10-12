/** Public fields of a property owner (never includes the password hash). */
export const OWNER_SUMMARY_SELECT = {
  id: true,
  username: true,
  phone: true,
  email: true,
  avatarUrl: true,
} as const;

/** Relations returned together with a property in every read endpoint. */
export const PROPERTY_WITH_RELATIONS = {
  images: { orderBy: { order: 'asc' } },
  user: { select: OWNER_SUMMARY_SELECT },
} as const;
