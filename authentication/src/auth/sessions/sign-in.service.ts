import { Inject, Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { EmailDeliveryService } from '../mail/email-delivery.service';
import { SIGN_IN_ALERT_SUBJECT, signInAlertEmailHtml } from '../mail/sign-in-alert-email.template';
import { UserRecord } from '../users/user.repository';
import { ClientContext } from './client-context';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenIssuerService, TokenPair } from './token-issuer.service';

/**
 * What every successful sign-in ends with, whichever way the user proved who
 * they are (password or Google): the account comes back if it was
 * deactivated, a new session starts, and the owner is told when the account
 * was already in use on another device.
 */
@Injectable()
export class SignInService {
  private readonly logger = new Logger(SignInService.name);

  constructor(
    @Inject(AccountService) private readonly account: AccountService,
    @Inject(TokenIssuerService) private readonly tokens: TokenIssuerService,
    @Inject(RefreshTokenRepository) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(EmailDeliveryService) private readonly mail: EmailDeliveryService,
  ) {}

  async complete(user: UserRecord, client: ClientContext): Promise<TokenPair> {
    await this.account.reactivate(user);

    const alreadySignedInElsewhere = (await this.refreshTokens.listSessionTokens(user.id)).length > 0;
    const tokens = await this.tokens.issue(user.id, user.role, client);
    if (alreadySignedInElsewhere) this.alertOwner(user, client);
    return tokens;
  }

  /**
   * By email, because it reaches the owner wherever they are. Their other
   * devices also show the new one (the app compares the device list). Signing
   * in does not wait for the mail provider, and never fails because of it.
   */
  private alertOwner(user: UserRecord, client: ClientContext): void {
    if (!user.email) return;

    this.mail
      .deliver({
        to: user.email,
        subject: SIGN_IN_ALERT_SUBJECT,
        html: signInAlertEmailHtml({ ...client, signedInAt: new Date() }),
      })
      .catch((error: Error) => this.logger.warn(`Sign-in alert not sent: ${error.message}`));
  }
}
