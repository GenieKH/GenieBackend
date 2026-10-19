import { Module } from '@nestjs/common';
import { HealthController, PrismaModule, RedisModule } from '@genie/shared';
import { CallsModule } from './calls/calls.module';
import { ChatModule } from './chat/chat.module';

/** The chat service: messages over REST and WebSocket, presence, key backups, attachments and calls. */
@Module({
  imports: [RedisModule, PrismaModule, ChatModule, CallsModule],
  controllers: [HealthController],
})
export class AppModule {}
