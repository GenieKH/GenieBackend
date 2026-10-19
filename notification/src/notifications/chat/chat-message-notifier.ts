import { Injectable } from '@nestjs/common';
import { DeliveryReport, PushDeliveryService } from '../delivery/push-delivery.service';
import { PushDevicesService } from '../devices/push-devices.service';
import { NotificationPreferencesService } from '../preferences/notification-preferences.service';
import { ChatMessageEvent, chatMessagePush } from './chat-message.push';

const NOTHING_SENT: DeliveryReport = { sent: 0, failed: 0, removed: 0 };

/**
 * Tells someone they have a new chat message, on every device they are
 * signed in on, unless they turned chat notifications off. The app hides it
 * while that very conversation is open on screen.
 */
@Injectable()
export class ChatMessageNotifier {
  constructor(
    private readonly preferences: NotificationPreferencesService,
    private readonly devices: PushDevicesService,
    private readonly delivery: PushDeliveryService,
  ) {}

  async notify(event: ChatMessageEvent): Promise<DeliveryReport> {
    if (event.recipientId === event.senderId) return NOTHING_SENT;
    if (!(await this.preferences.get(event.recipientId)).chatMessages) return NOTHING_SENT;

    const targets = await this.devices.targetsOf(event.recipientId);
    return this.delivery.deliver(targets, (target) => chatMessagePush(event, target));
  }
}
