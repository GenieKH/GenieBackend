import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser, PrismaService } from '@genie/shared';

/**
 * Lets in admin accounts only. Placed after `JwtAuthGuard`. The role is read
 * from the database, not the token: an admin who loses the role loses access
 * at once, not when their token expires.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const caller = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    const account = caller
      ? await this.prisma.user.findFirst({
          where: { id: caller.userId, deactivatedAt: null },
          select: { role: true },
        })
      : null;
    if (account?.role !== 'admin') {
      throw new ForbiddenException('Only an admin can do this');
    }
    return true;
  }
}
