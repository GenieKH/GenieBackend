import { ConflictException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

/** A row of the `users` table (column names are the database's snake_case). */
export interface UserRecord {
  id: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  role: string;
  username: string | null;
  avatar_url: string | null;
  firebase_uid: string | null;
}

export type NewUser = Partial<Omit<UserRecord, 'id'>> & Pick<UserRecord, 'password_hash'>;
export type UserPatch = Partial<Omit<UserRecord, 'id'>>;

const UNIQUE_VIOLATION = '23505';

/** All reads and writes of the `users` table for the auth module. */
@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  findById(id: string): Promise<UserRecord | null> {
    return this.findOneBy('id', id);
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.findOneBy('email', email);
  }

  findByPhone(phone: string): Promise<UserRecord | null> {
    return this.findOneBy('phone', phone);
  }

  findByFirebaseUid(uid: string): Promise<UserRecord | null> {
    return this.findOneBy('firebase_uid', uid);
  }

  async create(user: NewUser): Promise<UserRecord> {
    const { data, error } = await this.supabase.from('users').insert([user]).select().single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException('Email or phone already exists');
      }
      this.logger.error(`Failed to create user: ${error.message}`);
      throw new InternalServerErrorException('Failed to create user');
    }
    return data as UserRecord;
  }

  async update(id: string, patch: UserPatch): Promise<void> {
    const { error } = await this.supabase.from('users').update(patch).eq('id', id);
    if (error) {
      this.logger.error(`Failed to update user ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  private async findOneBy(column: string, value: string): Promise<UserRecord | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq(column, value)
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to look up user by ${column}: ${error.message}`);
      throw new InternalServerErrorException('Failed to look up user');
    }
    return (data as UserRecord | null) ?? null;
  }
}
