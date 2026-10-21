import { ListingChanges } from './listing-changes.service';

const LISTING = { id: 'p-1', userId: 'u-1', lat: 11.5, lng: 104.9 };

describe('ListingChanges', () => {
  let publicCache: { changed: jest.Mock };
  let changes: ListingChanges;

  beforeEach(() => {
    publicCache = { changed: jest.fn().mockResolvedValue(undefined) };
    changes = new ListingChanges(publicCache as never);
  });

  it('outdates the public copies, naming where a moved listing was', async () => {
    const before = { lat: 10, lng: 104 };

    await changes.changed(LISTING, before);

    expect(publicCache.changed).toHaveBeenCalledWith(LISTING, before);
  });

  it('tells every listener', async () => {
    const first = { listingChanged: jest.fn().mockResolvedValue(undefined) };
    const second = { listingChanged: jest.fn().mockResolvedValue(undefined) };
    changes.listen(first);
    changes.listen(second);

    await changes.changed(LISTING);

    expect(first.listingChanged).toHaveBeenCalledWith(LISTING);
    expect(second.listingChanged).toHaveBeenCalledWith(LISTING);
  });

  it('never fails the change when a listener does', async () => {
    const other = { listingChanged: jest.fn().mockResolvedValue(undefined) };
    changes.listen({
      listingChanged: jest.fn().mockRejectedValue(new Error('search is down')),
    });
    changes.listen(other);

    await expect(changes.changed(LISTING)).resolves.toBeUndefined();
    expect(other.listingChanged).toHaveBeenCalled();
  });
});
