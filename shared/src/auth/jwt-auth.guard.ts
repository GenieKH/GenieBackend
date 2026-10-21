import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  handleRequest<TUser = any>(
    err: { message?: string } | undefined,
    user: any,
    info: { message?: string } | undefined,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    if (!user) {
      // The reason (invalid signature, expired, no key...) is what an operator needs to find a misconfigured service.
      this.logger.warn(
        `Token rejected: ${info?.message ?? err?.message ?? 'unknown reason'}`,
      );
    }
    return super.handleRequest(err, user, info, context, status);
  }
}
