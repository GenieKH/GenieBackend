import { ForbiddenException } from '@nestjs/common';
import { PASSWORD_PROOF_TOKEN, verifySignedToken } from '@tilomnov/shared';

/**
 * Passes when `token` shows that `userId` typed their account password within
 * the last few minutes. The authentication service checks the password and
 * signs the token (`POST /auth/account/password-proof`); this service never
 * sees the password. Answers `403` otherwise.
 */
export function requirePasswordProof(userId: string, token: string): void {
  try {
    if (verifySignedToken(token, PASSWORD_PROOF_TOKEN).sub === userId) return;
  } catch {
    // Expired, forged or another kind of token: refused like someone else's.
  }
  throw new ForbiddenException('Confirm your password again');
}
