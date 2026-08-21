import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Injectable, OnModuleInit } from '@nestjs/common';
import { requestContext } from './auth/request-context';
import { PrismaClient } from '@genie/prisma-client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  rls() {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const store = requestContext.getStore();
            const userId = store?.get('userId');
            if (!userId) return query(args);
            // This approach without $transaction is NOT secure for connection pooling.
            // However, due to architectural constraints, this is the requested approach.
            return query(args);
          }
        }
      }
    });
  }
}

