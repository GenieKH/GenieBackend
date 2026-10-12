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

describe('AuthMiddleware', () => {
  const middleware = new AuthMiddleware();
  const run = (headers: Record<string, string>, method = 'GET') => {
    const req = { method, headers: { ...headers } } as never as { headers: Record<string, string>; method: string };
    const next = jest.fn();
    middleware.use(req as never, {} as never, next);
    return { req, next };
  };
  const sign = (options: jwt.SignOptions = {}, key = privateKey, claims: object = { typ: 'access' }) =>
    jwt.sign({ sub: 'user-1', ...claims }, key, { algorithm: 'RS256', expiresIn: '5m', ...options });

  it('writes the verified user id to x-user-id and continues', () => {
    const { req, next } = run({ authorization: `Bearer ${sign()}` });

    expect(req.headers['x-user-id']).toBe('user-1');
    expect(next).toHaveBeenCalled();
  });

  it('overwrites an x-user-id the client tried to supply', () => {
    const { req } = run({ authorization: `Bearer ${sign()}`, 'x-user-id': 'someone-else' });

    expect(req.headers['x-user-id']).toBe('user-1');
  });

  it('rejects a missing or malformed Authorization header', () => {
    expect(() => run({})).toThrow(UnauthorizedException);
    expect(() => run({ authorization: 'Basic abc' })).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    expect(() => run({ authorization: `Bearer ${sign({ expiresIn: -10 })}` })).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with a different key', () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    expect(() => run({ authorization: `Bearer ${sign({}, other.privateKey)}` })).toThrow(UnauthorizedException);
  });

  it('rejects a refresh token, and a token that does not say what it is', () => {
    const refresh = sign({ expiresIn: '30d' }, privateKey, { typ: 'refresh', jti: 'token-1' });
    const untyped = sign({}, privateKey, {});

    expect(() => run({ authorization: `Bearer ${refresh}` })).toThrow(UnauthorizedException);
    expect(() => run({ authorization: `Bearer ${untyped}` })).toThrow(UnauthorizedException);
  });

  it('rejects an HS256 token (algorithm confusion)', () => {
    const forged = jwt.sign({ sub: 'user-1' }, publicKey, { algorithm: 'HS256' });

    expect(() => run({ authorization: `Bearer ${forged}` })).toThrow(UnauthorizedException);
  });

  it('lets CORS preflight requests through without a token', () => {
    const { next } = run({}, 'OPTIONS');

    expect(next).toHaveBeenCalled();
  });
});
