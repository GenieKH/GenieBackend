import { Module } from '@nestjs/common';
import { SupabaseModule } from '@genie/shared';
import { InternalAccountsController } from './internal/internal-accounts.controller';
import { InternalPublicationController } from './internal/internal-publication.controller';
import { GoogleNearbyPlaceProvider, GoogleRouteDistanceProvider } from './nearby/google-nearby.providers';
import { NearbyPlaceProvider, RouteDistanceProvider } from './nearby/nearby-providers';
import { PropertyNearbyService } from './nearby/property-nearby.service';
import { PropertiesController } from './properties.controller';
import { PropertyStatusService } from './property-status.service';
import { PublicPropertiesController } from './public-properties.controller';
import { FavoriteListingsService } from './services/favorite-listings.service';
import { GuestSessionService } from './services/guest-session.service';
import { OwnerListingsService } from './services/owner-listings.service';
import { PropertyEngagementCounts } from './services/property-engagement-counts.service';
import { PropertyEngagementService } from './services/property-engagement.service';
import { PropertyImageService } from './services/property-image.service';
import { PropertyLifecycleService } from './services/property-lifecycle.service';
import { PropertyPublicationService } from './services/property-publication.service';
import { PropertyQueryService } from './services/property-query.service';
import { PropertySearchService } from './services/property-search.service';
import { PublicPropertyCache } from './services/public-property-cache.service';
import { PropertyPhotoStorage } from './storage/property-photo-storage';

@Module({
  imports: [SupabaseModule],
  controllers: [PropertiesController, PublicPropertiesController, InternalPublicationController, InternalAccountsController],
  providers: [
    PropertyStatusService,
    PublicPropertyCache,
    PropertyEngagementCounts,
    PropertyQueryService,
    FavoriteListingsService,
    OwnerListingsService,
    PropertySearchService,
    PropertyLifecycleService,
    PropertyPublicationService,
    PropertyPhotoStorage,
    PropertyImageService,
    PropertyEngagementService,
    GuestSessionService,
    PropertyNearbyService,
    { provide: NearbyPlaceProvider, useClass: GoogleNearbyPlaceProvider },
    { provide: RouteDistanceProvider, useClass: GoogleRouteDistanceProvider },
  ],
  // Search reads listings through these services.
  exports: [
    PropertyQueryService,
    PropertySearchService,
  ],
})
export class PropertiesModule {}
