import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { verifyAccessToken } from './ws-auth';

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

  it('returns the user an access token was issued to', () => {
    expect(verifyAccessToken(sign({ typ: 'access' }))).toBe('user-1');
  });

  it('refuses a refresh token, which lives 30 days and may have been revoked', () => {
    expect(() => verifyAccessToken(sign({ typ: 'refresh', jti: 'token-1' }, '30d'))).toThrow('Not an access token');
    expect(() => verifyAccessToken(sign({}))).toThrow('Not an access token');
  });

  it('refuses an expired token and one signed with another key', () => {
    expect(() => verifyAccessToken(sign({ typ: 'access' }, -10))).toThrow();
    expect(() => verifyAccessToken(jwt.sign({ sub: 'user-1', typ: 'access' }, publicKey, { algorithm: 'HS256' }))).toThrow();
  });
});
