import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PUBLIC_IMAGE_TYPES, SupabaseService } from '@genie/shared';
import { randomUUID } from 'crypto';

const BUCKET = 'property-images';

/**
 * Listing photos are compressed to under 4 MB on the phone (the app's
 * `ImageUploadPolicy.propertyPhoto`). Storage refuses anything above this,
 * so a client that skips compression still cannot upload a large file.
 */
const PROPERTY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** `<user>/<listing>/<uuid>-<name>`: how listing photos are named now. */
const FOLDER_FILE_NAME =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-zA-Z0-9._-]+$/;

/** `<time>-<random>-<name>`: photos uploaded before they had folders. */
const LEGACY_FILE_NAME = /^\d+-\d+-[a-zA-Z0-9._-]+$/;

/** Longest part of the original name kept in a stored name. */
const MAX_NAME_PART = 80;

/** The `property-images` bucket: how listing photos are named, uploaded and removed. */
@Injectable()
export class PropertyPhotoStorage implements OnModuleInit {
  private readonly logger = new Logger(PropertyPhotoStorage.name);

  constructor(private readonly storage: SupabaseService) {}

  async onModuleInit() {
    try {
      await this.storage.ensureBucket(BUCKET, {
        public: true,
        fileSizeLimit: PROPERTY_IMAGE_MAX_BYTES,
        allowedMimeTypes: PUBLIC_IMAGE_TYPES,
      });
    } catch (error) {
      this.logger.error('Error initializing Supabase storage buckets', error);
    }
  }

  /** Deletes listing photos by the names `createPresignedUrls` gave them. */
  removeUploadedFiles(fileNames: string[]): Promise<void> {
    return this.storage.removeFiles(
      BUCKET,
      fileNames.filter((fileName) => this.isUploadedFileName(fileName)),
    );
  }

  /**
   * True for a name `createPresignedUrls` hands out, or handed out before
   * photos had folders. Anything else (a URL, a path that climbs out of a
   * folder, another bucket) must never become a public link or be deleted.
   */
  isUploadedFileName(fileName: string): boolean {
    return FOLDER_FILE_NAME.test(fileName) || LEGACY_FILE_NAME.test(fileName);
  }

  /** True for a photo stored before photos had folders: it carries no owner. */
  isLegacyFileName(fileName: string): boolean {
    return LEGACY_FILE_NAME.test(fileName);
  }

  /**
   * One upload URL per name, in the same order, each for a new unique file
   * inside `folder`. The original name is only kept as a readable suffix.
   */
  createPresignedUrls(
    folder: string,
    fileNames: string[],
  ): Promise<{ fileName: string; signedUrl: string }[]> {
    return Promise.all(
      fileNames.map(async (originalName) => {
        const readable = originalName
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .slice(-MAX_NAME_PART);
        const fileName = `${folder}/${randomUUID()}-${readable || 'image'}`;
        const signedUrl = await this.storage.createSignedUploadUrl(
          BUCKET,
          fileName,
        );
        return { fileName, signedUrl };
      }),
    );
  }

  /** The name a listing photo was stored under, from its public URL. Null for any other URL. */
  uploadedFileNameOf(url: string): string | null {
    const prefix = this.getPublicUrl('');
    if (!url.startsWith(prefix)) return null;
    const fileName = decodeURIComponent(url.slice(prefix.length));
    return this.isUploadedFileName(fileName) ? fileName : null;
  }

  getPublicUrl(fileName: string): string {
    return this.storage.publicUrl(BUCKET, fileName);
  }
}
