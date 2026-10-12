import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, PresenceService, ChatGateway],
})
export class ChatModule {}
