import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Base64 length limits. A nonce is 24 bytes; the text limit is about 12 KB. */
const MAX_CIPHERTEXT_LENGTH = 16384;
const MAX_NONCE_LENGTH = 64;
const MAX_PAGE_SIZE = 100;

export class SetPublicKeyDto {
  @IsString()
  @IsNotEmpty()
  identityPublicKey: string;
}

/** The client-encrypted key backup. The server never sees the plain keys. */
export class SetBackupDto {
  @IsString()
  @IsNotEmpty()
  backupBlob: string;

  @IsString()
  @IsNotEmpty()
  backupSalt: string;

  @IsString()
  @IsNotEmpty()
  backupNonce: string;
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
