import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { BCRYPT_ROUNDS, DEFAULT_USER_ROLE } from '../auth.constants';
import { ClientContext } from '../sessions/client-context';
import { SignInService } from '../sessions/sign-in.service';
import { TokenPair } from '../sessions/token-issuer.service';
import { UserRecord, UserRepository } from '../users/user.repository';

/** Email/phone + password registration and login. */
@Injectable()
export class CredentialsAuthService {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(SignInService) private readonly signIn: SignInService,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Self-registration never grants elevated roles.
    await this.users.create({
      email: dto.email || null,
      phone: dto.phone || null,
      password_hash: passwordHash,
      has_password: true,
      role: DEFAULT_USER_ROLE,
    });
  }

  async login(dto: LoginDto, client: ClientContext): Promise<TokenPair> {
    const user = await this.findByIdentifier(dto);

    // Same error for "unknown user" and "wrong password" so accounts can't be probed.
    const passwordMatches = user && (await bcrypt.compare(dto.password, user.password_hash));
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signIn.complete(user, client);
  }

  private findByIdentifier(dto: LoginDto): Promise<UserRecord | null> {
    if (dto.email) return this.users.findByEmail(dto.email);
    if (dto.phone) return this.users.findByPhone(dto.phone);
    throw new BadRequestException('Email or phone is required');
  }
}
