import { Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** The same check as JwtAuthGuard, but a missing or bad token just means "not signed in". */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest(err: any, user: any, info: any) {
    const reason: string | undefined = info?.message ?? err?.message;
    // A request with no token at all is normal here; one that carried a token that failed is not.
    if (!user && reason && reason !== 'No auth token') {
      this.logger.warn(`Token rejected: ${reason}`);
    }
    return user || null;
  }
}
