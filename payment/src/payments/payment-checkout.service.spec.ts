import { BadRequestException } from '@nestjs/common';
import { PaymentCheckoutService } from './payment-checkout.service';

const ME = '11111111-1111-4111-8111-111111111111';
const LISTING = '33333333-3333-4333-8333-333333333333';

describe('PaymentCheckoutService', () => {
  const transactionTable = { create: jest.fn() };
  const prisma = { paymentTransaction: transactionTable };
  const provider = { initiateCheckout: jest.fn() };
  const property = { begin: jest.fn(), revert: jest.fn() };
  let service: PaymentCheckoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    property.begin.mockResolvedValue({ previousStatus: 'Draft' });
    property.revert.mockResolvedValue(undefined);
    transactionTable.create.mockResolvedValue({ id: 'tx-1' });
    provider.initiateCheckout.mockResolvedValue('https://pay.test/checkout');
    service = new PaymentCheckoutService(
      prisma as never,
      provider as never,
      property as never,
    );
  });

  it('records a Pending transaction and returns where to pay', async () => {
    const result = await service.initiate(ME, LISTING);

    expect(property.begin).toHaveBeenCalledWith(ME, LISTING);
    expect(transactionTable.create).toHaveBeenCalledWith({
      data: {
        userId: ME,
        propertyId: LISTING,
        provider: 'ABA_PAYWAY',
        amount: 50,
        status: 'Pending',
      },
    });
    expect(provider.initiateCheckout).toHaveBeenCalledWith('tx-1', 50);
    expect(result).toEqual({
      checkoutUrl: 'https://pay.test/checkout',
      transactionId: 'tx-1',
    });
  });

  it('starts no payment when the property service refuses (not the owner, wrong status)', async () => {
    property.begin.mockRejectedValue(
      new BadRequestException('Cannot publish a property with status Active'),
    );

    await expect(service.initiate(ME, LISTING)).rejects.toThrow(
      'Cannot publish',
    );
    expect(transactionTable.create).not.toHaveBeenCalled();
    expect(provider.initiateCheckout).not.toHaveBeenCalled();
  });

  it('gives the listing back its status when the transaction cannot be saved', async () => {
    property.begin.mockResolvedValue({ previousStatus: 'Expired' });
    transactionTable.create.mockRejectedValue(new Error('db down'));

    await expect(service.initiate(ME, LISTING)).rejects.toThrow('db down');

    expect(property.revert).toHaveBeenCalledWith(LISTING, 'Expired');
    expect(provider.initiateCheckout).not.toHaveBeenCalled();
  });

  it('still reports the original failure when the listing cannot be given back', async () => {
    transactionTable.create.mockRejectedValue(new Error('db down'));
    property.revert.mockRejectedValue(new Error('property down'));

    await expect(service.initiate(ME, LISTING)).rejects.toThrow('db down');
  });
});
