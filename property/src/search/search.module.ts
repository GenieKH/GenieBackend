import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { SearchHistoryController } from './history/search-history.controller';
import { SearchHistoryService } from './history/search-history.service';
import { MeilisearchEngine } from './index/meilisearch.engine';
import { SearchEngine } from './index/search-engine';
import { SearchIndexSync } from './index/search-index-sync.service';
import { SearchReindexSchedule } from './index/search-reindex.schedule';
import { GooglePlacesProvider } from './places/google-places.provider';
import { PlaceProvider } from './places/place-provider';
import { PeopleSearchService } from './people-search.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TextSearchService } from './text-search.service';

/**
 * The home screen's search bar. It owns no data: places come from the map
 * provider, listings and the people who post them from the property data,
 * ranked by the search engine (kept in step with every listing change) when
 * one is configured.
 */
@Module({
  imports: [PropertiesModule],
  controllers: [SearchController, SearchHistoryController],
  providers: [
    SearchService,
    PeopleSearchService,
    SearchHistoryService,
    TextSearchService,
    SearchIndexSync,
    SearchReindexSchedule,
    { provide: PlaceProvider, useClass: GooglePlacesProvider },
    { provide: SearchEngine, useFactory: () => MeilisearchEngine.fromEnvironment() },
  ],
})
export class SearchModule {}
