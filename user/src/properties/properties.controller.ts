import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { BoundaryDto } from './dto/boundary.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { ImageFileNamesDto } from './dto/image-file-names.dto';
import { PinDto } from './dto/pin.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyEngagementService } from './services/property-engagement.service';
import { PropertyImageService } from './services/property-image.service';
import { PropertyLifecycleService } from './services/property-lifecycle.service';
import { PropertyQueryService } from './services/property-query.service';

/** Authenticated property endpoints (the gateway has already verified the JWT). */
@ApiTags('properties')
@ApiHeader({ name: 'x-user-id', description: 'User ID from API Gateway' })
@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly query: PropertyQueryService,
    private readonly lifecycle: PropertyLifecycleService,
    private readonly images: PropertyImageService,
    private readonly engagement: PropertyEngagementService,
  ) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreatePropertyDto) {
    return this.lifecycle.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.query.findAllForOwner(userId);
  }

  @Get('my/favorites')
  getFavorites(@CurrentUserId() userId: string) {
    return this.query.listFavorites(userId);
  }

  @Get(':id')
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.query.findOwned(userId, id);
  }

  @Patch(':id')
  update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.lifecycle.update(userId, id, dto);
  }

  @Patch(':id/pin')
  updatePin(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: PinDto) {
    return this.lifecycle.updatePin(userId, id, dto);
  }

  @Patch(':id/boundary')
  updateBoundary(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: BoundaryDto) {
    return this.lifecycle.updateBoundary(userId, id, dto);
  }

  @Patch(':id/publish')
  publish(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.lifecycle.publish(userId, id);
  }

  @Patch(':id/unpublish')
  unpublish(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.lifecycle.unpublish(userId, id);
  }

  @Patch(':id/mark-sold')
  markSold(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.lifecycle.markSold(userId, id);
  }

  @Patch(':id/relist')
  relist(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.lifecycle.relist(userId, id);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.lifecycle.remove(userId, id);
  }

  @Post(':id/images/presigned-url')
  getPresignedUrls(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ImageFileNamesDto) {
    return this.images.createUploadUrls(userId, id, dto.fileNames);
  }

  @Post(':id/images/confirm')
  confirmUploadedImages(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ImageFileNamesDto) {
    return this.images.confirmUploads(userId, id, dto.fileNames);
  }

  @Post(':id/like')
  like(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.engagement.like(userId, id);
  }

  @Delete(':id/like')
  unlike(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.engagement.unlike(userId, id);
  }

  @Post(':id/favorite')
  favorite(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.engagement.favorite(userId, id);
  }

  @Delete(':id/favorite')
  unfavorite(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.engagement.unfavorite(userId, id);
  }

  @Post(':id/view')
  logView(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.engagement.logView(userId, id);
  }

  @Post(':id/contact')
  contact(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: CreateContactDto) {
    return this.engagement.contact(userId, id, dto);
  }
}
