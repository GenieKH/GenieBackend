import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PublicPropertiesController } from './public-properties.controller';
import { PrismaService } from '../prisma.service';
import { PropertyStatusService } from './property-status.service';

@Module({
  controllers: [PropertiesController, PublicPropertiesController],
  providers: [PropertiesService, PrismaService, PropertyStatusService],
  exports: [PropertyStatusService]
})
export class PropertiesModule {}
