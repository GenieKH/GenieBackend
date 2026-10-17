/** A public key changes only when its owner resets their keys, which clears the entry. */
export const PUBLIC_KEY_TTL_SECONDS = 600;

export function publicKeyCacheKey(userId: string): string {
  return `chat:public-key:${userId}`;
}
