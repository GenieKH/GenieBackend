import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** One shared database client (and connection pool) for the whole service. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
