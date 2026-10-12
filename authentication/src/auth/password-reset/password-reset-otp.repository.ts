import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

export interface PasswordResetOtpRecord {
  id: string;
  otp_hash: string;
}

/** All reads and writes of the `password_reset_otps` table. */
@Injectable()
export class PasswordResetOtpRepository {
  private readonly logger = new Logger(PasswordResetOtpRepository.name);

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  /** Marks every unused code for the email as used, so only the newest one works. */
  async invalidateAllFor(email: string): Promise<void> {
    await this.supabase
      .from('password_reset_otps')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);
  }

  async create(email: string, otpHash: string, expiresAt: Date): Promise<void> {
    const { error } = await this.supabase
      .from('password_reset_otps')
      .insert([{ email, otp_hash: otpHash, expires_at: expiresAt.toISOString(), used: false }]);

    if (error) {
      this.logger.error(`Failed to store OTP: ${error.message}`);
      throw new InternalServerErrorException('Failed to initiate password reset');
    }
  }

  async findLatestActive(email: string): Promise<PasswordResetOtpRecord | null> {
    const { data, error } = await this.supabase
      .from('password_reset_otps')
      .select('id, otp_hash')
      .eq('email', email)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      this.logger.error(`Failed to read OTP: ${error.message}`);
      throw new InternalServerErrorException('Failed to verify code');
    }
    return (data?.[0] as PasswordResetOtpRecord | undefined) ?? null;
  }

  /** Removes every code ever sent to the email: nothing of a deleted account is kept. */
  async deleteAllFor(email: string): Promise<void> {
    const { error } = await this.supabase.from('password_reset_otps').delete().eq('email', email);
    if (error) {
      this.logger.error(`Failed to delete OTPs: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete account');
    }
  }

  async markUsed(id: string): Promise<void> {
    await this.supabase.from('password_reset_otps').update({ used: true }).eq('id', id);
  }
}
