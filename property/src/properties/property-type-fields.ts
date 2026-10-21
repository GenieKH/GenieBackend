import { PropertyType } from './property-options';

/**
 * The details that only some property types have. A listing keeps those of
 * its own type; the others are cleared, so a listing whose type changed
 * cannot show (or match a filter on) details left over from its old type.
 */
export const TYPE_SPECIFIC_FIELDS = [
  'bedrooms',
  'bathrooms',
  'landSize',
  'buildingSize',
  'unitSize',
  'totalProjectArea',
  'floors',
  'floorNumber',
  'totalUnits',
  'hasParking',
  'hasBalcony',
  'furnishing',
  'buildingType',
  'completionStatus',
  'viewType',
  'maintenanceFee',
  'developerName',
  'projectName',
  'projectType',
  'monthlyRent',
  'leaseRemainingMonths',
  'equipmentIncluded',
  'reasonForSelling',
] as const;
export type TypeSpecificField = (typeof TYPE_SPECIFIC_FIELDS)[number];

const HOUSE_FIELDS: readonly TypeSpecificField[] = [
  'landSize',
  'buildingSize',
  'bedrooms',
  'bathrooms',
  'floors',
  'hasParking',
  'furnishing',
];

/** Which details each property type's form asks for. */
export const FIELDS_BY_TYPE: Record<
  PropertyType,
  readonly TypeSpecificField[]
> = {
  Land: ['landSize'],
  House: HOUSE_FIELDS,
  Warehouse: HOUSE_FIELDS,
  Building: [
    'buildingType',
    'landSize',
    'buildingSize',
    'floors',
    'totalUnits',
    'hasParking',
  ],
  Condo: [
    'unitSize',
    'floorNumber',
    'floors',
    'bedrooms',
    'bathrooms',
    'hasBalcony',
    'furnishing',
    'completionStatus',
    'viewType',
    'maintenanceFee',
  ],
  Borey: [
    'developerName',
    'projectName',
    'projectType',
    'totalProjectArea',
    'totalUnits',
    'completionStatus',
  ],
  'Business for Sale': [
    'landSize',
    'monthlyRent',
    'leaseRemainingMonths',
    'equipmentIncluded',
    'reasonForSelling',
  ],
};

/**
 * `null` for every detail `type` does not have, ready to spread into a
 * Prisma write. Unknown (legacy) types keep everything.
 */
export function clearedFieldsFor(
  type: string,
): Partial<Record<TypeSpecificField, null>> {
  const kept = FIELDS_BY_TYPE[type as PropertyType];
  if (!kept) return {};
  return Object.fromEntries(
    TYPE_SPECIFIC_FIELDS.filter((field) => !kept.includes(field)).map(
      (field) => [field, null],
    ),
  );
}
