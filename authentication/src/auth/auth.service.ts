import { Injectable, Inject, ConflictException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { SupabaseClient } from '@supabase/supabase-js';
import { JwtService } from '@nestjs/jwt';
import { FirebaseService } from '../firebase/firebase.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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

    // Token Reuse Detection
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

    // Mark current token as revoked
    await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('id', jti);

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
}



