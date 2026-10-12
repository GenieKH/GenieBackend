import { Body, Controller, Get, HttpException, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { ChatService } from './chat.service';
import { MessagePageQuery, SetBackupDto, SetPublicKeyDto } from './dto/chat.dto';

const DEFAULT_PAGE_SIZE = 50;

@Controller('chat')
export class ChatController {
  /** Backups are sensitive: at most 5 downloads per user every 15 minutes. */
  private readonly backupRateLimiter = new RateLimiterMemory({ points: 5, duration: 15 * 60 });

  constructor(private readonly chatService: ChatService) {}

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
    return this.chatService.setBackup(userId, dto.backupBlob, dto.backupSalt, dto.backupNonce);
  }

  @Get('backup')
  async getBackup(@CurrentUserId() userId: string) {
    try {
      await this.backupRateLimiter.consume(userId);
    } catch {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.chatService.getBackup(userId);
  }

  /** Every message received after `lastMessageTime` (or all, if omitted). */
  @Get('sync')
  syncMessages(@CurrentUserId() userId: string, @Query('lastMessageTime') lastMessageTime?: string) {
    const since = lastMessageTime ? new Date(lastMessageTime) : new Date(0);
    return this.chatService.getMessagesAfter(userId, since);
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
}
