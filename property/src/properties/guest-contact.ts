import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/** How a listing or a person is reached: only signed-in users see them. */
const CONTACT_KEYS = new Set(['email', 'phone', 'contactPhone']);

/**
 * `body` without any contact details, at any depth: the owner on a listing,
 * a listing's own phone, a publisher's profile. A copy, so a cached answer
 * shared with signed-in callers keeps them. Only plain objects and arrays are
 * walked; dates and prices (Prisma decimals) are kept as they are.
 */
export function withoutContactDetails<T>(body: T): T {
  if (Array.isArray(body)) {
    return body.map((item: unknown) => withoutContactDetails(item)) as T;
  }
  if (!isPlainObject(body)) return body;

  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (CONTACT_KEYS.has(key)) continue;
    copy[key] = withoutContactDetails(value);
  }
  return copy as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/**
 * Guests browse listings and publishers without their phone and email, so
 * the public routes cannot be used to collect them. Put after
 * `OptionalJwtAuthGuard`, which tells who is signed in.
 */
@Injectable()
export class GuestContactInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { userId: string } | null }>();
    if (request.user?.userId) return next.handle();
    return next
      .handle()
      .pipe(map((body: unknown) => withoutContactDetails(body)));
  }
}
