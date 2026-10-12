import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { PropertyQueryService } from './property-query.service';

/** Image upload flow: presigned upload URLs, then confirm what was uploaded. */
@Injectable()
export class PropertyImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: PropertyQueryService,
    private readonly storage: SupabaseService,
  ) {}

  async createUploadUrls(userId: string, propertyId: string, fileNames: string[]) {
    await this.query.findOwned(userId, propertyId);
    return this.storage.createPresignedUrls(fileNames);
  }

  /** Attaches uploaded files to the property, after its existing images. */
  async confirmUploads(userId: string, propertyId: string, fileNames: string[]) {
    const property = await this.query.findOwned(userId, propertyId);
    const lastOrder = Math.max(0, ...property.images.map((image) => image.order));

    await this.prisma.propertyImage.createMany({
      data: fileNames.map((fileName, index) => ({
        propertyId,
        url: this.storage.getPublicUrl(fileName),
        order: lastOrder + index + 1,
      })),
    });

    return this.query.findOwned(userId, propertyId);
  }
}
