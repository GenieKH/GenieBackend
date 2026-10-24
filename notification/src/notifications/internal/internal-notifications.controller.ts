import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { serviceCallGuard } from '@genie/shared';
import { CallNotifier } from '../calls/call-notifier';
import { ChatMessageNotifier } from '../chat/chat-message-notifier';
import { DeliveryReport } from '../delivery/push-delivery.service';
import { ListingAlertNotifier } from '../listings/listing-alert-notifier';
import { savedSearchMatchPush } from '../listings/saved-search-match.push';
import { SignInAlertNotifier } from '../security/sign-in-alert-notifier';
import {
  CallEndedEventDto,
  CallEventDto,
  ChatMessageEventDto,
  SignInEventDto,
} from './dto/notification-events.dto';
import { SavedSearchMatchEventDto } from './dto/listing-events.dto';

/**
 * What other services ask to be notified. Never reached by the app: the
 * gateway does not forward `/internal`, and each route accepts only the
 * service that owns the event.
 */
@ApiExcludeController()
@Controller('internal/notifications')
export class InternalNotificationsController {
  constructor(
    private readonly chatMessages: ChatMessageNotifier,
    private readonly signIns: SignInAlertNotifier,
    private readonly calls: CallNotifier,
    private readonly listingAlerts: ListingAlertNotifier,
  ) {}

  @UseGuards(serviceCallGuard('chat'))
  @Post('chat-message')
  @HttpCode(HttpStatus.OK)
  chatMessage(@Body() event: ChatMessageEventDto): Promise<DeliveryReport> {
    return this.chatMessages.notify(event);
  }

  @UseGuards(serviceCallGuard('authentication'))
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() event: SignInEventDto): Promise<DeliveryReport> {
    return this.signIns.notify(event);
  }

  @UseGuards(serviceCallGuard('chat'))
  @Post('call-ringing')
  @HttpCode(HttpStatus.OK)
  callRinging(@Body() event: CallEventDto): Promise<DeliveryReport> {
    return this.calls.ringing(event);
  }

  @UseGuards(serviceCallGuard('chat'))
  @Post('call-ended')
  @HttpCode(HttpStatus.OK)
  callEnded(@Body() event: CallEndedEventDto): Promise<DeliveryReport> {
    return this.calls.ended(event);
  }

  @UseGuards(serviceCallGuard('property'))
  @Post('saved-search-match')
  @HttpCode(HttpStatus.OK)
  savedSearchMatch(
    @Body() event: SavedSearchMatchEventDto,
  ): Promise<DeliveryReport> {
    return this.listingAlerts.notify(
      'Saved search',
      'savedSearchAlerts',
      event.recipients.map((recipient) => ({
        userId: recipient.userId,
        push: (target) =>
          savedSearchMatchPush(
            {
              propertyId: event.propertyId,
              title: event.title,
              searchName: recipient.searchName,
            },
            target,
          ),
      })),
    );
  }
}
