import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { otpEmailHtml, otpEmailSubject } from './otp-email.template';

const SMTP_TIMEOUTS = { connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 };
const SMTP_FALLBACK_PORT = 2525;

/**
 * Delivers the password-reset code. Providers are tried in order until one
 * succeeds: Brevo (HTTPS) -> Resend (HTTPS) -> SMTP.
 * HTTPS providers come first because hosts such as Railway block SMTP ports.
 * Failures are logged, never thrown: the code is stored and can be re-requested.
 */
@Injectable()
export class OtpEmailService {
  private readonly logger = new Logger(OtpEmailService.name);

  async sendOtp(to: string, otp: string): Promise<void> {
    const message = { to, subject: otpEmailSubject(otp), html: otpEmailHtml(otp) };

    try {
      if (await this.sendWithBrevo(message)) return;
      if (await this.sendWithResend(message)) return;
      if (await this.sendWithSmtp(message, otp)) return;
    } catch (error) {
      this.logger.error(`Failed to send OTP email: ${(error as Error).message}`);
    }
  }

  private get sender(): string | undefined {
    return process.env.SMTP_FROM || process.env.SMTP_USER;
  }

  private async sendWithBrevo(message: Message): Promise<boolean> {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return false;

    return this.postJson('Brevo', 'https://api.brevo.com/v3/smtp/email', {
      'api-key': apiKey,
      accept: 'application/json',
    }, {
      sender: { name: 'Genie Support', email: this.sender },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
    });
  }

  private async sendWithResend(message: Message): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    return this.postJson('Resend', 'https://api.resend.com/emails', {
      Authorization: `Bearer ${apiKey}`,
    }, {
      from: `Genie Support <${this.sender}>`,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    });
  }

  private async sendWithSmtp(message: Message, otp: string): Promise<boolean> {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      this.logger.warn('No email provider configured; the reset code was not sent.');
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[DEV] OTP for ${message.to}: ${otp}`);
      }
      return false;
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const configuredPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const primaryPort = configuredPort === 587 ? 465 : configuredPort;
    const mail = { from: `"Genie Support" <${this.sender}>`, ...message };

    try {
      await this.smtpTransport(host, primaryPort, primaryPort === 465, user, pass).sendMail(mail);
      return true;
    } catch (error) {
      this.logger.warn(`SMTP port ${primaryPort} failed (${(error as Error).message}); retrying on ${SMTP_FALLBACK_PORT}`);
      await this.smtpTransport(host, SMTP_FALLBACK_PORT, false, user, pass).sendMail(mail);
      return true;
    }
  }

  private smtpTransport(host: string, port: number, secure: boolean, user: string, pass: string) {
    return nodemailer.createTransport({ host, port, secure, auth: { user, pass }, ...SMTP_TIMEOUTS });
  }

  private async postJson(
    provider: string,
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      if (response.ok) return true;
      this.logger.warn(`${provider} responded with status ${response.status}`);
    } catch (error) {
      this.logger.warn(`${provider} request failed: ${(error as Error).message}`);
    }
    return false;
  }
}

interface Message {
  to: string;
  subject: string;
  html: string;
}
