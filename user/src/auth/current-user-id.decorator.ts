import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Injects the authenticated user's id.
 *
 * The api-gateway verifies the JWT and forwards the user id in the
 * `x-user-id` header; this service is never exposed directly to clients.
 */
export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const header = context.switchToHttp().getRequest().headers['x-user-id'];
  const userId = Array.isArray(header) ? header[0] : header;
  if (!userId) {
    throw new UnauthorizedException('User not authenticated');
  }
  return userId;
});
