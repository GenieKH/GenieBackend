import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Base64 length limits. A nonce is 24 bytes; the text limit is about 12 KB. */
const MAX_CIPHERTEXT_LENGTH = 16384;
const MAX_NONCE_LENGTH = 64;
const MAX_PAGE_SIZE = 100;
/** An encrypted 32-byte key is 64 characters; this leaves room without accepting junk. */
const MAX_BACKUP_FIELD_LENGTH = 512;
/** Exactly 32 bytes as base64. */
const BACKUP_VERIFIER = /^[A-Za-z0-9+/]{43}=$/;
/** A signed token is a few hundred characters. */
const MAX_PROOF_TOKEN_LENGTH = 2048;

/** A 32-byte public key is 44 characters. */
const MAX_PUBLIC_KEY_LENGTH = 128;

export class SetPublicKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PUBLIC_KEY_LENGTH)
  identityPublicKey: string;
}

/** The client-encrypted key backup. The server never sees the plain keys or the PIN. */
export class SetBackupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BACKUP_FIELD_LENGTH)
  backupBlob: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BACKUP_FIELD_LENGTH)
  backupSalt: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BACKUP_FIELD_LENGTH)
  backupNonce: string;

  /** Made from the PIN on the device. Sent again later to prove the PIN. */
  @Matches(BACKUP_VERIFIER)
  backupVerifier: string;

  /** Proof of the PIN of the backup this one replaces. Required when there is one... */
  @IsOptional()
  @Matches(BACKUP_VERIFIER)
  currentBackupVerifier?: string;

  /** ...or, for a forgotten PIN, the token from `POST /auth/account/password-proof`. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PROOF_TOKEN_LENGTH)
  passwordProofToken?: string;
}

/** "Reset keys": a new key pair and its backup, replacing the old ones together. */
export class ResetKeysDto extends SetBackupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PUBLIC_KEY_LENGTH)
  identityPublicKey: string;
}

/** One try at opening the backup. */
export class UnlockBackupDto {
  @Matches(BACKUP_VERIFIER)
  backupVerifier: string;
}

/** `sendMessage` socket event: one message encrypted on the sender's device. */
export class SendMessageDto {
  /** Chosen by the sender's device, so a retried send is not stored twice. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CIPHERTEXT_LENGTH)
  ciphertext: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NONCE_LENGTH)
  nonce: string;
}

/** Asks for a place to upload one encrypted file for this recipient. */
export class CreateAttachmentDto {
  @IsUUID()
  recipientId: string;
}

/** `watchPresence` / `unwatchPresence` socket events: whose status to follow. */
export class PresenceTargetDto {
  @IsUUID()
  userId: string;
}

/** Paging for a conversation's history, newest page first. */
export class MessagePageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  /** Only messages created before this ISO timestamp. */
  @IsOptional()
  @IsISO8601()
  before?: string;
}
