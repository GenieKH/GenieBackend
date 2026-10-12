import { isGooglePhotoUrl } from './avatar-url';

describe('isGooglePhotoUrl', () => {
  it('accepts a Google profile photo', () => {
    expect(isGooglePhotoUrl('https://lh3.googleusercontent.com/a/photo=s96-c')).toBe(true);
  });

  it.each([
    'https://evil.example/avatar.png',
    // Looks like Google, is not.
    'https://googleusercontent.com.evil.example/a.png',
    'https://evil.example/lh3.googleusercontent.com/a.png',
    // Not encrypted: anyone on the network sees who loads it.
    'http://lh3.googleusercontent.com/a/photo',
    // Our own storage is reached by uploading, never by naming a URL.
    'https://project.supabase.co/storage/v1/object/public/avatars/a/b',
    'javascript:alert(1)',
    'not a url',
    '',
  ])('refuses %p', (url) => {
    expect(isGooglePhotoUrl(url)).toBe(false);
  });
});
