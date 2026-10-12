import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { authenticateSocket, verifyAccessToken } from './ws-auth';

describe('verifyAccessToken', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const originalKey = process.env.JWT_PUBLIC_KEY;
  const sign = (claims: object, expiresIn: jwt.SignOptions['expiresIn'] = '5m') =>
    jwt.sign({ sub: 'user-1', ...claims }, privateKey, { algorithm: 'RS256', expiresIn });

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = publicKey;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.JWT_PUBLIC_KEY;
    else process.env.JWT_PUBLIC_KEY = originalKey;
  });

  it('returns the user and the session an access token was issued to', () => {
    expect(verifyAccessToken(sign({ typ: 'access', sid: 'session-1' }))).toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    // A token from before sessions existed.
    expect(verifyAccessToken(sign({ typ: 'access' }))).toEqual({ userId: 'user-1', sessionId: null });
  });

  it('refuses a refresh token, which lives 30 days and may have been revoked', () => {
    expect(() => verifyAccessToken(sign({ typ: 'refresh', jti: 'token-1' }, '30d'))).toThrow('Not a token of type');
    expect(() => verifyAccessToken(sign({}))).toThrow('Not a token of type');
    expect(() => verifyAccessToken(sign({ typ: 'password-proof' }))).toThrow('Not a token of type');
  });

  it('refuses an expired token and one signed with another key', () => {
    expect(() => verifyAccessToken(sign({ typ: 'access' }, -10))).toThrow();
    expect(() => verifyAccessToken(jwt.sign({ sub: 'user-1', typ: 'access' }, publicKey, { algorithm: 'HS256' }))).toThrow();
  });

  describe('authenticateSocket', () => {
    const socketWith = (token?: string) =>
      ({ handshake: { headers: {}, auth: { token } }, data: {} as Record<string, unknown> }) as never;
    const revoked = (...signedOut: string[]) => ({ has: async (id: string) => signedOut.includes(id) }) as never;

    it('remembers who the socket belongs to', async () => {
      const socket = socketWith(sign({ typ: 'access', sid: 'phone' }));

      await authenticateSocket(socket, revoked());

      expect((socket as { data: unknown }).data).toEqual({ userId: 'user-1', sessionId: 'phone' });
    });

    it('refuses a device that was signed out, although its token has not expired', async () => {
      const socket = socketWith(sign({ typ: 'access', sid: 'phone' }));

      await expect(authenticateSocket(socket, revoked('phone'))).rejects.toThrow('signed out');
      await expect(authenticateSocket(socket, revoked('laptop'))).resolves.toBeDefined();
    });

    it('refuses a socket without a token', async () => {
      await expect(authenticateSocket(socketWith(undefined), revoked())).rejects.toThrow('No token provided');
    });
  });
});
