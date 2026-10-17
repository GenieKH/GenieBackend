import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { boundaryCentroid } from '../boundary-centroid';
import { BoundaryDto } from '../dto/boundary.dto';
import { PropertyNearbyService } from '../nearby/property-nearby.service';
import { assertValidDiscount } from '../property-discount';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { PinDto } from '../dto/pin.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { PROPERTY_WITH_RELATIONS } from '../property-includes';
import { toCreateData, toUpdateData } from '../property-write-data';
import { PropertyStatusService } from '../property-status.service';
import { PropertyQueryService } from './property-query.service';
import { PublicPropertyCache } from './public-property-cache.service';

/** The keyword codes of a property read with PROPERTY_WITH_RELATIONS. */
const keywordCodes = (property: { keywords?: { keyword: string }[] }) =>
  (property.keywords ?? []).map((k) => k.keyword);

/** The only status the public can see. */
const PUBLIC_STATUS = 'Active';

/** Creating, editing and moving a property through its statuses. */
@Injectable()
export class PropertyLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: PropertyQueryService,
    private readonly status: PropertyStatusService,
    private readonly publicCache: PublicPropertyCache,
    private readonly nearby: PropertyNearbyService,
  ) {}

  async create(userId: string, dto: CreatePropertyDto) {
    assertValidDiscount(dto);
    const property = await this.prisma.property.create({
      data: toCreateData(userId, dto),
      include: PROPERTY_WITH_RELATIONS,
    });
    await this.refreshPublicView(property.id, property.status);
    return property;
  }

  async update(userId: string, id: string, dto: UpdatePropertyDto) {
    const before = await this.query.findOwned(userId, id);
    // The discount must still fit the price after the edit, whichever changed.
    assertValidDiscount({
      price: dto.price ?? Number(before.price),
      discountType: dto.discountType !== undefined ? dto.discountType : before.discountType,
      discountValue:
        dto.discountValue !== undefined
          ? dto.discountValue
          : before.discountValue == null
            ? null
            : Number(before.discountValue),
    });
    const property = await this.prisma.property.update({
      where: { id },
      data: toUpdateData(dto, before.propertyType),
      include: PROPERTY_WITH_RELATIONS,
    });
    await this.refreshPublicView(id, before.status);
    if (dto.keywords) {
      this.nearby.keywordsChanged(id, keywordCodes(before), dto.keywords);
    }
    return property;
  }

  async updatePin(userId: string, id: string, pin: PinDto) {
    const { status } = await this.query.findOwned(userId, id);
    const property = await this.prisma.property.update({ where: { id }, data: { lat: pin.lat, lng: pin.lng } });
    await this.refreshPublicView(id, status);
    this.nearby.locationChanged(id);
    return property;
  }

  /** Saves the drawn boundary and re-centres the pin on it. */
  async updateBoundary(userId: string, id: string, dto: BoundaryDto) {
    const { status } = await this.query.findOwned(userId, id);
    const center = boundaryCentroid(dto.boundaryPoints);

    const property = await this.prisma.property.update({
      where: { id },
      data: {
        boundaryPoints: dto.boundaryPoints,
        ...(center && { lat: center.lat, lng: center.lng }),
      },
    });
    await this.refreshPublicView(id, status);
    if (center) this.nearby.locationChanged(id);
    return property;
  }

  async remove(userId: string, id: string) {
    const property = await this.query.findOwned(userId, id);
    return this.setStatus(id, property.status, 'Deleted');
  }

  async unpublish(userId: string, id: string) {
    const property = await this.query.findOwned(userId, id);
    return this.setStatus(id, property.status, 'Draft');
  }

  async publish(userId: string, id: string) {
    const property = await this.query.findOwned(userId, id);
    this.status.canPublish(property.status);
    return this.setStatus(id, property.status, 'Active');
  }

  async markSold(userId: string, id: string) {
    const property = await this.query.findOwned(userId, id);
    this.status.canMarkSold(property.status);
    return this.setStatus(id, property.status, 'Sold');
  }

  async relist(userId: string, id: string) {
    const property = await this.query.findOwned(userId, id);
    this.status.canRelist(property.status);
    return this.setStatus(id, property.status, 'Active');
  }

  private async setStatus(id: string, from: string, to: string) {
    const property = await this.prisma.property.update({ where: { id }, data: { status: to } });
    await this.refreshPublicView(id, from, to);
    return property;
  }

  /**
   * Drops the cached public copies when the public could see this listing
   * before or can see it now. Work on a draft changes nothing anyone else sees.
   */
  private async refreshPublicView(id: string, ...statuses: string[]) {
    if (statuses.includes(PUBLIC_STATUS)) {
      await this.publicCache.changed(id);
    }
  }
}
