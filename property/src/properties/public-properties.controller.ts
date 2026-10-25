import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '@genie/shared';
import { GuestSessionDto } from './dto/guest-session.dto';
import { MapPriceHistogramQuery } from './dto/map-price-histogram.query';
import { MapSearchQuery } from './dto/map-search.query';
import { GuestContactInterceptor } from './guest-contact';
import { GuestSessionService } from './services/guest-session.service';
import { PropertyQueryService } from './services/property-query.service';

/**
 * Endpoints anyone can call; a logged-in user just gets extra info
 * (`isVisited`, how to reach the owner).
 */
@ApiTags('public-properties')
@Controller('public/properties')
@UseInterceptors(GuestContactInterceptor)
export class PublicPropertiesController {
  constructor(
    private readonly query: PropertyQueryService,
    private readonly guestSessions: GuestSessionService,
  ) {}

  @Get('map')
  @UseGuards(OptionalJwtAuthGuard)
  searchMap(
    @Req() req: { user?: { userId: string } | null },
    @Query() search: MapSearchQuery,
  ) {
    return this.query.searchMap(
      search.bounds(),
      req.user?.userId,
      search.filter(),
    );
  }

  /** The bars behind the filter's price slider, for the same area and filter. */
  @Get('map/prices')
  mapPrices(@Query() search: MapPriceHistogramQuery) {
    return this.query.priceHistogram(
      search.bounds(),
      search.filter(),
      search.upTo,
    );
  }

  @Post('guest-session')
  registerGuestSession(@Body() dto: GuestSessionDto) {
    return this.guestSessions.register(dto.deviceId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.query.findPublic(id);
  }
}
