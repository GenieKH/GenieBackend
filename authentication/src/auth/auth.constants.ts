/** Lifetime of the short-lived JWT used to call the API. */
export const ACCESS_TOKEN_TTL = '15m';

/** Lifetime of the refresh token, in days (also used for the DB expiry). */
export const REFRESH_TOKEN_TTL_DAYS = 30;

/** Work factor for every bcrypt hash (passwords, OTPs, refresh tokens). */
export const BCRYPT_ROUNDS = 10;

/** How long a password-reset OTP stays valid, in minutes. */
export const OTP_TTL_MINUTES = 10;

/** Role given to every self-registered account. */
export const DEFAULT_USER_ROLE = 'user';
