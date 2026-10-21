import * as jwt from 'jsonwebtoken';

/** The services that call each other. A token names its sender; a receiver names who it accepts. */
export type ServiceName =
  'user' | 'payment' | 'property' | 'chat' | 'authentication' | 'notification';

/** `typ` of a token one service signs for another. Never accepted as a user's token. */
export const SERVICE_TOKEN = 'service';

const SERVICE_TOKEN_TTL_SECONDS = 60;

/** An HMAC key shorter than this can be guessed offline from one captured token. */
const MIN_SECRET_LENGTH = 32;

function secret(): string {
  const value = process.env.INTERNAL_SERVICE_SECRET;
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `INTERNAL_SERVICE_SECRET (at least ${MIN_SECRET_LENGTH} characters) is required for calls between services`,
    );
  }
  return value;
}

/** A one-minute token proving the call comes from `issuer`. HS256 with the secret every service shares. */
export function signServiceToken(issuer: ServiceName): string {
  return jwt.sign({ iss: issuer, typ: SERVICE_TOKEN }, secret(), {
    algorithm: 'HS256',
    expiresIn: SERVICE_TOKEN_TTL_SECONDS,
  });
}

/** The service that signed `token`. Throws when it is forged, expired, or not a service token. */
export function verifyServiceToken(token: string): ServiceName {
  const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] });
  if (
    typeof payload === 'string' ||
    payload.typ !== SERVICE_TOKEN ||
    typeof payload.iss !== 'string'
  ) {
    throw new Error('Not a service token');
  }
  return payload.iss as ServiceName;
}
