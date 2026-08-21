import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, UnauthorizedException } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PinDto } from './dto/pin.dto';
import { BoundaryDto } from './dto/boundary.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { ApiTags, ApiHeader } from '@nestjs/swagger';

@ApiTags('properties')
@ApiHeader({ name: 'x-user-id', description: 'User ID from API Gateway' })
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is missing');
    }
    return userId;
  }

  @Post()
  create(@Headers() headers: Record<string, string>, @Body() createPropertyDto: CreatePropertyDto) {
    const userId = this.getUserId(headers);
    return this.propertiesService.create(userId, createPropertyDto);
  }

  @Get()
  findAll(@Headers() headers: Record<string, string>) {
    const userId = this.getUserId(headers);
    return this.propertiesService.findAll(userId);
  }

  @Get('my/favorites')
  getFavorites(@Headers() headers: Record<string, string>) {
    const userId = this.getUserId(headers);
    return this.propertiesService.getFavorites(userId);
  }

  @Get(':id')
  findOne(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    const userId = this.getUserId(headers);
    return this.propertiesService.update(userId, id, updatePropertyDto);
  }

  @Patch(':id/pin')
  updatePin(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() pinDto: PinDto,
  ) {
    const userId = this.getUserId(headers);
    return this.propertiesService.updatePin(userId, id, pinDto);
  }

  @Patch(':id/boundary')
  updateBoundary(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() boundaryDto: BoundaryDto,
  ) {
    const userId = this.getUserId(headers);
    return this.propertiesService.updateBoundary(userId, id, boundaryDto);
  }

  @Patch(':id/publish')
  publish(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.publish(userId, id);
  }

  @Patch(':id/mark-sold')
  markSold(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.markSold(userId, id);
  }

  @Patch(':id/relist')
  relist(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.relist(userId, id);
  }

  @Post(':id/like')
  like(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.like(userId, id);
  }

  @Delete(':id/like')
  unlike(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.unlike(userId, id);
  }

  @Post(':id/favorite')
  favorite(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.favorite(userId, id);
  }

  @Post(':id/contact')
  contact(@Headers() headers: Record<string, string>, @Param('id') id: string, @Body() contactDto: CreateContactDto) {
    const userId = headers['x-user-id'] || null;
    return this.propertiesService.contact(id, userId, contactDto);
  }

  @Delete(':id/favorite')
  unfavorite(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.unfavorite(userId, id);
  }

  @Delete(':id')
  remove(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    const userId = this.getUserId(headers);
    return this.propertiesService.remove(userId, id);
  }
}

