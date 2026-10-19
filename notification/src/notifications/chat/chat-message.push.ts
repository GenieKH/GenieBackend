import { inLocale, texts } from '../delivery/notification-texts';
import { PushContent, PushTarget } from '../delivery/push-sender';

/** A message was stored for someone. Its text is end-to-end encrypted: the server cannot show it. */
export interface ChatMessageEvent {
  recipientId: string;
  senderId: string;
  senderName: string;
  messageId: string;
}

/**
 * "Dara · New message". One notification per sender: a newer message from
 * the same person replaces the previous one instead of piling up.
 */
export function chatMessagePush(event: ChatMessageEvent, target: PushTarget): PushContent {
  return {
    alert: { title: event.senderName, body: inLocale(texts.newMessage, target.locale) },
    data: {
      type: 'chat_message',
      senderId: event.senderId,
      senderName: event.senderName,
      messageId: event.messageId,
    },
    channel: 'chat_messages',
    tag: `chat:${event.senderId}`,
    urgent: true,
  };
}
