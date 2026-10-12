import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { BCRYPT_ROUNDS, OTP_TTL_MINUTES } from '../auth.constants';
import { OtpEmailService } from '../mail/otp-email.service';
import { RefreshTokenRepository } from '../sessions/refresh-token.repository';
import { UserRepository } from '../users/user.repository';
import { PasswordResetOtpRepository, PasswordResetOtpRecord } from './password-reset-otp.repository';

const REQUEST_ACCEPTED = 'If the email exists, a verification code has been sent.';

/** Forgot-password flow: request a code, verify it, set a new password. */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(PasswordResetOtpRepository) private readonly otps: PasswordResetOtpRepository,
    @Inject(RefreshTokenRepository) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(OtpEmailService) private readonly mailer: OtpEmailService,
  ) {}

  async requestReset(email: string): Promise<{ message: string }> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      // Same answer whether or not the account exists.
      return { message: REQUEST_ACCEPTED };
    }

    const otp = this.generateOtp();
    await this.otps.invalidateAllFor(email);
    await this.otps.create(email, await bcrypt.hash(otp, BCRYPT_ROUNDS), this.otpExpiry());

    // Don't make the HTTP response wait for the mail provider.
    this.mailer.sendOtp(email, otp).catch((err) => {
      this.logger.error(`Failed to dispatch OTP email: ${err?.message}`);
    });

    return { message: REQUEST_ACCEPTED };
  }

  async verifyOtp(email: string, otp: string): Promise<{ message: string; verified: boolean }> {
    await this.findMatchingOtp(email, otp);
    return { message: 'OTP verified successfully', verified: true };
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
    const record = await this.findMatchingOtp(email, otp);
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.users.update(user.id, {
      password_hash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
    });
    await this.otps.markUsed(record.id);

    // Force every device to log in again with the new password.
    await this.refreshTokens.revokeAllForUser(user.id);

    return { message: 'Password reset successfully' };
  }

  /** Returns the newest active code for the email if `otp` matches it. */
  private async findMatchingOtp(email: string, otp: string): Promise<PasswordResetOtpRecord> {
    const record = await this.otps.findLatestActive(email);
    if (!record) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    if (!(await bcrypt.compare(otp, record.otp_hash))) {
      throw new BadRequestException('Invalid verification code');
    }
    return record;
  }

  /** Cryptographically secure 6-digit code. */
  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private otpExpiry(): Date {
    return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  }
}
