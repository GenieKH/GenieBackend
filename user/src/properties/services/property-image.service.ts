import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { PropertyQueryService } from './property-query.service';
import { PublicPropertyCache } from './public-property-cache.service';

/** Image upload flow: presigned upload URLs, then confirm what was uploaded. */
@Injectable()
export class PropertyImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: PropertyQueryService,
    private readonly storage: SupabaseService,
    private readonly publicCache: PublicPropertyCache,
  ) {}

  async createUploadUrls(userId: string, propertyId: string, fileNames: string[]) {
    await this.query.findOwned(userId, propertyId);
    return this.storage.createPresignedUrls(fileNames);
  }

  /** Attaches uploaded files to the property, after its existing images. */
  async confirmUploads(userId: string, propertyId: string, fileNames: string[]) {
    const property = await this.query.findOwned(userId, propertyId);
    if (!fileNames.every((fileName) => this.storage.isUploadedFileName(fileName))) {
      throw new BadRequestException('Unknown image file');
    }
    const lastOrder = Math.max(0, ...property.images.map((image) => image.order));

    await this.prisma.propertyImage.createMany({
      data: fileNames.map((fileName, index) => ({
        propertyId,
        url: this.storage.getPublicUrl(fileName),
        order: lastOrder + index + 1,
      })),
    });

    // New photos of a published listing should show up right away.
    if (property.status === 'Active') {
      await this.publicCache.changed(propertyId);
    }
    return this.query.findOwned(userId, propertyId);
  }

  /**
   * Deletes the stored photos of every listing the user ever made, deleted
   * ones included. Called before the account itself is deleted, while the
   * database still says which files those are.
   */
  async removeAllOwnedBy(userId: string): Promise<void> {
    const images = await this.prisma.propertyImage.findMany({
      where: { property: { userId } },
      select: { url: true },
    });
    await this.storage.removeUploadedFiles(images.map((image) => fileNameOf(image.url)));
  }
}

/** The last part of a photo's public URL is the name it was stored under. */
function fileNameOf(url: string): string {
  return decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
}
