/** Seven to twenty characters: digits, with an optional leading "+" and spaces, dots, dashes or brackets between them. */
export const PHONE_NUMBER = /^\+?[0-9][0-9 ().-]{5,18}[0-9]$/;

export const PHONE_NUMBER_MESSAGE =
  'Enter a valid phone number, for example +85512345678';
