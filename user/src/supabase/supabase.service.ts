import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/**
 * Listing photos are compressed to under 4 MB on the phone (the app's
 * `ImageUploadPolicy.propertyPhoto`). Storage refuses anything above this,
 * so a client that skips compression still cannot upload a large file.
 */
const PROPERTY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * What a public bucket may hold. The app re-encodes every picture as a JPEG;
 * anything else (HTML, SVG, a program) would be served from our storage
 * domain to whoever opens the link.
 */
export const PUBLIC_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** `<user>/<listing>/<uuid>-<name>`: how listing photos are named now. */
const FOLDER_FILE_NAME = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-zA-Z0-9._-]+$/;

/** `<time>-<random>-<name>`: photos uploaded before they had folders. */
const LEGACY_FILE_NAME = /^\d+-\d+-[a-zA-Z0-9._-]+$/;

/** Longest part of the original name kept in a stored name. */
const MAX_NAME_PART = 80;

/** The most entries storage lists or deletes in one call. */
const LIST_PAGE_SIZE = 1000;
/** Far more than any account has; stops a loop if storage keeps listing a file it will not delete. */
const MAX_LIST_PAGES = 100;

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);
  private readonly bucketName = 'property-images';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async onModuleInit() {
    try {
      await this.ensureBucket(this.bucketName, {
        public: true,
        fileSizeLimit: PROPERTY_IMAGE_MAX_BYTES,
        allowedMimeTypes: PUBLIC_IMAGE_TYPES,
      });
    } catch (error) {
      this.logger.error('Error initializing Supabase storage buckets', error);
    }
  }

  /**
   * Creates the bucket if it does not exist yet. A bucket that does exist keeps
   * the limits it was made with, so they are applied to it again: a limit
   * added later must reach buckets that were created before it.
   */
  async ensureBucket(name: string, options: { public: boolean; fileSizeLimit?: number; allowedMimeTypes?: string[] }) {
    const { data: buckets, error } = await this.supabase.storage.listBuckets();
    if (error) throw error;

    if (buckets.some((bucket) => bucket.name === name)) {
      const { error: updateError } = await this.supabase.storage.updateBucket(name, options);
      if (updateError) throw updateError;
      this.logger.log(`Bucket ${name} already exists; limits applied.`);
      return;
    }
    this.logger.log(`Bucket ${name} not found, creating it...`);
    const { error: createError } = await this.supabase.storage.createBucket(name, options);
    if (createError) throw createError;
    this.logger.log(`Bucket ${name} created successfully.`);
  }

  /** A URL the client can PUT one file to, without any other credentials. */
  async createSignedUploadUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data?.signedUrl) {
      throw error ?? new Error(`No upload URL returned for ${bucket}/${path}`);
    }
    return data.signedUrl;
  }

  /** A short-lived URL to read one file of a private bucket. Null if the file does not exist. */
  async createSignedDownloadUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string | null> {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error) {
      if (/not.?found/i.test(error.message)) return null;
      throw error;
    }
    return data.signedUrl;
  }

  /** The address of a file in a public bucket. */
  publicUrl(bucket: string, path: string): string {
    return this.supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  /** Deletes files of a bucket. Ones that do not exist are ignored. */
  async removeFiles(bucket: string, paths: string[]): Promise<void> {
    for (let start = 0; start < paths.length; start += LIST_PAGE_SIZE) {
      const { error } = await this.supabase.storage.from(bucket).remove(paths.slice(start, start + LIST_PAGE_SIZE));
      if (error) throw error;
    }
  }

  /** Deletes every file under `folder`, at any depth. */
  async removeFolder(bucket: string, folder: string): Promise<void> {
    // Storage lists one level at a time and at most a page of it, so keep
    // going until the level is empty. A folder disappears with its last file.
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      const { data, error } = await this.supabase.storage.from(bucket).list(folder, { limit: LIST_PAGE_SIZE });
      if (error) throw error;
      if (!data || data.length === 0) return;

      // A folder is listed without an id.
      const files = data.filter((entry) => entry.id !== null).map((entry) => `${folder}/${entry.name}`);
      for (const subfolder of data.filter((entry) => entry.id === null)) {
        await this.removeFolder(bucket, `${folder}/${subfolder.name}`);
      }
      await this.removeFiles(bucket, files);
    }
    throw new Error(`${bucket}/${folder} still has files after ${MAX_LIST_PAGES} passes`);
  }

  /** Deletes listing photos by the names `createPresignedUrls` gave them. */
  removeUploadedFiles(fileNames: string[]): Promise<void> {
    return this.removeFiles(this.bucketName, fileNames.filter((fileName) => this.isUploadedFileName(fileName)));
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
  createPresignedUrls(folder: string, fileNames: string[]): Promise<{ fileName: string; signedUrl: string }[]> {
    return Promise.all(
      fileNames.map(async (originalName) => {
        const readable = originalName.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-MAX_NAME_PART);
        const fileName = `${folder}/${randomUUID()}-${readable || 'image'}`;
        const signedUrl = await this.createSignedUploadUrl(this.bucketName, fileName);
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
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  }
}
