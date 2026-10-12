import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppModule } from './app.module';
import { ChatController } from './chat/chat.controller';
import { ChatGateway } from './chat/chat.gateway';
import { ChatModule } from './chat/chat.module';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma.module';
import { PropertiesController } from './properties/properties.controller';
import { PropertiesModule } from './properties/properties.module';
import { PublicPropertiesController } from './properties/public-properties.controller';
import { RedisModule } from './redis/redis.module';
import { UsersController } from './users/users.controller';
import { UsersModule } from './users/users.module';

// Nest only reports a missing provider at boot time, so resolve every feature
// module here. Nothing connects: the DB pool, Redis and Supabase client are lazy.
describe('feature module wiring', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.JWT_PUBLIC_KEY = 'test-public-key';
  });

  it('resolves every controller and the chat gateway', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RedisModule, PrismaModule, PropertiesModule, PaymentsModule, UsersModule, ChatModule],
    }).compile();

    for (const type of [
      PropertiesController,
      PublicPropertiesController,
      PaymentsController,
      UsersController,
      ChatController,
      ChatGateway,
    ]) {
      expect(moduleRef.get(type)).toBeDefined();
    }

    await moduleRef.close();
  });

  // AppModule's own controllers and providers, resolved exactly as declared.
  it('resolves the controllers and providers declared by AppModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RedisModule, PrismaModule, PropertiesModule, PaymentsModule, UsersModule, ChatModule],
      controllers: Reflect.getMetadata('controllers', AppModule),
      providers: Reflect.getMetadata('providers', AppModule),
    }).compile();

    expect(moduleRef.get(AppController)).toBeDefined();

    await moduleRef.close();
  });
});
