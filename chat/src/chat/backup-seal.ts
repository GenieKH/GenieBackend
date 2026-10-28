import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

export const MIN_BACKUP_SECRET_LENGTH = 32;

const IV_BYTES = 12;
const TAG_BYTES = 16;

function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), purpose, 32));
}

/**
 * Ties stored chat key backups to a secret kept outside the database. Without
 * it a copy of the database cannot be used to test PIN guesses: the stored
 * proof is a keyed hash and the stored key is encrypted a second time.
 */
export class BackupSeal {
  private readonly verifierKey: Buffer;
  private readonly blobKey: Buffer;

  constructor(secret: string) {
    if (secret.length < MIN_BACKUP_SECRET_LENGTH) {
      throw new Error(
        `The backup secret needs at least ${MIN_BACKUP_SECRET_LENGTH} characters`,
      );
    }
    // The app's old name stays in these labels: the keys derived from them
    // seal the backups already stored, which a new label could not open.
    this.verifierKey = deriveKey(secret, 'genie-chat-backup-verifier-v1');
    this.blobKey = deriveKey(secret, 'genie-chat-backup-blob-v1');
  }

  /** What is stored in place of the PIN proof a device sends. */
  verifierTag(userId: string, verifier: string): string {
    return createHmac('sha256', this.verifierKey)
      .update(`${userId}:${verifier}`)
      .digest('base64');
  }

  matches(userId: string, verifier: string, storedTag: string): boolean {
    const expected = Buffer.from(storedTag, 'base64');
    const received = Buffer.from(this.verifierTag(userId, verifier), 'base64');
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  /** Encrypts a device's backup for storage. Only opens again for the same user. */
  wrap(userId: string, blob: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.blobKey, iv).setAAD(
      Buffer.from(userId),
    );
    const sealed = Buffer.concat([cipher.update(blob, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64');
  }

  /** Throws if the stored value was altered or belongs to another user. */
  unwrap(userId: string, wrapped: string): string {
    const bytes = Buffer.from(wrapped, 'base64');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.blobKey,
      bytes.subarray(0, IV_BYTES),
    )
      .setAAD(Buffer.from(userId))
      .setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  }
}
