import { HttpException, NotFoundException } from '@nestjs/common';
import { PropertyEngagementService } from './property-engagement.service';

function setup(options: { visible?: boolean; allowContact?: boolean } = {}) {
  const { visible = true, allowContact = true } = options;
  const prisma = {
    property: { findFirst: jest.fn().mockResolvedValue(visible ? { id: 'p1' } : null) },
    propertyLike: { upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn() },
    propertyFavorite: { upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn() },
    propertyView: { upsert: jest.fn().mockResolvedValue({}) },
    propertyContact: { create: jest.fn().mockResolvedValue({ id: 'c1' }) },
  };
  const limiter = { consume: allowContact ? jest.fn().mockResolvedValue({}) : jest.fn().mockRejectedValue(new Error('limit')) };
  const rateLimits = { create: jest.fn().mockReturnValue(limiter) };
  const service = new PropertyEngagementService(prisma as never, rateLimits as never);
  return { service, prisma, limiter };
}

describe('PropertyEngagementService', () => {
  it.each([
    ['like', (s: PropertyEngagementService) => s.like('u', 'p1')],
    ['favorite', (s: PropertyEngagementService) => s.favorite('u', 'p1')],
    ['view', (s: PropertyEngagementService) => s.logView('u', 'p1')],
    ['contact', (s: PropertyEngagementService) => s.contact('u', 'p1', { name: 'n', message: 'm' })],
  ])('%s of a listing that is not published is 404 and writes nothing', async (_name, act) => {
    const { service, prisma } = setup({ visible: false });
    await expect(act(service)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.propertyLike.upsert).not.toHaveBeenCalled();
    expect(prisma.propertyFavorite.upsert).not.toHaveBeenCalled();
    expect(prisma.propertyView.upsert).not.toHaveBeenCalled();
    expect(prisma.propertyContact.create).not.toHaveBeenCalled();
  });

  it('only looks for published listings', async () => {
    const { service, prisma } = setup();
    await service.like('u', 'p1');
    expect(prisma.property.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'p1', status: 'Active' });
  });

  it('stores a contact message', async () => {
    const { service, prisma, limiter } = setup();
    await service.contact('u', 'p1', { name: 'n', message: 'm' });
    expect(limiter.consume).toHaveBeenCalledWith('u');
    expect(prisma.propertyContact.create).toHaveBeenCalledWith({ data: { name: 'n', message: 'm', propertyId: 'p1', userId: 'u' } });
  });

  it('answers 429 and stores nothing once the contact limit is used up', async () => {
    const { service, prisma } = setup({ allowContact: false });
    const error = await service.contact('u', 'p1', { name: 'n', message: 'm' }).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(prisma.propertyContact.create).not.toHaveBeenCalled();
  });

  it('lets a user undo a like or favorite of a listing that is no longer published', async () => {
    const { service, prisma } = setup({ visible: false });
    await service.unlike('u', 'p1');
    await service.unfavorite('u', 'p1');
    expect(prisma.propertyLike.deleteMany).toHaveBeenCalled();
    expect(prisma.propertyFavorite.deleteMany).toHaveBeenCalled();
  });
});
