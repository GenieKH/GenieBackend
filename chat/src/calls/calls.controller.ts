import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '@genie/shared';
import { IceServer, IceServersService } from './ice-servers.service';

@ApiTags('calls')
@Controller('chat/calls')
export class CallsController {
  constructor(private readonly iceServers: IceServersService) {}

  /** Asked before each call: the TURN password in it expires. */
  @Get('ice-servers')
  getIceServers(@CurrentUserId() userId: string): { iceServers: IceServer[] } {
    return this.iceServers.forUser(userId);
  }
}
