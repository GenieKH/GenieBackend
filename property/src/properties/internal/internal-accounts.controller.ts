import { Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService, serviceCallGuard } from '@genie/shared';
import { PropertyImageService } from '../services/property-image.service';
import { PublicPropertyCache } from '../services/public-property-cache.service';

/**
 * What the property service keeps for an account, acted on when the user
 * service says the account was hidden, restored or deleted. Called by that
 * service only, never by the app.
 */
@ApiExcludeController()
@UseGuards(serviceCallGuard('user'))
@Controller('internal/accounts/:userId')
export class InternalAccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: PropertyImageService,
    private readonly publicCache: PublicPropertyCache,
  ) {}

  /** The account is being deleted: remove the photos of its listings. */
  @Delete('files')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eraseFiles(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    await this.images.removeAllOwnedBy(userId);
  }

  /**
   * What others see of the account changed (name, picture, hidden or shown):
   * its published listings carry the owner's name and picture, so they are
   * dropped from the cache and read again.
   */
  @Post('visibility-changed')
  @HttpCode(HttpStatus.NO_CONTENT)
  async visibilityChanged(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    const listings = await this.prisma.property.findMany({
      where: { userId, status: 'Active' },
      select: { id: true },
    });
    await Promise.all(listings.map((listing) => this.publicCache.changed(listing.id)));
  }
}
