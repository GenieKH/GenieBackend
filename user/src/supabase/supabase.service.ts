import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
      await this.ensureBucket(this.bucketName, { public: true });
    } catch (error) {
      this.logger.error('Error initializing Supabase storage buckets', error);
    }
  }

  /** Creates the bucket if it does not exist yet. */
  async ensureBucket(name: string, options: { public: boolean; fileSizeLimit?: number }) {
    const { data: buckets, error } = await this.supabase.storage.listBuckets();
    if (error) throw error;

    if (buckets.some((bucket) => bucket.name === name)) {
      this.logger.log(`Bucket ${name} already exists.`);
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
   * True for a name `createPresignedUrls` could have handed out. Anything else
   * (a path, a URL, another bucket) must not be turned into a public link.
   */
  isUploadedFileName(fileName: string): boolean {
    return /^\d+-\d+-[a-zA-Z0-9._-]+$/.test(fileName);
  }

  async createPresignedUrls(fileNames: string[]): Promise<{ fileName: string; signedUrl: string }[]> {
    const results: { fileName: string; signedUrl: string }[] = [];
    for (const originalName of fileNames) {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filename = `${uniqueSuffix}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUploadUrl(filename);

      if (error) {
        this.logger.error(`Failed to create presigned URL for ${filename}`, error);
        throw error;
      }

      if (data && data.signedUrl) {
        results.push({
          fileName: filename,
          signedUrl: data.signedUrl,
        });
      }
    }
    return results;
  }

  getPublicUrl(fileName: string): string {
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  }
}
