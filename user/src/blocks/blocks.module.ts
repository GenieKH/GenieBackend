import { Module } from '@nestjs/common';
import {
  BlockedAccountsController,
  BlocksController,
} from './blocks.controller';
import { BlocksService } from './blocks.service';
import { InternalBlocksController } from './internal-blocks.controller';

/** Who blocked whom: what stops two people following, messaging and calling each other. */
@Module({
  controllers: [
    BlockedAccountsController,
    BlocksController,
    InternalBlocksController,
  ],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
