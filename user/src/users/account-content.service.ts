import { Injectable } from '@nestjs/common';
import { ChatAttachmentService } from '../chat/chat-attachment.service';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma.service';
import { PropertyImageService } from '../properties/services/property-image.service';
import { PublicPropertyCache } from '../properties/services/public-property-cache.service';
import { AvatarService } from './avatar.service';
import { UsersService } from './users.service';

/**
 * What this service keeps for an account outside its database rows, acted on
 * when the authentication service hides, restores or deletes the account
 * (`InternalAccountsController`).
 *
 * A feature that starts storing files for users must add them to `eraseFiles`,
 * or deleting an account will leave them behind.
 */
@Injectable()
export class AccountContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly avatars: AvatarService,
    private readonly propertyImages: PropertyImageService,
    private readonly publicProperties: PublicPropertyCache,
    private readonly chat: ChatService,
    private readonly chatAttachments: ChatAttachmentService,
  ) {}

  /**
   * Deletes every file the account uploaded: listing photos, chat attachments
   * (both directions of its conversations) and profile pictures. The rows
   * themselves go when the authentication service deletes the account.
   */
  async eraseFiles(userId: string): Promise<void> {
    await Promise.all([
      this.propertyImages.removeAllOwnedBy(userId),
      this.chatAttachments.removeAllOf(userId),
      this.avatars.removeAllOf(userId),
    ]);
  }

  /**
   * The account was hidden, shown again or is being deleted: drop what is
   * cached about it, so the change shows at once instead of when the caches expire.
   */
  async visibilityChanged(userId: string): Promise<void> {
    const listings = await this.prisma.property.findMany({
      where: { userId, status: 'Active' },
      select: { id: true },
    });
    await Promise.all([
      this.users.forgetPublicProfile(userId),
      this.chat.forgetPublicKey(userId),
      ...listings.map((listing) => this.publicProperties.changed(listing.id)),
    ]);
  }
}
