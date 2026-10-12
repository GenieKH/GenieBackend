import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CredentialsAuthService } from './credentials/credentials-auth.service';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordResetService } from './password-reset/password-reset.service';
import { SessionService } from './sessions/session.service';
import { FirebaseLoginService } from './social/firebase-login.service';

/** HTTP layer only: every handler validates input (via DTOs) and delegates. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CredentialsAuthService) private readonly credentials: CredentialsAuthService,
    @Inject(FirebaseLoginService) private readonly firebaseLogin: FirebaseLoginService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(PasswordResetService) private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async register(@Body() dto: RegisterDto) {
    await this.credentials.register(dto);
    return { message: 'User registered successfully' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with credentials (email/phone + password)' })
  @ApiResponse({ status: 200, description: 'Successfully logged in, returns tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.credentials.login(dto);
  }

  @Post('firebase-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in or register using a Firebase ID token' })
  @ApiResponse({ status: 200, description: 'Successfully logged in, returns tokens' })
  @ApiResponse({ status: 401, description: 'Invalid Firebase token' })
  loginWithFirebase(@Body() dto: FirebaseLoginDto) {
    return this.firebaseLogin.login(dto.idToken);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiResponse({ status: 200, description: 'Tokens successfully rotated' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or revoked refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.sessions.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific refresh token (single device logout)' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  logout(@Body() dto: LogoutDto) {
    return this.sessions.logout(dto.refreshToken);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions for the current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSessions(@Request() req: AuthenticatedRequest) {
    return this.sessions.listSessions(req.user.userId);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions for the current user (logout everywhere)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  logoutAll(@Request() req: AuthenticatedRequest) {
    return this.sessions.logoutAll(req.user.userId);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset OTP via email' })
  @ApiResponse({ status: 200, description: 'OTP sent if email exists' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordReset.requestReset(dto.email);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a password reset OTP' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.passwordReset.verifyOtp(dto.email, dto.otp);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a verified OTP' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.resetPassword(dto.email, dto.otp, dto.newPassword);
  }
}

interface AuthenticatedRequest {
  user: { userId: string; role: string };
}
