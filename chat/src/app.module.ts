import { Module } from '@nestjs/common';
import { HealthController, PrismaModule, RedisModule } from '@genie/shared';
import { ChatModule } from './chat/chat.module';

/** The chat service: messages over REST and WebSocket, presence, key backups and attachments. */
@Module({
  imports: [RedisModule, PrismaModule, ChatModule],
  controllers: [HealthController],
})
export class AppModule {}
