/**
 * The largest values the columns hold. A bigger number passes `@IsNumber()` but
 * makes the database refuse the row, which the caller would see as a 500.
 */

/** `DECIMAL(12,2)`: price, discount, rent and fee. */
export const MAX_MONEY = 9_999_999_999.99;

/** `DECIMAL(10,2)`: land, building, unit and project areas. */
export const MAX_AREA = 99_999_999.99;

/** A 32-bit integer: bedrooms, floors, units, months. */
export const MAX_COUNT = 2_147_483_647;
