import * as jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';

/** Bearer token from the `Authorization` header, or the socket.io `auth.token` field. */
export function extractSocketToken(client: Socket): string | undefined {
  const header = client.handshake.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  const authToken = client.handshake.auth?.token;
  return typeof authToken === 'string' ? authToken : undefined;
}

/** Verifies an access token and returns the user id it was issued to. Throws if invalid. */
export function verifyAccessToken(token: string): string {
  const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';
  const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
  if (typeof payload === 'string' || !payload.sub) {
    throw new Error('Token has no subject');
  }
  // Refresh tokens are signed with the same key and must not open a socket.
  if (payload.typ !== 'access') {
    throw new Error('Not an access token');
  }
  return payload.sub;
}
