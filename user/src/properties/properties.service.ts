import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PinDto } from './dto/pin.dto';
import { BoundaryDto } from './dto/boundary.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { PrismaService } from '../prisma.service';
import { PropertyStatusService } from './property-status.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: PropertyStatusService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async create(userId: string, createPropertyDto: CreatePropertyDto) {
    const { status, ...rest } = createPropertyDto;
    return this.prisma.property.create({
      data: {
        ...rest,
        userId,
        status: status || 'Draft',
      },
      include: { images: { orderBy: { order: 'asc' } } },
    });
  }

  async findAll(userId: string) {
    return this.prisma.property.findMany({
      where: {
        userId,
        status: { not: 'Deleted' },
      },
      include: { images: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, userId, status: { not: 'Deleted' } },
      include: { images: { orderBy: { order: 'asc' } } },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    return property;
  }

  async findOnePublic(id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, status: 'Active' },
      include: {
        images: { orderBy: { order: 'asc' } },
        user: {
          select: {
            username: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    if (!property) {
      throw new NotFoundException('Property not found or not active');
    }
    return property;
  }

  async uploadImages(userId: string, id: string, files: Express.Multer.File[]) {
    const property = await this.findOne(userId, id);

    let maxOrder = 0;
    if (property.images && property.images.length > 0) {
      maxOrder = Math.max(...property.images.map((img) => img.order));
    }

    const uploadPromises = files.map(async (file, index) => {
      const url = await this.supabaseService.uploadFile(file);
      return this.prisma.propertyImage.create({
        data: {
          propertyId: id,
          url,
          order: maxOrder + index + 1,
        },
      });
    });

    await Promise.all(uploadPromises);
    return this.findOne(userId, id);
  }

  async update(userId: string, id: string, updatePropertyDto: UpdatePropertyDto) {
    await this.findOne(userId, id);
    return this.prisma.property.update({
      where: { id },
      data: updatePropertyDto,
    });
  }

  async updatePin(userId: string, id: string, pinDto: PinDto) {
    await this.findOne(userId, id);
    return this.prisma.property.update({
      where: { id },
      data: { lat: pinDto.lat, lng: pinDto.lng },
    });
  }

  async updateBoundary(userId: string, id: string, boundaryDto: BoundaryDto) {
    await this.findOne(userId, id);
    let lat: number | undefined;
    let lng: number | undefined;
    
    const points = boundaryDto.boundaryPoints;
    if (Array.isArray(points) && points.length > 0) {
      const sumLat = points.reduce((sum: number, p: any) => sum + (p.lat || 0), 0);
      const sumLng = points.reduce((sum: number, p: any) => sum + (p.lng || 0), 0);
      lat = sumLat / points.length;
      lng = sumLng / points.length;
    }

    return this.prisma.property.update({
      where: { id },
      data: { 
        boundaryPoints: boundaryDto.boundaryPoints,
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.property.update({
      where: { id },
      data: { status: 'Deleted' },
    });
  }

  async searchMap(minLat: number, maxLat: number, minLng: number, maxLng: number, userId?: string) {
    const properties = await this.prisma.property.findMany({
      where: {
        status: 'Active',
        lat: { gte: minLat, lte: maxLat },
        lng: { gte: minLng, lte: maxLng },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        lat: true,
        lng: true,
        propertyType: true,
        boundaryPoints: true,
        createdAt: true,
        status: true,
        bedrooms: true,
        bathrooms: true,
        landSize: true,
        buildingSize: true,
        unitSize: true,
        images: { orderBy: { order: 'asc' } },
        user: { select: { username: true } },
        _count: { select: { favorites: true, contacts: true } },
        views: userId ? {
          where: { userId }
        } : false,
      },
    });

    return properties.map(p => {
      const isVisited = p.views ? p.views.length > 0 : false;
      const { views, ...rest } = p;
      return { ...rest, isVisited };
    });
  }

  async logView(userId: string, propertyId: string) {
    await this.prisma.propertyView.upsert({
      where: {
        userId_propertyId: {
          userId,
          propertyId,
        }
      },
      update: {},
      create: {
        userId,
        propertyId,
      }
    });
    return { success: true };
  }

  async unpublish(userId: string, id: string) {
    const property = await this.findOne(userId, id);
    return this.prisma.property.update({
      where: { id },
      data: { status: 'Draft' },
    });
  }

  async publish(userId: string, id: string) {
    const property = await this.findOne(userId, id);
    this.statusService.canPublish(property.status);
    return this.prisma.property.update({
      where: { id },
      data: { status: 'Active' },
    });
  }

  async markSold(userId: string, id: string) {
    const property = await this.findOne(userId, id);
    this.statusService.canMarkSold(property.status);
    return this.prisma.property.update({
      where: { id },
      data: { status: 'Sold' },
    });
  }

  async relist(userId: string, id: string) {
    const property = await this.findOne(userId, id);
    this.statusService.canRelist(property.status);
    return this.prisma.property.update({
      where: { id },
      data: { status: 'Active' },
    });
  }

  async like(userId: string, propertyId: string) {
    return this.prisma.propertyLike.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {},
    });
  }

  async unlike(userId: string, propertyId: string) {
    return this.prisma.propertyLike.delete({
      where: { userId_propertyId: { userId, propertyId } },
    }).catch(() => null);
  }

  async favorite(userId: string, propertyId: string) {
    return this.prisma.propertyFavorite.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {},
    });
  }

  async unfavorite(userId: string, propertyId: string) {
    return this.prisma.propertyFavorite.delete({
      where: { userId_propertyId: { userId, propertyId } },
    }).catch(() => null);
  }

  async contact(propertyId: string, userId: string | null, contactDto: CreateContactDto) {
    return this.prisma.propertyContact.create({
      data: {
        ...contactDto,
        propertyId,
        userId,
      }
    });
  }

  async getFavorites(userId: string) {
    const favorites = await this.prisma.propertyFavorite.findMany({
      where: { userId },
      include: {
        property: {
          include: {
            images: { orderBy: { order: 'asc' } },
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((f) => f.property);
  }

  async registerGuestSession(deviceId: string) {
    if (!deviceId) return { success: false };
    
    // Attempt to upsert
    try {
      const session = await this.prisma.guestSession.upsert({
        where: { deviceId },
        update: { lastSeen: new Date() },
        create: { deviceId },
      });
      return { success: true, sessionId: session.id };
    } catch (e) {
      console.error('Error registering guest session', e);
      return { success: false };
    }
  }

}
