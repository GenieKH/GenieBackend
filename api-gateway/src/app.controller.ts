import { Controller, Get } from '@nestjs/common';

/** Liveness probe used by the container health check. */
@Controller('health')
export class AppController {
  @Get()
  getHealth() {
    return { status: 'ok' };
  }
}
