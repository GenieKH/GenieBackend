import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PropertiesController } from './properties.controller';
import { PropertyStatusService } from './property-status.service';
import { PublicPropertiesController } from './public-properties.controller';
import { GuestSessionService } from './services/guest-session.service';
import { PropertyEngagementService } from './services/property-engagement.service';
import { PropertyImageService } from './services/property-image.service';
import { PropertyLifecycleService } from './services/property-lifecycle.service';
import { PropertyQueryService } from './services/property-query.service';
import { PublicPropertyCache } from './services/public-property-cache.service';

@Module({
  imports: [SupabaseModule],
  controllers: [PropertiesController, PublicPropertiesController],
  providers: [
    PropertyStatusService,
    PublicPropertyCache,
    PropertyQueryService,
    PropertyLifecycleService,
    PropertyImageService,
    PropertyEngagementService,
    GuestSessionService,
  ],
  // Other modules (e.g. payments) use properties only through these services.
  exports: [PropertyQueryService, PropertyStatusService, PropertyImageService, PublicPropertyCache],
})
export class PropertiesModule {}
