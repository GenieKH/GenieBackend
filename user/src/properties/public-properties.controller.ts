import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { GuestSessionDto } from './dto/guest-session.dto';
import { MapSearchQuery } from './dto/map-search.query';
import { GuestSessionService } from './services/guest-session.service';
import { PropertyQueryService } from './services/property-query.service';

/** Endpoints anyone can call; a logged-in user just gets extra info (`isVisited`). */
@ApiTags('public-properties')
@Controller('public/properties')
export class PublicPropertiesController {
  constructor(
    private readonly query: PropertyQueryService,
    private readonly guestSessions: GuestSessionService,
  ) {}

  @Get('map')
  @UseGuards(OptionalJwtAuthGuard)
  searchMap(@Req() req: { user?: { userId: string } | null }, @Query() search: MapSearchQuery) {
    const { propertyType, listingType, ...bounds } = search;
    return this.query.searchMap(bounds, req.user?.userId, { propertyType, listingType });
  }

  @Post('guest-session')
  registerGuestSession(@Body() dto: GuestSessionDto) {
    return this.guestSessions.register(dto.deviceId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.query.findPublic(id);
  }
}
