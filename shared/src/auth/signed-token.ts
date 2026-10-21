import * as jwt from 'jsonwebtoken';

/** `typ` claims of the tokens the authentication service signs. */
export const ACCESS_TOKEN = 'access';
/** "This user typed their password a moment ago." Valid for 5 minutes. */
export const PASSWORD_PROOF_TOKEN = 'password-proof';
/** A call from the authentication service itself, about the account in `sub`. */
export const INTERNAL_TOKEN = 'internal';

/**
 * Verifies a token signed by the authentication service and returns its
 * claims. Every kind is signed with the same key, so the caller names the one
 * `type` it accepts: a 30-day refresh token must never pass as an access token.
 * Throws when the token is invalid, expired or of another type.
 */
export function verifySignedToken(
  token: string,
  type: string,
): jwt.JwtPayload & { sub: string } {
  const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';
  const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
  if (typeof payload === 'string' || !payload.sub) {
    throw new Error('Token has no subject');
  }
  if (payload.typ !== type) {
    throw new Error(`Not a token of type "${type}"`);
  }
  return payload as jwt.JwtPayload & { sub: string };
}
