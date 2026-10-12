import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { ChatAttachmentService } from './chat-attachment.service';
import { ChatBackupService } from './chat-backup.service';
import { ChatService } from './chat.service';
import {
  CreateAttachmentDto,
  MessagePageQuery,
  SetBackupDto,
  SetPublicKeyDto,
  UnlockBackupDto,
} from './dto/chat.dto';

const DEFAULT_PAGE_SIZE = 50;

@Controller('chat')
export class ChatController {
  /** At most 5 backup lookups per user every 15 minutes. PIN tries are counted by ChatBackupService. */
  private readonly backupRateLimiter = new RateLimiterMemory({ points: 5, duration: 15 * 60 });

  /** Uploads are cheap to request but cost storage: 20 per user every minute. */
  private readonly uploadRateLimiter = new RateLimiterMemory({ points: 20, duration: 60 });

  constructor(
    private readonly chatService: ChatService,
    private readonly backupService: ChatBackupService,
    private readonly attachmentService: ChatAttachmentService,
  ) {}

  @Post('keys')
  setPublicKey(@CurrentUserId() userId: string, @Body() dto: SetPublicKeyDto) {
    return this.chatService.setPublicKey(userId, dto.identityPublicKey);
  }

  @Get('keys/:userId')
  getPublicKey(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.chatService.getPublicKey(userId);
  }

  @Post('backup')
  setBackup(@CurrentUserId() userId: string, @Body() dto: SetBackupDto) {
    return this.backupService.save(userId, {
      blob: dto.backupBlob,
      salt: dto.backupSalt,
      nonce: dto.backupNonce,
      verifier: dto.backupVerifier,
    });
  }

  @Get('backup')
  async getBackup(@CurrentUserId() userId: string) {
    try {
      await this.backupRateLimiter.consume(userId);
    } catch {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.backupService.describe(userId);
  }

  /** The encrypted key, for the right PIN proof only. `403` wrong PIN, `429` locked. */
  @Post('backup/unlock')
  @HttpCode(HttpStatus.OK)
  unlockBackup(@CurrentUserId() userId: string, @Body() dto: UnlockBackupDto) {
    return this.backupService.unlock(userId, dto.backupVerifier);
  }

  @Get('conversations')
  getConversations(@CurrentUserId() userId: string) {
    return this.chatService.getConversations(userId);
  }

  /** The newest page of a conversation, oldest message first. */
  @Get('messages/:participantId')
  getMessagesWith(
    @CurrentUserId() userId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Query() page: MessagePageQuery,
  ) {
    return this.chatService.getMessagesWith(userId, participantId, page.limit ?? DEFAULT_PAGE_SIZE, page.before);
  }

  @Post('messages/:participantId/read')
  markAsRead(@CurrentUserId() userId: string, @Param('participantId', ParseUUIDPipe) participantId: string) {
    return this.chatService.markAsRead(userId, participantId);
  }

  /** Where to upload one encrypted file for `recipientId`: `{ path, uploadUrl }`. */
  @Post('attachments')
  async createAttachmentUpload(@CurrentUserId() userId: string, @Body() dto: CreateAttachmentDto) {
    try {
      await this.uploadRateLimiter.consume(userId);
    } catch {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.attachmentService.createUpload(userId, dto.recipientId);
  }

  /** A one-minute download link, for the sender or the recipient only. */
  @Get('attachments/:senderId/:recipientId/:fileId')
  getAttachmentDownloadUrl(
    @CurrentUserId() userId: string,
    @Param('senderId', ParseUUIDPipe) senderId: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.attachmentService.createDownloadUrl(userId, { senderId, recipientId, fileId });
  }
}
