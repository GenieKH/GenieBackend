import { describeJwtPublicKey } from './jwt-key-info';

const PEM = '-----BEGIN PUBLIC KEY-----\nAAAA\nBBBB\n-----END PUBLIC KEY-----';

describe('describeJwtPublicKey', () => {
  it('says so when the key is missing', () => {
    expect(describeJwtPublicKey({})).toBe('JWT_PUBLIC_KEY is not set');
  });

  it('never prints the key itself', () => {
    expect(describeJwtPublicKey({ JWT_PUBLIC_KEY: PEM })).not.toContain('AAAA');
  });

  it('gives one fingerprint however the newlines are written', () => {
    const escaped = describeJwtPublicKey({
      JWT_PUBLIC_KEY: PEM.replace(/\n/g, '\n'),
    });
    const real = describeJwtPublicKey({ JWT_PUBLIC_KEY: PEM });
    expect(escaped.split('fingerprint ')[1]).toBe(
      real.split('fingerprint ')[1],
    );
  });

  it('gives different fingerprints for different keys', () => {
    const other = describeJwtPublicKey({
      JWT_PUBLIC_KEY: PEM.replace('AAAA', 'CCCC'),
    });
    expect(other.split('fingerprint ')[1]).not.toBe(
      describeJwtPublicKey({ JWT_PUBLIC_KEY: PEM }).split('fingerprint ')[1],
    );
  });
});
