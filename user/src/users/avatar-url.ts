const GOOGLE_PHOTO_HOST = '.googleusercontent.com';

/**
 * True for a profile photo served by Google (what Google sign-in reports).
 *
 * Every app that shows a user loads their avatar, so an avatar on a server of
 * the user's choosing would tell that server who is looking and from where.
 * A picture is therefore either uploaded to our own storage (`AvatarService`)
 * or one of these.
 */
export function isGooglePhotoUrl(url: string): boolean {
  let photo: URL;
  try {
    photo = new URL(url);
  } catch {
    return false;
  }
  return (
    photo.protocol === 'https:' && photo.hostname.endsWith(GOOGLE_PHOTO_HOST)
  );
}
