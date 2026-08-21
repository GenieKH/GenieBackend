import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AbaPaywayProvider } from './aba-payway.provider';
import { PrismaService } from '../prisma.service';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [PropertiesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, AbaPaywayProvider, PrismaService],
})
export class PaymentsModule {}
