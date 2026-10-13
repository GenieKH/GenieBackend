import { ConflictException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

/** A row of the `users` table (column names are the database's snake_case). */
export interface UserRecord {
  id: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  /**
   * False while `password_hash` is a value nobody can match: an account made
   * by Google sign-in whose owner has not chosen a password yet.
   */
  has_password: boolean;
  role: string;
  /** The unique handle. The database fills it in for a new account. */
  username: string | null;
  /** The name people see. */
  name: string | null;
  avatar_url: string | null;
  firebase_uid: string | null;
  /** Set while the owner has switched the account off. */
  deactivated_at: string | null;
}

export type NewUser = Partial<Omit<UserRecord, 'id' | 'username'>> & Pick<UserRecord, 'password_hash'>;
export type UserPatch = Partial<Omit<UserRecord, 'id'>>;

const UNIQUE_VIOLATION = '23505';

/** The unique index on `users.username` (migration 7); it names itself in a violation. */
const USERNAME_INDEX = 'users_username_key';

/**
 * How many times a new account is tried with a freshly generated handle. A
 * collision needs two of about a trillion random handles to match, so one
 * retry is already far more than will ever be used.
 */
const MAX_CREATE_ATTEMPTS = 5;

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

  /**
   * Creates the account. Its username is not passed in: the database gives
   * every new account a random handle (`user_` and 10 hex digits) that no
   * other account has, and the owner can change it later. In the unlikely
   * event that handle is taken the insert is simply tried again, which draws
   * a new one, instead of failing the sign-up as if the email were in use.
   */
  async create(user: NewUser): Promise<UserRecord> {
    for (let attempt = 1; ; attempt++) {
      const { data, error } = await this.supabase.from('users').insert([user]).select().single();
      if (!error) return data as UserRecord;

      if (error.code === UNIQUE_VIOLATION) {
        const handleCollided = `${error.message} ${error.details ?? ''}`.includes(USERNAME_INDEX);
        if (!handleCollided) throw new ConflictException('Email or phone already exists');
        if (attempt < MAX_CREATE_ATTEMPTS) continue;
      }
      this.logger.error(`Failed to create user: ${error.message}`);
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async update(id: string, patch: UserPatch): Promise<void> {
    const { error } = await this.supabase.from('users').update(patch).eq('id', id);
    if (error) {
      this.logger.error(`Failed to update user ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  /**
   * Removes the account for good. The database deletes everything that belongs
   * to it with the row: sessions, listings, favourites, chat messages and keys.
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('users').delete().eq('id', id);
    if (error) {
      this.logger.error(`Failed to delete user ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete account');
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
