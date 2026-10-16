import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { UsersModule } from '../users/users.module';
import { SearchHistoryController } from './history/search-history.controller';
import { SearchHistoryService } from './history/search-history.service';
import { GooglePlacesProvider } from './places/google-places.provider';
import { PlaceProvider } from './places/place-provider';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * The home screen's search bar. It owns no data: places come from the map
 * provider, listings from properties, people from users.
 */
@Module({
  imports: [PropertiesModule, UsersModule],
  controllers: [SearchController, SearchHistoryController],
  providers: [
    SearchService,
    SearchHistoryService,
    { provide: PlaceProvider, useClass: GooglePlacesProvider },
  ],
})
export class SearchModule {}
