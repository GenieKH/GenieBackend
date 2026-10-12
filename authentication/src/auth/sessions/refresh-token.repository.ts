import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  revoked: boolean;
}

export interface NewRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ActiveSession {
  id: string;
  device_id: string | null;
  created_at: string;
  expires_at: string;
}

/** All reads and writes of the `refresh_tokens` table. */
@Injectable()
export class RefreshTokenRepository {
  private readonly logger = new Logger(RefreshTokenRepository.name);

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  async insert(token: NewRefreshToken): Promise<void> {
    const { error } = await this.supabase.from('refresh_tokens').insert([
      {
        id: token.id,
        user_id: token.userId,
        token_hash: token.tokenHash,
        expires_at: token.expiresAt.toISOString(),
      },
    ]);
    this.throwIfFailed(error, 'Failed to store refresh token');
  }

  async findById(id: string): Promise<RefreshTokenRecord | null> {
    const { data } = await this.supabase
      .from('refresh_tokens')
      .select('id, user_id, token_hash, revoked')
      .eq('id', id)
      .maybeSingle();
    return (data as RefreshTokenRecord | null) ?? null;
  }

  /**
   * Revokes a token only if it is still active.
   * Returns false when someone else already revoked it (a concurrent or replayed use).
   */
  async revokeIfActive(id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('id', id)
      .eq('revoked', false)
      .select('id');
    return !error && !!data && data.length > 0;
  }

  async revokeById(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('id', id);
    this.throwIfFailed(error, 'Failed to revoke token');
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('user_id', userId)
      .eq('revoked', false);
    this.throwIfFailed(error, 'Failed to revoke all sessions');
  }

  async listActiveForUser(userId: string): Promise<ActiveSession[]> {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .select('id, device_id, created_at, expires_at')
      .eq('user_id', userId)
      .eq('revoked', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    this.throwIfFailed(error, 'Failed to fetch sessions');
    return (data as ActiveSession[]) ?? [];
  }

  private throwIfFailed(error: { message: string } | null, publicMessage: string): void {
    if (!error) return;
    this.logger.error(`${publicMessage}: ${error.message}`);
    throw new InternalServerErrorException(publicMessage);
  }
}
