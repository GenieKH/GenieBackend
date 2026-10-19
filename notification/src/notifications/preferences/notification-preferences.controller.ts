import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@genie/shared';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';
import { NotificationPreferences, NotificationPreferencesService } from './notification-preferences.service';

@ApiTags('notifications')
@UseGuards(JwtAuthGuard)
@Controller('notifications/preferences')
export class NotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferencesService) {}

  @Get()
  get(@CurrentUserId() userId: string): Promise<NotificationPreferences> {
    return this.preferences.get(userId);
  }

  @Patch()
  update(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.preferences.update(userId, {
      ...(dto.chatMessages !== undefined && { chatMessages: dto.chatMessages }),
      ...(dto.promotions !== undefined && { promotions: dto.promotions }),
    });
  }
}
