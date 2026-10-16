import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { PropertiesModule } from '../properties/properties.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AccountContentService } from './account-content.service';
import { AvatarService } from './avatar.service';
import { PeopleSearchService } from './people-search.service';
import { InternalAccountsController } from './internal-accounts.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * The profile, the profile picture, and what happens to an account's content
 * when it is hidden or erased. For that last part it reaches into the
 * features that hold content (listings, chat); they know nothing of this module.
 */
@Module({
  imports: [SupabaseModule, PropertiesModule, ChatModule],
  controllers: [UsersController, InternalAccountsController],
  providers: [
    UsersService,
    AvatarService,
    AccountContentService,
    PeopleSearchService,
  ],
  // Search finds the people who post listings through this.
  exports: [PeopleSearchService],
})
export class UsersModule {}
