import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { boundaryCentroid } from '../boundary-centroid';
import { BoundaryDto } from '../dto/boundary.dto';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { PinDto } from '../dto/pin.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { PROPERTY_WITH_RELATIONS } from '../property-includes';
import { PropertyStatusService } from '../property-status.service';
import { PropertyQueryService } from './property-query.service';

/** Creating, editing and moving a property through its statuses. */
@Injectable()
export class PropertyLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: PropertyQueryService,
    private readonly status: PropertyStatusService,
  ) {}

  create(userId: string, dto: CreatePropertyDto) {
    const { status, ...fields } = dto;
    return this.prisma.property.create({
      data: { ...fields, userId, status: status || 'Draft' },
      include: PROPERTY_WITH_RELATIONS,
    });
  }

  async update(userId: string, id: string, dto: UpdatePropertyDto) {
    await this.query.findOwned(userId, id);
    return this.prisma.property.update({ where: { id }, data: dto });
  }

  async updatePin(userId: string, id: string, pin: PinDto) {
    await this.query.findOwned(userId, id);
    return this.prisma.property.update({ where: { id }, data: { lat: pin.lat, lng: pin.lng } });
  }

  /** Saves the drawn boundary and re-centres the pin on it. */
  async updateBoundary(userId: string, id: string, dto: BoundaryDto) {
    await this.query.findOwned(userId, id);
    const center = boundaryCentroid(dto.boundaryPoints);

    return this.prisma.property.update({
      where: { id },
      data: {
        boundaryPoints: dto.boundaryPoints,
        ...(center && { lat: center.lat, lng: center.lng }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.query.findOwned(userId, id);
    return this.setStatus(id, 'Deleted');
  }

  async unpublish(userId: string, id: string) {
    await this.query.findOwned(userId, id);
    return this.setStatus(id, 'Draft');
  }

  async publish(userId: string, id: string) {
    const property = await this.query.findOwned(userId, id);
    this.status.canPublish(property.status);
    return this.setStatus(id, 'Active');
  }

  async markSold(userId: string, id: string) {
    const property = await this.query.findOwned(userId, id);
    this.status.canMarkSold(property.status);
    return this.setStatus(id, 'Sold');
  }

  async relist(userId: string, id: string) {
    const property = await this.query.findOwned(userId, id);
    this.status.canRelist(property.status);
    return this.setStatus(id, 'Active');
  }

  private setStatus(id: string, status: string) {
    return this.prisma.property.update({ where: { id }, data: { status } });
  }
}
