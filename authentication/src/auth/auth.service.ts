import { Injectable, Inject, ConflictException, InternalServerErrorException, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { SupabaseClient } from '@supabase/supabase-js';
import { JwtService } from '@nestjs/jwt';
import { FirebaseService } from '../firebase/firebase.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(FirebaseService) private readonly firebaseService: FirebaseService
  ) {}

  async register(dto: RegisterDto) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const role = dto.role || 'user';

    const { data, error } = await this.supabase
      .from('users')
      .insert([
        {
          email: dto.email || null,
          phone: dto.phone || null,
          password_hash: passwordHash,
          role: role,
        },
      ]);

    if (error) {
      if (error.code === '23505') { 
        throw new ConflictException('Email or phone already exists');
      }
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async login(dto: LoginDto) {
    const query = this.supabase.from('users').select('*');
    if (dto.email) {
      query.eq('email', dto.email);
    } else if (dto.phone) {
      query.eq('phone', dto.phone);
    }
    
    const { data: users, error } = await query.limit(1);
    
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    
    const user = users?.[0];
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async firebaseLogin(idToken: string) {
    const decodedToken = await this.firebaseService.verifyIdToken(idToken);
    const { uid, email, phone_number } = decodedToken;

    // 1. Try to find user by firebase_uid
    let { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', uid)
      .single();

    // 2. If not found, try to find by email or phone and link them
    if (!user) {
      const query = this.supabase.from('users').select('*');
      if (email) {
        query.eq('email', email);
      } else if (phone_number) {
        query.eq('phone', phone_number);
      } else {
        // Just fail the query if there is no email or phone
        query.eq('id', '00000000-0000-0000-0000-000000000000'); 
      }
      
      const { data: linkedUsers } = await query.limit(1);
      
      if (linkedUsers && linkedUsers.length > 0) {
        user = linkedUsers[0];
        // Link the existing user with the Firebase UID
        await this.supabase
          .from('users')
          .update({ firebase_uid: uid })
          .eq('id', user.id);
      }
    }

    // 3. If still not found, create a new user automatically
    if (!user) {
      const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const { data: newUser, error: createError } = await this.supabase
        .from('users')
        .insert([
          {
            email: email || null,
            phone: phone_number || null,
            password_hash: dummyPasswordHash,
            role: 'user',
            firebase_uid: uid,
          }
        ])
        .select()
        .single();

      if (createError) {
        throw new InternalServerErrorException('Failed to create user from Firebase token');
      }
      user = newUser;
    }

    return this.generateTokens(user);
  }

  // Helper method to DRY up token generation
  private async generateTokens(user: any) {
    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role },
      { expiresIn: '15m' }
    );

    const jti = crypto.randomUUID();
    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti },
      { expiresIn: '30d' }
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: tokenError } = await this.supabase
      .from('refresh_tokens')
      .insert([
        {
          id: jti,
          user_id: user.id,
          token_hash: hashedRefreshToken,
          expires_at: expiresAt.toISOString(),
        }
      ]);

    if (tokenError) {
      throw new InternalServerErrorException('Failed to store refresh token: ' + tokenError.message);
    }

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshTokenStr: string) {
    let payload;
    try {
      payload = this.jwtService.verify(refreshTokenStr);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { sub, jti } = payload;
    if (!sub || !jti) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const { data: record, error } = await this.supabase
      .from('refresh_tokens')
      .select('*')
      .eq('id', jti)
      .single();

    if (error || !record) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Token Reuse Detection (if already revoked when we first read it)
    if (record.revoked) {
      // Revoke all tokens for this user because a compromised token was used
      await this.supabase
        .from('refresh_tokens')
        .update({ revoked: true })
        .eq('user_id', sub);
      throw new UnauthorizedException('Token theft detected. All sessions revoked.');
    }

    const hashMatches = await bcrypt.compare(refreshTokenStr, record.token_hash);
    if (!hashMatches) {
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    // Atomically mark current token as revoked to prevent concurrent refresh races
    const { data: updatedRecords, error: updateError } = await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('id', jti)
      .eq('revoked', false)
      .select();
      
    if (updateError || !updatedRecords || updatedRecords.length === 0) {
      // If we couldn't update it because it was already revoked by a concurrent request
      await this.supabase
        .from('refresh_tokens')
        .update({ revoked: true })
        .eq('user_id', sub);
      throw new UnauthorizedException('Token theft detected (Concurrent). All sessions revoked.');
    }

    // Get user role for new access token
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', sub)
      .single();

    if (userError || !user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Generate new Access Token
    const newAccessToken = this.jwtService.sign(
      { sub, role: user.role },
      { expiresIn: '15m' }
    );

    // Generate new Refresh Token
    const newJti = crypto.randomUUID();
    const newRefreshToken = this.jwtService.sign(
      { sub, jti: newJti },
      { expiresIn: '30d' }
    );

    const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: insertError } = await this.supabase
      .from('refresh_tokens')
      .insert([
        {
          id: newJti,
          user_id: sub,
          token_hash: hashedNewRefreshToken,
          expires_at: expiresAt.toISOString(),
        }
      ]);

    if (insertError) {
      throw new InternalServerErrorException('Failed to issue new refresh token');
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshTokenStr: string) {
    let payload;
    try {
      payload = this.jwtService.verify(refreshTokenStr, { ignoreExpiration: true });
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { jti } = payload;
    if (!jti) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const { error } = await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('id', jti);

    if (error) {
      throw new InternalServerErrorException('Failed to revoke token');
    }

    return { message: 'Logged out successfully' };
  }

  async getSessions(userId: string) {
    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .select('id, device_id, created_at, expires_at')
      .eq('user_id', userId)
      .eq('revoked', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to fetch sessions');
    }

    return data;
  }

  async logoutAll(userId: string) {
    const { error } = await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('user_id', userId)
      .eq('revoked', false);

    if (error) {
      throw new InternalServerErrorException('Failed to revoke all sessions');
    }

    return { message: 'All sessions revoked successfully' };
  }

  // ─── Forgot Password Flow ────────────────────────────────────────────

  private readonly logger = new Logger(AuthService.name);

  async forgotPassword(email: string) {
    // 1. Check if user exists
    const { data: users, error: userError } = await this.supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .limit(1);

    if (userError) {
      throw new InternalServerErrorException(userError.message);
    }

    if (!users || users.length === 0) {
      // Don't reveal whether the email exists — return success anyway
      return { message: 'If the email exists, a verification code has been sent.' };
    }

    // 2. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // 3. Invalidate any existing OTPs for this email
    await this.supabase
      .from('password_reset_otps')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // 4. Store new OTP
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: insertError } = await this.supabase
      .from('password_reset_otps')
      .insert([{
        email,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
        used: false,
      }]);

    if (insertError) {
      this.logger.error('Failed to store OTP', insertError);
      throw new InternalServerErrorException('Failed to initiate password reset');
    }

    // 5. Send email asynchronously so HTTP response returns immediately (<50ms)
    this.sendOtpEmail(email, otp).catch((err) => {
      this.logger.error(`Failed to dispatch OTP email to ${email}`, err);
    });

    return { message: 'If the email exists, a verification code has been sent.' };
  }

  async verifyOtp(email: string, otp: string) {
    const { data: records, error } = await this.supabase
      .from('password_reset_otps')
      .select('*')
      .eq('email', email)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!records || records.length === 0) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const record = records[0];
    const isMatch = await bcrypt.compare(otp, record.otp_hash);

    if (!isMatch) {
      throw new BadRequestException('Invalid verification code');
    }

    return { message: 'OTP verified successfully', verified: true };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    // 1. Re-verify OTP
    const { data: records, error } = await this.supabase
      .from('password_reset_otps')
      .select('*')
      .eq('email', email)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!records || records.length === 0) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const record = records[0];
    const isMatch = await bcrypt.compare(otp, record.otp_hash);

    if (!isMatch) {
      throw new BadRequestException('Invalid verification code');
    }

    // 2. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 3. Update user password
    const { error: updateError } = await this.supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('email', email);

    if (updateError) {
      throw new InternalServerErrorException('Failed to update password');
    }

    // 4. Mark OTP as used
    await this.supabase
      .from('password_reset_otps')
      .update({ used: true })
      .eq('id', record.id);

    // 5. Revoke all refresh tokens for this user (force re-login)
    const { data: user } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (user) {
      await this.supabase
        .from('refresh_tokens')
        .update({ revoked: true })
        .eq('user_id', user.id)
        .eq('revoked', false);
    }

    return { message: 'Password reset successfully' };
  }

  private async sendOtpEmail(email: string, otp: string) {
    try {
      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser;

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F1F5F9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); border: 1px solid #E2E8F0;">
          
          <!-- Top Accent Gradient Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%);"></td>
          </tr>

          <!-- Header / Brand -->
          <tr>
            <td style="padding: 36px 40px 24px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); width: 48px; height: 48px; border-radius: 14px; text-align: center; vertical-align: middle; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                    <span style="color: #FFFFFF; font-size: 24px; font-weight: 800; line-height: 48px;">G</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #0F172A;">GENIE</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #0F172A; text-align: center;">
                Password Reset Code
              </h1>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #475569; text-align: center;">
                We received a request to reset the password for your Genie account. Use the 6-digit verification code below to complete your reset:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px; background: linear-gradient(180deg, #F8FAFC 0%, #EEF2F6 100%); border: 1.5px dashed #CBD5E1; border-radius: 16px; text-align: center;">
                <tr>
                  <td style="padding: 24px 16px;">
                    <div style="font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #4F46E5; padding-left: 12px;">
                      ${otp}
                    </div>
                    <div style="margin-top: 10px; display: inline-block; background-color: #EEF2FF; color: #4338CA; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">
                      ⏱️ Valid for 10 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #92400E;">
                      <strong>Security Tip:</strong> Never share this code with anyone. Genie team members will never ask for your verification code or password.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 14px; line-height: 22px; color: #64748B; text-align: center;">
                If you did not request this password reset, please ignore this email or contact support if you have security concerns.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background-color: #E2E8F0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #94A3B8; font-weight: 500;">
                © 2026 Genie Real Estate & Property Marketplace. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #CBD5E1;">
                This is an automated security message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      // ── Method 1: Brevo HTTPS REST API (Port 443 - Never blocked on Railway) ─
      const brevoApiKey = process.env.BREVO_API_KEY;
      if (brevoApiKey) {
        try {
          const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'api-key': brevoApiKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              sender: { name: 'Genie Support', email: smtpFrom },
              to: [{ email }],
              subject: `${otp} is your Genie verification code`,
              htmlContent,
            }),
          });

          if (resp.ok) {
            this.logger.log(`OTP email successfully dispatched to ${email} via Brevo HTTPS REST API`);
            return;
          } else {
            const errText = await resp.text();
            this.logger.warn(`Brevo HTTPS API returned status ${resp.status}: ${errText}`);
          }
        } catch (apiErr: any) {
          this.logger.warn(`Brevo HTTPS API request failed: ${apiErr?.message}`);
        }
      }

      // ── Method 2: Resend HTTPS REST API (Port 443) ──────────────────────────
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        try {
          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `Genie Support <${smtpFrom}>`,
              to: [email],
              subject: `${otp} is your Genie verification code`,
              html: htmlContent,
            }),
          });

          if (resp.ok) {
            this.logger.log(`OTP email successfully dispatched to ${email} via Resend HTTPS REST API`);
            return;
          }
        } catch (resendErr: any) {
          this.logger.warn(`Resend HTTPS API request failed: ${resendErr?.message}`);
        }
      }

      // ── Method 3: Raw SMTP via Nodemailer ───────────────────────────────────
      if (!smtpUser || !smtpPass) {
        this.logger.warn('No email API keys or SMTP credentials configured, OTP logged only');
        this.logger.log(`[DEV] OTP for ${email}: ${otp}`);
        return;
      }

      const targetPort = smtpPort === 587 ? 465 : smtpPort;
      const isSecure = targetPort === 465;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: targetPort,
        secure: isSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });

      const mailOptions = {
        from: `"Genie Support" <${smtpFrom}>`,
        to: email,
        subject: `${otp} is your Genie verification code`,
        html: htmlContent,
      };

      try {
        await transporter.sendMail(mailOptions);
        this.logger.log(`OTP email successfully dispatched to ${email} (via port ${targetPort})`);
      } catch (firstErr: any) {
        this.logger.warn(`Primary SMTP dispatch on port ${targetPort} failed: ${firstErr?.message}. Retrying via fallback port 2525...`);
        const fallbackTransporter = nodemailer.createTransport({
          host: smtpHost,
          port: 2525,
          secure: false,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 12000,
        });
        await fallbackTransporter.sendMail(mailOptions);
        this.logger.log(`OTP email successfully dispatched to ${email} via fallback port 2525`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send OTP email to ${email}: ${error?.message}`, error?.stack);
      // Don't throw — the OTP is stored, user can request resend
    }
  }
}



