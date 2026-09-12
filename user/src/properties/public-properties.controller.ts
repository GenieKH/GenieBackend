import { Controller, Get, Query, Post, Body, Param, UseGuards, Req, UseInterceptors } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PropertiesService } from './properties.service';
import { ApiTags, ApiQuery } from '@nestjs/swagger';

@ApiTags('public-properties')
@Controller('public/properties')
export class PublicPropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get('map')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiQuery({ name: 'minLat', type: Number })
  @ApiQuery({ name: 'maxLat', type: Number })
  @ApiQuery({ name: 'minLng', type: Number })
  @ApiQuery({ name: 'maxLng', type: Number })
  searchMap(
    @Req() req: any,
    @Query('minLat') minLat: string,
    @Query('maxLat') maxLat: string,
    @Query('minLng') minLng: string,
    @Query('maxLng') maxLng: string,
  ) {
    const userId = req.user?.userId;
    return this.propertiesService.searchMap(
      parseFloat(minLat),
      parseFloat(maxLat),
      parseFloat(minLng),
      parseFloat(maxLng),
      userId
    );
  }

  @Post('guest-session')
  async registerGuestSession(@Body('deviceId') deviceId: string) {
    return this.propertiesService.registerGuestSession(deviceId);
  }

  @Get(':id')
  findOne(@Query('id') queryId: string, @Param('id') paramId: string) {
    // Some routers pass id in param, some might pass in query based on setup, but @Param is standard
    const id = paramId || queryId;
    return this.propertiesService.findOnePublic(id);
  }
}
