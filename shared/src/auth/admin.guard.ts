import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './jwt.strategy';

type Caller = {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
};

/**
 * Lets in admin accounts only. The caller is the user `JwtAuthGuard` found,
 * else the one the gateway wrote to `x-user-id`. The role is read from the
 * database, not the token: an admin who loses the role loses access at once,
 * not when their token expires.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = callerId(context.switchToHttp().getRequest<Caller>());
    const account = userId
      ? await this.prisma.user.findFirst({
          where: { id: userId, deactivatedAt: null },
          select: { role: true },
        })
      : null;
    if (account?.role !== 'admin') {
      throw new ForbiddenException('Only an admin can do this');
    }
    return true;
  }
}

function callerId(request: Caller): string | undefined {
  if (request.user?.userId) return request.user.userId;
  const header = request.headers?.['x-user-id'];
  return Array.isArray(header) ? header[0] : header;
}
