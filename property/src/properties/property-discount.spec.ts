import { BadRequestException } from '@nestjs/common';
import { assertValidDiscount } from './property-discount';

describe('assertValidDiscount', () => {
  const ok = (discount: Parameters<typeof assertValidDiscount>[0]) =>
    expect(() => assertValidDiscount(discount)).not.toThrow();
  const refused = (discount: Parameters<typeof assertValidDiscount>[0]) =>
    expect(() => assertValidDiscount(discount)).toThrow(BadRequestException);

  it('accepts no discount, a sensible percentage and an amount below the price', () => {
    ok({ price: 100000 });
    ok({ price: 100000, discountType: null, discountValue: null });
    ok({ price: 100000, discountType: 'percent', discountValue: 20 });
    ok({ price: 100000, discountType: 'amount', discountValue: 5000 });
  });

  it('refuses half a discount', () => {
    refused({ price: 100000, discountType: 'percent' });
    refused({ price: 100000, discountValue: 20 });
  });

  it('refuses a discount that would make the price zero or less', () => {
    refused({ price: 100000, discountType: 'percent', discountValue: 100 });
    refused({ price: 100000, discountType: 'amount', discountValue: 100000 });
    refused({ price: 100000, discountType: 'amount', discountValue: 0 });
    refused({ price: 100000, discountType: 'percent', discountValue: -5 });
  });
});
