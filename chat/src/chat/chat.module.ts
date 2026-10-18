import { Module } from '@nestjs/common';
import { RevokedSessions, SupabaseModule } from '@genie/shared';
import { ChatAttachmentService } from './chat-attachment.service';
import { ChatBackupService } from './chat-backup.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConversationStateService } from './conversation-state.service';
import { InternalAccountsController } from './internal-accounts.controller';
import { PresenceService } from './presence.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ChatController, InternalAccountsController],
  providers: [
    ChatService,
    ChatBackupService,
    ChatAttachmentService,
    ConversationStateService,
    PresenceService,
    RevokedSessions,
    ChatGateway,
  ],
})
export class ChatModule {}
