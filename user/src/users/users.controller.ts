import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';

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
}

