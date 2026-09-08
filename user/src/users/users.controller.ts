import { Controller, Get, Patch, Body, Req, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req: any) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the user profile (username, phone)' })
  @ApiResponse({ status: 200, description: 'Profile successfully updated' })
  @ApiResponse({ status: 409, description: 'Username or phone already taken' })
  updateProfile(@Req() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.usersService.updateProfile(userId, updateProfileDto);
  }
}

