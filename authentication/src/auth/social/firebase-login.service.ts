import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { FirebaseService } from '../../firebase/firebase.service';
import { BCRYPT_ROUNDS, DEFAULT_USER_ROLE } from '../auth.constants';
import { RefreshTokenRepository } from '../sessions/refresh-token.repository';
import { TokenIssuerService, TokenPair } from '../sessions/token-issuer.service';
import { UserPatch, UserRecord, UserRepository } from '../users/user.repository';

interface FirebaseProfile {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  displayName: string | null;
  photoUrl: string | null;
}

/** Logs a user in (or creates the account) from a verified Firebase ID token. */
@Injectable()
export class FirebaseLoginService {
  private readonly logger = new Logger(FirebaseLoginService.name);

  constructor(
    @Inject(FirebaseService) private readonly firebase: FirebaseService,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(TokenIssuerService) private readonly tokens: TokenIssuerService,
    @Inject(RefreshTokenRepository) private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async login(idToken: string): Promise<TokenPair> {
    const profile = await this.readProfile(idToken);

    let user = await this.users.findByFirebaseUid(profile.uid);
    if (!user) user = await this.linkExistingAccount(profile);
    if (!user) user = await this.createAccount(profile);

    user = await this.fillMissingProfile(user, profile);
    return this.tokens.issue(user.id, user.role);
  }

  private async readProfile(idToken: string): Promise<FirebaseProfile> {
    const token = await this.firebase.verifyIdToken(idToken);
    return {
      uid: token.uid,
      email: token.email ?? null,
      emailVerified: token.email_verified === true,
      phone: token.phone_number ?? null,
      displayName: (token.name as string | undefined) ?? null,
      photoUrl: (token.picture as string | undefined) ?? null,
    };
  }

  /**
   * Attaches the Firebase identity to an account that already exists with the
   * same email or phone. An email is only trusted when Firebase verified it,
   * otherwise anyone could claim someone else's account.
   *
   * Registration never checked who owns that email or phone, so the account's
   * password may have been set by a stranger waiting for the real owner to sign
   * in. Linking therefore discards the password and ends every open session;
   * the owner can set a new password with "forgot password".
   */
  private async linkExistingAccount(profile: FirebaseProfile): Promise<UserRecord | null> {
    let existing: UserRecord | null = null;
    if (profile.email && profile.emailVerified) {
      existing = await this.users.findByEmail(profile.email);
    } else if (profile.phone) {
      existing = await this.users.findByPhone(profile.phone);
    }
    if (!existing) return null;

    const password_hash = await this.unusablePasswordHash();
    await this.users.update(existing.id, { firebase_uid: profile.uid, password_hash });
    await this.refreshTokens.revokeAllForUser(existing.id);
    return { ...existing, firebase_uid: profile.uid, password_hash };
  }

  private async createAccount(profile: FirebaseProfile): Promise<UserRecord> {
    try {
      return await this.users.create({
        email: profile.email,
        phone: profile.phone,
        username: profile.displayName,
        avatar_url: profile.photoUrl,
        password_hash: await this.unusablePasswordHash(),
        role: DEFAULT_USER_ROLE,
        firebase_uid: profile.uid,
      });
    } catch (error) {
      this.logger.error(`Could not create user for Firebase uid ${profile.uid}`);
      throw new InternalServerErrorException('Failed to create user from Firebase token');
    }
  }

  /** Accounts without a password of their own still need a hash nobody can match. */
  private unusablePasswordHash(): Promise<string> {
    return bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
  }

  /** Copies the Google name/photo onto the account when it has none. */
  private async fillMissingProfile(user: UserRecord, profile: FirebaseProfile): Promise<UserRecord> {
    const patch: UserPatch = {};
    if (!user.username && profile.displayName) patch.username = profile.displayName;
    if (!user.avatar_url && profile.photoUrl) patch.avatar_url = profile.photoUrl;
    if (Object.keys(patch).length === 0) return user;

    await this.users.update(user.id, patch);
    return { ...user, ...patch };
  }
}
