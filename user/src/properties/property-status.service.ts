import { Injectable, BadRequestException } from '@nestjs/common';

export type PropertyStatus = 'Draft' | 'Pending' | 'Published' | 'Expired' | 'Sold' | 'Deleted';

@Injectable()
export class PropertyStatusService {
  canPublish(currentStatus: string): boolean {
    if (currentStatus !== 'Draft' && currentStatus !== 'Expired') {
      throw new BadRequestException(`Cannot publish a property with status ${currentStatus}`);
    }
    return true;
  }

  canMarkSold(currentStatus: string): boolean {
    if (currentStatus !== 'Published') {
      throw new BadRequestException(`Only 'Published' properties can be marked as Sold. Current status: ${currentStatus}`);
    }
    return true;
  }

  canRelist(currentStatus: string): boolean {
    if (currentStatus !== 'Sold' && currentStatus !== 'Expired') {
      throw new BadRequestException(`Only 'Sold' or 'Expired' properties can be relisted. Current status: ${currentStatus}`);
    }
    return true;
  }
}
