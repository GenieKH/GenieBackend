import { ForbiddenException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { requirePasswordProof } from './password-proof';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

describe('requirePasswordProof', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const originalKey = process.env.JWT_PUBLIC_KEY;
  const sign = (typ: string, sub = ALICE, expiresIn: jwt.SignOptions['expiresIn'] = '5m') =>
    jwt.sign({ sub, typ }, privateKey, { algorithm: 'RS256', expiresIn });

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = publicKey;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.JWT_PUBLIC_KEY;
    else process.env.JWT_PUBLIC_KEY = originalKey;
  });

  it('passes for the user who typed their password', () => {
    expect(() => requirePasswordProof(ALICE, sign('password-proof'))).not.toThrow();
  });

  it.each([
    ["someone else's proof", () => sign('password-proof', BOB)],
    ['an expired proof', () => sign('password-proof', ALICE, -10)],
    // Being signed in is exactly what must not be enough.
    ['an access token', () => sign('access')],
    ['a forged token', () => jwt.sign({ sub: ALICE, typ: 'password-proof' }, publicKey, { algorithm: 'HS256' })],
    ['nonsense', () => 'not-a-token'],
  ])('refuses %s', (_case, token) => {
    expect(() => requirePasswordProof(ALICE, token())).toThrow(ForbiddenException);
  });
});
