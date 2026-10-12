import { Injectable } from '@nestjs/common';
import { JsonCache } from '../../redis/json-cache.service';

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Entries expire quickly on their own; `changed` removes them at once. */
const MAP_TTL_SECONDS = 30;
const DETAIL_TTL_SECONDS = 60;

/** About 1 km. Viewports are widened to this grid so nearby map positions share an entry. */
const GRID_DEGREES = 0.01;

const VERSION_KEY = 'properties:public:version';

/** The smallest box on the grid that contains `bounds`. */
export function widenToGrid(bounds: MapBounds): MapBounds {
  const down = (value: number) => Math.floor(value / GRID_DEGREES) / (1 / GRID_DEGREES);
  const up = (value: number) => Math.ceil(value / GRID_DEGREES) / (1 / GRID_DEGREES);
  return {
    minLat: down(bounds.minLat),
    maxLat: up(bounds.maxLat),
    minLng: down(bounds.minLng),
    maxLng: up(bounds.maxLng),
  };
}

/**
 * Caches what every visitor sees the same way: the map search and a listing's
 * public page. Nothing personal is stored here.
 */
@Injectable()
export class PublicPropertyCache {
  constructor(private readonly cache: JsonCache) {}

  /** Map results for a box already widened with `widenToGrid`. */
  async map<T>(box: MapBounds, load: () => Promise<T>): Promise<T> {
    // The version is part of the key, so one `changed` call outdates every box at once.
    const version = (await this.cache.get<number>(VERSION_KEY)) ?? 0;
    const key = `properties:map:v${version}:${box.minLat}:${box.maxLat}:${box.minLng}:${box.maxLng}`;
    return this.cache.remember(key, MAP_TTL_SECONDS, load);
  }

  detail<T>(propertyId: string, load: () => Promise<T>): Promise<T> {
    return this.cache.remember(this.detailKey(propertyId), DETAIL_TTL_SECONDS, load);
  }

  /**
   * Call after anything that changes what the public sees of a listing (new,
   * edited, published, hidden, sold, photos added): the next reader gets fresh
   * data instead of waiting for the expiry.
   */
  async changed(propertyId: string): Promise<void> {
    await Promise.all([this.cache.delete(this.detailKey(propertyId)), this.cache.increment(VERSION_KEY)]);
  }

  private detailKey(propertyId: string): string {
    return `properties:public:${propertyId}`;
  }
}
