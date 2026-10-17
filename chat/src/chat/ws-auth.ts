import { Socket } from 'socket.io';
import { ACCESS_TOKEN, RevokedSessions, verifySignedToken } from '@genie/shared';

/** Who a socket belongs to. `sessionId` is null for a token from before sessions existed. */
export interface SocketUser {
  userId: string;
  sessionId: string | null;
}

/** Bearer token from the `Authorization` header, or the socket.io `auth.token` field. */
export function extractSocketToken(client: Socket): string | undefined {
  const header = client.handshake.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  const authToken = client.handshake.auth?.token;
  return typeof authToken === 'string' ? authToken : undefined;
}

/** Verifies an access token and returns who it was issued to. Throws if invalid. */
export function verifyAccessToken(token: string): SocketUser {
  const payload = verifySignedToken(token, ACCESS_TOKEN);
  return { userId: payload.sub, sessionId: typeof payload.sid === 'string' ? payload.sid : null };
}

/**
 * Who the socket's token belongs to, written to `client.data`. Throws when
 * there is no valid token or its device was signed out.
 */
export async function authenticateSocket(client: Socket, revoked: RevokedSessions): Promise<SocketUser> {
  const token = extractSocketToken(client);
  if (!token) throw new Error('No token provided');

  const user = verifyAccessToken(token);
  if (user.sessionId && (await revoked.has(user.sessionId))) {
    throw new Error('This device was signed out');
  }
  client.data.userId = user.userId;
  client.data.sessionId = user.sessionId;
  return user;
}
