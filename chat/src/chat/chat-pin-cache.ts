/**
 * "This user has a chat PIN", checked before every message they send. Only a
 * yes is cached: a PIN cannot be turned off, so it never goes stale, and a
 * user still without one is asked about again until they have one.
 */
export const CHAT_PIN_TTL_SECONDS = 24 * 60 * 60;

export function chatPinCacheKey(userId: string): string {
  return `chat:has-pin:${userId}`;
}
