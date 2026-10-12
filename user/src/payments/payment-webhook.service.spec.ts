import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PaymentWebhookService } from './payment-webhook.service';

describe('PaymentWebhookService', () => {
  const transactionTable = { findUnique: jest.fn(), updateMany: jest.fn() };
  const propertyTable = { updateMany: jest.fn() };
  const prisma = {
    paymentTransaction: transactionTable,
    property: propertyTable,
    // The transaction callback receives the same tables.
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback({ paymentTransaction: transactionTable, property: propertyTable }),
    ),
  };
  const provider = { verifyWebhook: jest.fn() };
  let service: PaymentWebhookService;

  const pending = { id: 'tx-1', propertyId: 'p-1', status: 'Pending', amount: { equals: (n: number) => n === 50 } };
  const webhook = { transactionId: 'tx-1', status: 'SUCCESS' as const };

  beforeEach(() => {
    jest.clearAllMocks();
    provider.verifyWebhook.mockReturnValue(true);
    transactionTable.findUnique.mockResolvedValue(pending);
    transactionTable.updateMany.mockResolvedValue({ count: 1 });
    propertyTable.updateMany.mockResolvedValue({ count: 1 });
    service = new PaymentWebhookService(prisma as never, provider as never);
  });

  it('rejects an unsigned/forged webhook before touching the database', async () => {
    provider.verifyWebhook.mockReturnValue(false);

    await expect(service.handle(webhook, 'bad')).rejects.toThrow(UnauthorizedException);
    expect(transactionTable.findUnique).not.toHaveBeenCalled();
  });

  it('404s for an unknown transaction', async () => {
    transactionTable.findUnique.mockResolvedValue(null);

    await expect(service.handle(webhook, 'sig')).rejects.toThrow(NotFoundException);
  });

  it('publishes the property when the payment succeeds', async () => {
    const result = await service.handle(webhook, 'sig');

    expect(result).toEqual({ success: true });
    expect(transactionTable.updateMany).toHaveBeenCalledWith({
      where: { id: 'tx-1', status: 'Pending' },
      data: { status: 'Success' },
    });
    expect(propertyTable.updateMany).toHaveBeenCalledWith({
      where: { id: 'p-1', status: 'Pending' },
      data: { status: 'Active' },
    });
  });

  it('returns the property to Draft when the payment fails', async () => {
    const result = await service.handle({ ...webhook, status: 'FAILED' }, 'sig');

    expect(result).toEqual({ success: false });
    expect(propertyTable.updateMany).toHaveBeenCalledWith({
      where: { id: 'p-1', status: 'Pending' },
      data: { status: 'Draft' },
    });
  });

  it('ignores a repeated webhook for an already settled transaction', async () => {
    transactionTable.findUnique.mockResolvedValue({ ...pending, status: 'Success' });

    const result = await service.handle(webhook, 'sig');

    expect(result).toEqual({ success: true, alreadyProcessed: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not let a late FAILED webhook undo a successful payment', async () => {
    transactionTable.findUnique.mockResolvedValue({ ...pending, status: 'Success' });

    const result = await service.handle({ ...webhook, status: 'FAILED' }, 'sig');

    expect(result.success).toBe(true);
    expect(propertyTable.updateMany).not.toHaveBeenCalled();
  });

  it('settles only once when two webhooks arrive at the same time', async () => {
    transactionTable.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.handle(webhook, 'sig');

    expect(result.alreadyProcessed).toBe(true);
    expect(propertyTable.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a webhook whose amount differs from the transaction', async () => {
    await expect(service.handle({ ...webhook, amount: 1 }, 'sig')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
