import { Controller, Get, Post, Body, Req, Param, Query, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';
import { RateLimiterMemory } from 'rate-limiter-flexible';

@Controller('chat')
export class ChatController {
  private backupRateLimiter = new RateLimiterMemory({
    points: 5, // 5 requests
    duration: 15 * 60, // per 15 minutes by IP or User
  });

  constructor(private readonly chatService: ChatService) {}

  @Post('keys')
  async setPublicKey(@Req() req: any, @Body() body: { identityPublicKey: string }) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new UnauthorizedException('User not authenticated');
    
    if (!body.identityPublicKey) {
      throw new HttpException('identityPublicKey is required', HttpStatus.BAD_REQUEST);
    }
    
    return this.chatService.setPublicKey(userId, body.identityPublicKey);
  }

  @Get('keys/:userId')
  async getPublicKey(@Param('userId') userId: string) {
    return this.chatService.getPublicKey(userId);
  }

  @Post('backup')
  async setBackup(@Req() req: any, @Body() body: { backupBlob: string; backupSalt: string; backupNonce: string }) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new UnauthorizedException('User not authenticated');

    if (!body.backupBlob || !body.backupSalt || !body.backupNonce) {
      throw new HttpException('Missing backup fields', HttpStatus.BAD_REQUEST);
    }

    return this.chatService.setBackup(userId, body.backupBlob, body.backupSalt, body.backupNonce);
  }

  @Get('backup')
  async getBackup(@Req() req: any) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new UnauthorizedException('User not authenticated');

    try {
      await this.backupRateLimiter.consume(userId);
    } catch (rejRes) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return this.chatService.getBackup(userId);
  }

  @Get('sync')
  async syncMessages(@Req() req: any, @Query('lastMessageTime') lastMessageTime?: string) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new UnauthorizedException('User not authenticated');

    // Default to the Unix epoch if not provided to fetch all
    const time = lastMessageTime ? new Date(lastMessageTime) : new Date(0);

    return this.chatService.getMessagesAfter(userId, time);
  }
}
