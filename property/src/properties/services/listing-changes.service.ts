import { Injectable, Logger } from '@nestjs/common';
import { CachedListing, Position, PublicPropertyCache } from './public-property-cache.service';

/** Told about every change to what the public can see of a listing. */
export interface ListingChangeListener {
  listingChanged(listing: CachedListing): Promise<void>;
}

/**
 * The one path a change to what the public sees of a listing takes (new,
 * edited, moved, published, hidden, sold, deleted, photos, its owner hidden
 * or renamed): the cached public copies are outdated, then every listener
 * (the search index) is told. Modules that need to know listen here, so this
 * module depends on none of them.
 */
@Injectable()
export class ListingChanges {
  private readonly logger = new Logger(ListingChanges.name);
  private readonly listeners: ListingChangeListener[] = [];

  constructor(private readonly publicCache: PublicPropertyCache) {}

  listen(listener: ListingChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * A listener that fails is logged, never thrown: the change itself is
   * saved, and whatever the listener keeps is repaired on its own schedule.
   */
  async changed(listing: CachedListing, movedFrom?: Position): Promise<void> {
    await this.publicCache.changed(listing, movedFrom);
    await Promise.all(
      this.listeners.map((listener) =>
        listener.listingChanged(listing).catch((error: Error) => {
          this.logger.error(`A listener missed the change to listing ${listing.id}: ${error.message}`);
        }),
      ),
    );
  }
}
