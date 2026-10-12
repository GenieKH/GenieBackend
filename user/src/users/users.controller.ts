import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUserId() userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the user profile (username, phone, avatar)' })
  @ApiResponse({ status: 200, description: 'Profile successfully updated' })
  @ApiResponse({ status: 409, description: 'Phone already taken' })
  updateProfile(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: "Another user's public profile (name, avatar, member since)" })
  @ApiResponse({ status: 404, description: 'User not found' })
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
