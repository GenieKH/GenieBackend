import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { FirebaseModule } from './firebase/firebase.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SentryErrorsModule } from '@tilomnov/shared/sentry';

@Module({
  imports: [SentryErrorsModule, SupabaseModule, FirebaseModule, AuthModule],
})
export class AppModule {}
