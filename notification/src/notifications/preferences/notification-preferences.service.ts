import { Injectable } from '@nestjs/common';
import { PrismaService } from '@genie/shared';

/** What a user can switch off. Security alerts and calls always arrive. */
export interface NotificationPreferences {
  chatMessages: boolean;
  promotions: boolean;
}

/** Everyone starts with everything on; the app lets them turn things off. */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  chatMessages: true,
  promotions: true,
};

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<NotificationPreferences> {
    const row = await this.prisma.notificationPreferences.findUnique({
      where: { userId },
      select: { chatMessages: true, promotions: true },
    });
    return row ?? DEFAULT_PREFERENCES;
  }

  async update(
    userId: string,
    changes: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    return this.prisma.notificationPreferences.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_PREFERENCES, ...changes },
      update: changes,
      select: { chatMessages: true, promotions: true },
    });
  }
}
