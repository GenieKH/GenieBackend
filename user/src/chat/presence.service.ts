import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** Remembers when each user was last connected to chat. */
@Injectable()
export class PresenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Records that the user just went offline and returns that moment. */
  async markLastSeen(userId: string): Promise<Date> {
    const lastSeenAt = new Date();
    await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt } });
    return lastSeenAt;
  }

  /** When the user was last connected, or null if never (or unknown user). */
  async getLastSeen(userId: string): Promise<Date | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { lastSeenAt: true } });
    return user?.lastSeenAt ?? null;
  }
}
