import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { SearchHistoryController } from './history/search-history.controller';
import { SearchHistoryService } from './history/search-history.service';
import { GooglePlacesProvider } from './places/google-places.provider';
import { PlaceProvider } from './places/place-provider';
import { PeopleSearchService } from './people-search.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * The home screen's search bar. It owns no data: places come from the map
 * provider, listings and the people who post them from the property data.
 */
@Module({
  imports: [PropertiesModule],
  controllers: [SearchController, SearchHistoryController],
  providers: [
    SearchService,
    PeopleSearchService,
    SearchHistoryService,
    { provide: PlaceProvider, useClass: GooglePlacesProvider },
  ],
})
export class SearchModule {}
