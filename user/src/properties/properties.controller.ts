import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  create(@Req() req: any, @Body() createPropertyDto: CreatePropertyDto) {
    const userId = this.getUserId(req);
    return this.propertiesService.create(userId, createPropertyDto);
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.propertiesService.findAll(userId);
  }

  @Get('my/favorites')
  getFavorites(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.propertiesService.getFavorites(userId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    const userId = this.getUserId(req);
    return this.propertiesService.update(userId, id, updatePropertyDto);
  }

  @Patch(':id/pin')
  updatePin(
    @Req() req: any,
    @Param('id') id: string,
    @Body() pinDto: PinDto,
  ) {
    const userId = this.getUserId(req);
    return this.propertiesService.updatePin(userId, id, pinDto);
  }

  @Patch(':id/boundary')
  updateBoundary(
    @Req() req: any,
    @Param('id') id: string,
    @Body() boundaryDto: BoundaryDto,
  ) {
    const userId = this.getUserId(req);
    return this.propertiesService.updateBoundary(userId, id, boundaryDto);
  }

  @Patch(':id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.publish(userId, id);
  }

  @Patch(':id/mark-sold')
  markSold(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.markSold(userId, id);
  }

  @Patch(':id/relist')
  relist(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.relist(userId, id);
  }

  @Post(':id/like')
  like(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.like(userId, id);
  }

  @Delete(':id/like')
  unlike(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.unlike(userId, id);
  }

  @Post(':id/favorite')
  favorite(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.favorite(userId, id);
  }

  @Post(':id/contact')
  contact(@Req() req: any, @Param('id') id: string, @Body() contactDto: CreateContactDto) {
    const userId = req.user?.userId || null;
    return this.propertiesService.contact(id, userId, contactDto);
  }

  @Delete(':id/favorite')
  unfavorite(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.unfavorite(userId, id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.propertiesService.remove(userId, id);
  }
}



