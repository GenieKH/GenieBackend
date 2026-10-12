import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ChatAttachmentService } from './chat-attachment.service';
import { ChatBackupService } from './chat-backup.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ChatController],
  providers: [ChatService, ChatBackupService, ChatAttachmentService, PresenceService, ChatGateway],
})
export class ChatModule {}
