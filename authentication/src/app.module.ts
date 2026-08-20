import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { PrismaService } from "./prisma.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { SupabaseModule } from "./supabase/supabase.module";
import { AuthModule } from "./auth/auth.module";
import { PropertiesController } from "./properties/properties.controller";
import { FirebaseModule } from "./firebase/firebase.module";

@Module({
  imports: [SupabaseModule, AuthModule, FirebaseModule],
  controllers: [
    AppController,
    UsersController,
    PropertiesController
  ],
  providers: [
    PrismaService,
    UsersService
  ],
})
export class AppModule {}
