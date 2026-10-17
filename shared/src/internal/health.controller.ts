import { Controller, Get } from '@nestjs/common';

/**
 * What the platform's health check asks. It only shows the process is up and
 * answering: it must not depend on the database or other services, or one
 * outage would make the platform restart every service.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
