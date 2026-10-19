import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Names are shown as they are; this keeps a notification readable. */
const MAX_NAME_LENGTH = 100;

/** From chat: a message was stored for `recipientId`. */
export class ChatMessageEventDto {
  @IsUUID()
  recipientId: string;

  @IsUUID()
  senderId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NAME_LENGTH)
  senderName: string;

  @IsUUID()
  messageId: string;
}

/** From authentication: a new device signed in to an account already in use elsewhere. */
export class SignInEventDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  sessionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  platform?: string;
}

/** From chat: `callerId` is calling `calleeId`. */
export class CallEventDto {
  @IsUUID()
  callId: string;

  @IsUUID()
  callerId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NAME_LENGTH)
  callerName: string;

  @IsUUID()
  calleeId: string;
}

/** From chat: the call stopped ringing. */
export class CallEndedEventDto extends CallEventDto {
  @IsBoolean()
  missed: boolean;
}
