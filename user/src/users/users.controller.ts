import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { RateLimit, RateLimits } from '../redis/rate-limits.service';
import { AvatarService } from './avatar.service';
import { UseAvatarUploadDto, UseGooglePhotoDto } from './dto/avatar.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  /** An upload URL costs nothing to ask for but lets a file be stored: 10 per user every minute. */
  private readonly avatarUploadLimiter: RateLimit;

  constructor(
    private readonly usersService: UsersService,
    private readonly avatars: AvatarService,
    rateLimits: RateLimits,
  ) {
    this.avatarUploadLimiter = rateLimits.create('avatar-upload', 10, 60);
  }

  @Get('me')
  getProfile(@CurrentUserId() userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the profile: username, name, first/last name, sex, phone' })
  @ApiResponse({ status: 200, description: 'Profile successfully updated' })
  @ApiResponse({ status: 409, description: 'Username or phone already taken' })
  updateProfile(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/avatar/upload')
  @ApiOperation({ summary: 'Where to upload a new profile picture: `{ path, uploadUrl }`' })
  async createAvatarUpload(@CurrentUserId() userId: string) {
    try {
      await this.avatarUploadLimiter.consume(userId);
    } catch {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.avatars.createUpload(userId);
  }

  @Put('me/avatar')
  @ApiOperation({ summary: 'Use the picture uploaded to `path` as the profile picture' })
  useAvatarUpload(@CurrentUserId() userId: string, @Body() dto: UseAvatarUploadDto) {
    return this.avatars.useUpload(userId, dto.path);
  }

  @Put('me/avatar/google')
  @ApiOperation({ summary: "Use the Google account's photo, and keep following it" })
  useGooglePhoto(@CurrentUserId() userId: string, @Body() dto: UseGooglePhotoDto) {
    return this.avatars.useGooglePhoto(userId, dto.photoUrl);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Remove the profile picture' })
  removeAvatar(@CurrentUserId() userId: string) {
    return this.avatars.remove(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Another user's public profile (username, name, avatar, member since)" })
  @ApiResponse({ status: 404, description: 'User not found' })
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
