import { Module } from '@nestjs/common';
import { RevokedSessions, SupabaseModule } from '@genie/shared';
import { ChatAttachmentService } from './chat-attachment.service';
import { ChatBackupService } from './chat-backup.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConversationStateService } from './conversation-state.service';
import { InternalAccountsController } from './internal-accounts.controller';
import { MessageActionsController } from './message-actions.controller';
import { MessageActionsService } from './message-actions.service';
import { NotificationClient } from './notification.client';
import { PresenceService } from './presence.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ChatController, MessageActionsController, InternalAccountsController],
  providers: [
    ChatService,
    ChatBackupService,
    ChatAttachmentService,
    ConversationStateService,
    MessageActionsService,
    PresenceService,
    NotificationClient,
    RevokedSessions,
    ChatGateway,
  ],
  // Calls share the chat connection, its sign-in checks and its pushes, and
  // list only the calls "delete for me" has not hidden.
  exports: [RevokedSessions, NotificationClient, ConversationStateService],
})
export class ChatModule {}
