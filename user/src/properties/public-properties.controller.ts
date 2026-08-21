import { Controller, Get, Query } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { ApiTags, ApiQuery } from '@nestjs/swagger';

@ApiTags('public-properties')
@Controller('public/properties')
export class PublicPropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get('map')
  @ApiQuery({ name: 'minLat', type: Number })
  @ApiQuery({ name: 'maxLat', type: Number })
  @ApiQuery({ name: 'minLng', type: Number })
  @ApiQuery({ name: 'maxLng', type: Number })
  searchMap(
    @Query('minLat') minLat: string,
    @Query('maxLat') maxLat: string,
    @Query('minLng') minLng: string,
    @Query('maxLng') maxLng: string,
  ) {
    return this.propertiesService.searchMap(
      parseFloat(minLat),
      parseFloat(maxLat),
      parseFloat(minLng),
      parseFloat(maxLng),
    );
  }
}
