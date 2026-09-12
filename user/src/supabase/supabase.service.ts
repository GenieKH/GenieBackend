import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
      const { data: buckets, error } = await this.supabase.storage.listBuckets();
      if (error) throw error;

      const bucketExists = buckets.some((b) => b.name === this.bucketName);
      if (!bucketExists) {
        this.logger.log(`Bucket ${this.bucketName} not found, creating it...`);
        const { error: createError } = await this.supabase.storage.createBucket(
          this.bucketName,
          { public: true },
        );
        if (createError) throw createError;
        this.logger.log(`Bucket ${this.bucketName} created successfully.`);
      } else {
        this.logger.log(`Bucket ${this.bucketName} already exists.`);
      }
    } catch (error) {
      this.logger.error('Error initializing Supabase storage buckets', error);
    }
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
