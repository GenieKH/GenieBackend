import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { PropertyQueryService } from './property-query.service';
import { PublicPropertyCache } from './public-property-cache.service';

/** The most photos one listing can have. The app stops at the same number. */
export const MAX_PROPERTY_IMAGES = 30;

/** Image upload flow: presigned upload URLs, then confirm what was uploaded. */
@Injectable()
export class PropertyImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: PropertyQueryService,
    private readonly storage: SupabaseService,
    private readonly publicCache: PublicPropertyCache,
  ) {}

  /** One upload URL per name, in the same order, inside this listing's own folder. */
  async createUploadUrls(userId: string, propertyId: string, fileNames: string[]) {
    const property = await this.query.findOwned(userId, propertyId);
    this.ensureRoomFor(property.images.length, fileNames.length);
    return this.storage.createPresignedUrls(uploadFolder(userId, propertyId), fileNames);
  }

  /**
   * Attaches uploaded files to the property, after its existing images. Only
   * files from this listing's own folder are accepted: a name copied from
   * someone else's photo is refused. Confirming the same file again changes
   * nothing.
   */
  async confirmUploads(userId: string, propertyId: string, fileNames: string[]) {
    const property = await this.query.findOwned(userId, propertyId);
    const folder = `${uploadFolder(userId, propertyId)}/`;
    const isOwnUpload = (fileName: string) =>
      fileName.startsWith(folder) && this.storage.isUploadedFileName(fileName);
    if (!fileNames.every(isOwnUpload)) {
      throw new BadRequestException('Unknown image file');
    }

    const attached = new Set(property.images.map((image) => image.url));
    const urls = [...new Set(fileNames)]
      .map((fileName) => this.storage.getPublicUrl(fileName))
      .filter((url) => !attached.has(url));
    this.ensureRoomFor(property.images.length, urls.length);

    if (urls.length > 0) {
      const lastOrder = Math.max(0, ...property.images.map((image) => image.order));
      await this.prisma.propertyImage.createMany({
        data: urls.map((url, index) => ({ propertyId, url, order: lastOrder + index + 1 })),
      });

      // New photos of a published listing should show up right away.
      if (property.status === 'Active') {
        await this.publicCache.changed(propertyId);
      }
    }
    return this.query.findOwned(userId, propertyId);
  }

  /**
   * Deletes the stored photos of every listing the user ever made, deleted
   * ones included. Called before the account itself is deleted, while the
   * database still says which files those are.
   *
   * Before photos had folders, any file name could be attached to any
   * listing. A file that another user's listing also shows is left alone, so
   * deleting an account can never take someone else's photos with it.
   */
  async removeAllOwnedBy(userId: string): Promise<void> {
    const images = await this.prisma.propertyImage.findMany({
      where: { property: { userId } },
      select: { url: true },
    });
    const urls = [...new Set(images.map((image) => image.url))];
    if (urls.length === 0) return;

    const shared = await this.prisma.propertyImage.findMany({
      where: { url: { in: urls }, property: { userId: { not: userId } } },
      select: { url: true },
    });
    const sharedUrls = new Set(shared.map((image) => image.url));

    const fileNames = urls
      .filter((url) => !sharedUrls.has(url))
      .map((url) => this.storage.uploadedFileNameOf(url))
      .filter((fileName): fileName is string => fileName !== null)
      .filter((fileName) => this.storage.isLegacyFileName(fileName) || fileName.startsWith(`${userId}/`));
    await this.storage.removeUploadedFiles(fileNames);
  }

  private ensureRoomFor(existing: number, added: number) {
    if (existing + added > MAX_PROPERTY_IMAGES) {
      throw new BadRequestException(`A listing can have at most ${MAX_PROPERTY_IMAGES} photos`);
    }
  }
}

/** Where a listing's photos are stored: one folder per owner, then per listing. */
function uploadFolder(userId: string, propertyId: string): string {
  return `${userId}/${propertyId}`;
}
