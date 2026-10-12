import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { CredentialsAuthService } from './credentials/credentials-auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpEmailService } from './mail/otp-email.service';
import { PasswordResetOtpRepository } from './password-reset/password-reset-otp.repository';
import { PasswordResetService } from './password-reset/password-reset.service';
import { RefreshTokenRepository } from './sessions/refresh-token.repository';
import { SessionService } from './sessions/session.service';
import { TokenIssuerService } from './sessions/token-issuer.service';
import { FirebaseLoginService } from './social/firebase-login.service';
import { UserRepository } from './users/user.repository';

@Module({
  imports: [
    JwtModule.register({
      privateKey: process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      publicKey: process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n'),
      signOptions: { algorithm: 'RS256' },
      verifyOptions: { algorithms: ['RS256'] },
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    UserRepository,
    RefreshTokenRepository,
    PasswordResetOtpRepository,
    TokenIssuerService,
    SessionService,
    CredentialsAuthService,
    FirebaseLoginService,
    PasswordResetService,
    OtpEmailService,
  ],
})
export class AuthModule {}
