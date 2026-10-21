import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { serviceCallGuard } from '@genie/shared';
import { FollowsService } from './follows.service';

/**
 * Who an account follows, for the property service's feed. Never reachable
 * from the app: the gateway does not forward `/internal`, and the guard
 * checks the caller's service token.
 */
@ApiExcludeController()
@UseGuards(serviceCallGuard('property'))
@Controller('internal/follows/:userId')
export class InternalFollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Get('following')
  following(@Param('userId', ParseUUIDPipe) userId: string): Promise<string[]> {
    return this.follows.followingIds(userId);
  }
}
