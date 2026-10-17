import { UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { InternalCallGuard } from './internal-call.guard';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

describe('InternalCallGuard', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const originalKey = process.env.JWT_PUBLIC_KEY;
  const sign = (typ: string, sub = ALICE, expiresIn: jwt.SignOptions['expiresIn'] = '5m') =>
    jwt.sign({ sub, typ }, privateKey, { algorithm: 'RS256', expiresIn });
  const guard = new InternalCallGuard();
  const request = (authorization: string | undefined, userId = ALICE) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization }, params: { userId } }) }) }) as never;

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = publicKey;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.JWT_PUBLIC_KEY;
    else process.env.JWT_PUBLIC_KEY = originalKey;
  });

  it('lets the authentication service act on the account its token names', () => {
    expect(guard.canActivate(request(`Bearer ${sign('internal')}`))).toBe(true);
  });

  it.each([
    ['no token', () => undefined],
    ['a token for another account', () => `Bearer ${sign('internal', BOB)}`],
    // A signed-in user must never be able to erase files, their own included, this way.
    ["a user's access token", () => `Bearer ${sign('access')}`],
    ['an expired token', () => `Bearer ${sign('internal', ALICE, -10)}`],
  ])('refuses %s', (_case, authorization) => {
    expect(() => guard.canActivate(request(authorization()))).toThrow(UnauthorizedException);
  });
});
