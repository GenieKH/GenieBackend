import { createHash } from 'crypto';

/**
 * What a service sees in JWT_PUBLIC_KEY, without printing the key: whether it is set,
 * how it starts, and a short fingerprint. Services that verify tokens with the same key
 * print the same fingerprint, so a mismatch shows up by comparing their startup logs.
 */
export function describeJwtPublicKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = env.JWT_PUBLIC_KEY?.replace(/\n/g, '\n');
  if (!key) return 'JWT_PUBLIC_KEY is not set';

  const header = key.trimStart().split('\n')[0].slice(0, 40);
  const fingerprint = createHash('sha256')
    .update(key.trim().replace(/\s+/g, ''))
    .digest('hex')
    .slice(0, 12);
  return `JWT_PUBLIC_KEY is set: ${key.length} characters, starts "${header}", fingerprint ${fingerprint}`;
}
