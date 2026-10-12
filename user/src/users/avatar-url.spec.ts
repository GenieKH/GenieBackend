import { isAllowedAvatarUrl } from './avatar-url';

describe('isAllowedAvatarUrl', () => {
  const storage = 'https://project.supabase.co';

  it('accepts our own storage and Google profile photos', () => {
    expect(isAllowedAvatarUrl('https://project.supabase.co/storage/v1/object/public/a/b.png', storage)).toBe(true);
    expect(isAllowedAvatarUrl('https://lh3.googleusercontent.com/a/photo=s96-c', storage)).toBe(true);
  });

  it('refuses any other server, which could watch who views the profile', () => {
    for (const url of [
      'https://tracker.example.com/pixel.png',
      'https://project.supabase.co.evil.example/a.png',
      'https://evilgoogleusercontent.com/a.png',
      'https://googleusercontent.com.evil.example/a.png',
      'http://lh3.googleusercontent.com/a/photo',
      'javascript:alert(1)',
      'not a url',
      '',
    ]) {
      expect(isAllowedAvatarUrl(url, storage)).toBe(false);
    }
  });

  it('accepts only Google photos when storage is not configured', () => {
    expect(isAllowedAvatarUrl('https://project.supabase.co/a.png', undefined)).toBe(false);
    expect(isAllowedAvatarUrl('https://lh3.googleusercontent.com/a/photo', undefined)).toBe(true);
  });
});
