import { ExecutionContext } from '@nestjs/common';
import { Prisma } from '@genie/prisma-client';
import { lastValueFrom, of } from 'rxjs';
import {
  GuestContactInterceptor,
  withoutContactDetails,
} from './guest-contact';

const listing = () => ({
  id: 'p1',
  title: 'Villa',
  price: new Prisma.Decimal('120000.50'),
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  contactPhone: '012 345 678',
  user: { id: 'u1', name: 'Dara', email: 'dara@example.com', phone: '099' },
});

describe('withoutContactDetails', () => {
  it("drops the owner's email and phone and the listing's own phone", () => {
    const result = withoutContactDetails(listing());
    expect(result).not.toHaveProperty('contactPhone');
    expect(result.user).toEqual({ id: 'u1', name: 'Dara' });
  });

  it('keeps prices and dates as they are', () => {
    const result = withoutContactDetails(listing());
    expect(result.price).toBeInstanceOf(Prisma.Decimal);
    expect(result.price.toString()).toBe('120000.5');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('walks lists and nested answers (search, a publisher page)', () => {
    const result = withoutContactDetails({
      person: { id: 'u1', email: 'a@b.c', phone: '1', listingCount: 2 },
      properties: [listing(), listing()],
    });
    expect(result.person).toEqual({ id: 'u1', listingCount: 2 });
    for (const item of result.properties) {
      expect(item.user).toEqual({ id: 'u1', name: 'Dara' });
    }
  });

  it('leaves the original untouched, so a cached answer keeps them', () => {
    const original = listing();
    withoutContactDetails([original]);
    expect(original.user.email).toBe('dara@example.com');
    expect(original.contactPhone).toBe('012 345 678');
  });

  it('passes through what is not an object', () => {
    expect(withoutContactDetails(null)).toBeNull();
    expect(withoutContactDetails('text')).toBe('text');
  });
});

describe('GuestContactInterceptor', () => {
  const contextFor = (user: { userId: string } | null) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const run = (user: { userId: string } | null) =>
    lastValueFrom(
      new GuestContactInterceptor().intercept(contextFor(user), {
        handle: () => of(listing()),
      }),
    ) as Promise<ReturnType<typeof listing>>;

  it('hides contact details from a guest', async () => {
    const body = await run(null);
    expect(body.user).not.toHaveProperty('phone');
    expect(body).not.toHaveProperty('contactPhone');
  });

  it('shows them to a signed-in user', async () => {
    const body = await run({ userId: 'u2' });
    expect(body.user.phone).toBe('099');
    expect(body.contactPhone).toBe('012 345 678');
  });
});
