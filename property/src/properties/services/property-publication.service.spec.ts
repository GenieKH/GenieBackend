import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PropertyStatusService } from '../property-status.service';
import { PropertyPublicationService } from './property-publication.service';

const ME = '11111111-1111-4111-8111-111111111111';
const LISTING = '33333333-3333-4333-8333-333333333333';

describe('PropertyPublicationService', () => {
  const propertyTable = { update: jest.fn(), updateMany: jest.fn() };
  const query = { findOwned: jest.fn() };
  const publicCache = { changed: jest.fn() };
  let service: PropertyPublicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    query.findOwned.mockResolvedValue({ id: LISTING, status: 'Draft' });
    propertyTable.updateMany.mockResolvedValue({ count: 1 });
    service = new PropertyPublicationService(
      { property: propertyTable } as never,
      query as never,
      new PropertyStatusService(),
      publicCache as never,
    );
  });

  describe('beginPublish', () => {
    it('parks the listing as Pending and says what it was', async () => {
      const result = await service.beginPublish(ME, LISTING);

      expect(query.findOwned).toHaveBeenCalledWith(ME, LISTING);
      expect(propertyTable.update).toHaveBeenCalledWith({ where: { id: LISTING }, data: { status: 'Pending' } });
      expect(result).toEqual({ previousStatus: 'Draft' });
    });

    it('lets an expired listing be published again', async () => {
      query.findOwned.mockResolvedValue({ id: LISTING, status: 'Expired' });

      await expect(service.beginPublish(ME, LISTING)).resolves.toEqual({ previousStatus: 'Expired' });
    });

    it.each(['Active', 'Pending', 'Sold'])('refuses a listing that is %s', async (status) => {
      query.findOwned.mockResolvedValue({ id: LISTING, status });

      await expect(service.beginPublish(ME, LISTING)).rejects.toThrow(BadRequestException);
      expect(propertyTable.update).not.toHaveBeenCalled();
    });

    it("refuses someone else's listing", async () => {
      query.findOwned.mockRejectedValue(new NotFoundException('Property not found'));

      await expect(service.beginPublish(ME, LISTING)).rejects.toThrow(NotFoundException);
      expect(propertyTable.update).not.toHaveBeenCalled();
    });
  });

  describe('settlePublish', () => {
    it('publishes a Pending listing and refreshes what visitors see', async () => {
      await service.settlePublish(LISTING, 'Active');

      expect(propertyTable.updateMany).toHaveBeenCalledWith({
        where: { id: LISTING, status: 'Pending' },
        data: { status: 'Active' },
      });
      expect(publicCache.changed).toHaveBeenCalledWith(LISTING);
    });

    it('returns an unpaid listing to Draft without touching the public cache', async () => {
      await service.settlePublish(LISTING, 'Draft');

      expect(propertyTable.updateMany).toHaveBeenCalledWith({
        where: { id: LISTING, status: 'Pending' },
        data: { status: 'Draft' },
      });
      expect(publicCache.changed).not.toHaveBeenCalled();
    });

    it('changes only a Pending listing, so a repeated call does nothing', async () => {
      propertyTable.updateMany.mockResolvedValue({ count: 0 });

      await service.settlePublish(LISTING, 'Active');

      expect(publicCache.changed).not.toHaveBeenCalled();
    });
  });

  it('puts a Pending listing back to the status it had', async () => {
    await service.revertPublish(LISTING, 'Expired');

    expect(propertyTable.updateMany).toHaveBeenCalledWith({
      where: { id: LISTING, status: 'Pending' },
      data: { status: 'Expired' },
    });
  });
});
