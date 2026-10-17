import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

/**
 * A row of `refresh_tokens` (column names are the database's snake_case).
 *
 * A session is one sign-in on one device: all the tokens it was given over
 * time share a `session_id`, and at most one of them is not revoked. Tokens
 * issued before sessions existed have none.
 */
export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  revoked: boolean;
  created_at: string;
  session_id: string | null;
  session_started_at: string | null;
  device_name: string | null;
  platform: string | null;
  ip_address: string | null;
  location: string | null;
}

/** The session a new token belongs to, and the device it was issued to. */
export interface SessionDetails {
  id: string;
  /** ISO time of the sign-in that started the session. */
  startedAt: string;
  deviceName: string | null;
  platform: string | null;
  ipAddress: string | null;
  location: string | null;
}

export interface NewRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  session: SessionDetails;
}

interface SessionIdRow {
  session_id: string | null;
}

const RECORD_COLUMNS =
  'id, user_id, token_hash, revoked, created_at, session_id, session_started_at, device_name, platform, ip_address, location';

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
        session_id: token.session.id,
        session_started_at: token.session.startedAt,
        device_name: token.session.deviceName,
        platform: token.session.platform,
        ip_address: token.session.ipAddress,
        location: token.session.location,
      },
    ]);
    this.throwIfFailed(error, 'Failed to store refresh token');
  }

  async findById(id: string): Promise<RefreshTokenRecord | null> {
    const { data } = await this.supabase.from('refresh_tokens').select(RECORD_COLUMNS).eq('id', id).maybeSingle();
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

  /** Revokes one token and returns the session it belonged to, if it had one. */
  async revokeById(id: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('id', id)
      .select('session_id');
    this.throwIfFailed(error, 'Failed to revoke token');
    return (data as SessionIdRow[] | null)?.[0]?.session_id ?? null;
  }

  /**
   * Revokes every usable token of the user, or every one outside
   * `exceptSessionId`. Returns the sessions that ended with them.
   */
  async revokeAllForUser(userId: string, exceptSessionId?: string | null): Promise<string[]> {
    let query = this.supabase.from('refresh_tokens').update({ revoked: true }).eq('user_id', userId).eq('revoked', false);
    if (exceptSessionId) {
      // Spelled out because `neq` alone would skip the tokens that have no session.
      query = query.or(`session_id.is.null,session_id.neq.${exceptSessionId}`);
    }
    const { data, error } = await query.select('session_id');
    this.throwIfFailed(error, 'Failed to revoke all sessions');
    return ((data as SessionIdRow[] | null) ?? []).flatMap((row) => (row.session_id ? [row.session_id] : []));
  }

  /** Ends one session of the user. Returns false if they have no such active session. */
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('revoked', false)
      .select('id');
    this.throwIfFailed(error, 'Failed to revoke session');
    return !!data && data.length > 0;
  }

  /** Whether the session still has a token that can be used. */
  async hasActiveToken(sessionId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .select('id')
      .eq('session_id', sessionId)
      .eq('revoked', false)
      .limit(1);
    this.throwIfFailed(error, 'Failed to check session');
    return !!data && data.length > 0;
  }

  /** The usable token of each of the user's sessions, most recently used first. */
  async listSessionTokens(userId: string): Promise<RefreshTokenRecord[]> {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .select(RECORD_COLUMNS)
      .eq('user_id', userId)
      .eq('revoked', false)
      .not('session_id', 'is', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    this.throwIfFailed(error, 'Failed to fetch sessions');
    return (data as RefreshTokenRecord[]) ?? [];
  }

  async setLocation(id: string, location: string): Promise<void> {
    const { error } = await this.supabase.from('refresh_tokens').update({ location }).eq('id', id);
    this.throwIfFailed(error, 'Failed to store session location');
  }

  private throwIfFailed(error: { message: string } | null, publicMessage: string): void {
    if (!error) return;
    this.logger.error(`${publicMessage}: ${error.message}`);
    throw new InternalServerErrorException(publicMessage);
  }
}
