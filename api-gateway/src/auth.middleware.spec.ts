import { UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// The middleware reads the key when it is constructed.
process.env.JWT_PUBLIC_KEY = publicKey;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AuthMiddleware } = require('./auth.middleware') as typeof import('./auth.middleware');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RevokedSessions } = require('./revoked-sessions') as typeof import('./revoked-sessions');

describe('AuthMiddleware', () => {
  /** The sessions that were signed out. */
  const signedOut = new Set<string>();
  const middleware = new AuthMiddleware({ has: async (sessionId: string) => signedOut.has(sessionId) } as never);

  const run = async (headers: Record<string, string>, method = 'GET') => {
    const req = { method, headers: { ...headers } } as never as { headers: Record<string, string>; method: string };
    const next = jest.fn();
    await middleware.use(req as never, {} as never, next);
    return { req, next };
  };
  const sign = (options: jwt.SignOptions = {}, key = privateKey, claims: object = { typ: 'access' }) =>
    jwt.sign({ sub: 'user-1', ...claims }, key, { algorithm: 'RS256', expiresIn: '5m', ...options });

  beforeEach(() => signedOut.clear());

  it('writes the verified user id to x-user-id and continues', async () => {
    const { req, next } = await run({ authorization: `Bearer ${sign()}` });

    expect(req.headers['x-user-id']).toBe('user-1');
    expect(next).toHaveBeenCalled();
  });

  it('overwrites an x-user-id the client tried to supply', async () => {
    const { req } = await run({ authorization: `Bearer ${sign()}`, 'x-user-id': 'someone-else' });

    expect(req.headers['x-user-id']).toBe('user-1');
  });

  it('rejects a missing or malformed Authorization header', async () => {
    await expect(run({})).rejects.toThrow(UnauthorizedException);
    await expect(run({ authorization: 'Basic abc' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    await expect(run({ authorization: `Bearer ${sign({ expiresIn: -10 })}` })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token signed with a different key', async () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    await expect(run({ authorization: `Bearer ${sign({}, other.privateKey)}` })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a refresh token, and a token that does not say what it is', async () => {
    const refresh = sign({ expiresIn: '30d' }, privateKey, { typ: 'refresh', jti: 'token-1' });
    const untyped = sign({}, privateKey, {});

    await expect(run({ authorization: `Bearer ${refresh}` })).rejects.toThrow(UnauthorizedException);
    await expect(run({ authorization: `Bearer ${untyped}` })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects the proof and internal tokens the authentication service also signs', async () => {
    for (const typ of ['password-proof', 'internal']) {
      const token = sign({}, privateKey, { typ });
      await expect(run({ authorization: `Bearer ${token}` })).rejects.toThrow(UnauthorizedException);
    }
  });

  it('rejects an HS256 token (algorithm confusion)', async () => {
    const forged = jwt.sign({ sub: 'user-1' }, publicKey, { algorithm: 'HS256' });

    await expect(run({ authorization: `Bearer ${forged}` })).rejects.toThrow(UnauthorizedException);
  });

  it('lets CORS preflight requests through without a token', async () => {
    const { next } = await run({}, 'OPTIONS');

    expect(next).toHaveBeenCalled();
  });

  describe('a device that was signed out', () => {
    const token = (sid: string) => sign({}, privateKey, { typ: 'access', sid });

    it('is refused at once, although its token has not expired', async () => {
      await run({ authorization: `Bearer ${token('phone')}` });

      signedOut.add('phone');

      await expect(run({ authorization: `Bearer ${token('phone')}` })).rejects.toThrow('This device was signed out');
    });

    it("does not take the account's other devices with it", async () => {
      signedOut.add('phone');

      const { next } = await run({ authorization: `Bearer ${token('laptop')}` });

      expect(next).toHaveBeenCalled();
    });
  });

  it('keeps working while Redis is down: the token still expires on its own', async () => {
    const revoked = new RevokedSessions({ client: { exists: () => Promise.reject(new Error('Redis is down')) } } as never);
    const next = jest.fn();
    const token = sign({}, privateKey, { typ: 'access', sid: 'phone' });

    await new AuthMiddleware(revoked).use(
      { method: 'GET', headers: { authorization: `Bearer ${token}` } } as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalled();
  });
});
