const GOOGLE_PHOTO_HOST = '.googleusercontent.com';

/**
 * Every app that shows a user loads their avatar, so an avatar on a server of
 * the user's choosing would tell that server who is looking and from where.
 * Only our own storage and Google's profile photos (from Google sign-in) are
 * accepted.
 */
export function isAllowedAvatarUrl(url: string, storageUrl = process.env.SUPABASE_URL): boolean {
  let avatar: URL;
  try {
    avatar = new URL(url);
  } catch {
    return false;
  }
  if (avatar.protocol !== 'https:') return false;

  if (avatar.hostname.endsWith(GOOGLE_PHOTO_HOST)) return true;
  return !!storageUrl && URL.canParse(storageUrl) && avatar.host === new URL(storageUrl).host;
}
