import { Test } from '@nestjs/testing';
import { HealthController } from '@genie/shared';
import { AppModule } from './app.module';
import { ChatController } from './chat/chat.controller';
import { ChatGateway } from './chat/chat.gateway';
import { InternalAccountsController } from './chat/internal-accounts.controller';

// Nest only reports a missing provider at boot time, so resolve the whole
// service here. Nothing connects: the DB pool, Redis and Supabase client are lazy.
describe('chat service wiring', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.JWT_PUBLIC_KEY = 'test-public-key';
  });

  it('resolves every controller and the chat gateway', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    for (const type of [
      ChatController,
      InternalAccountsController,
      ChatGateway,
      HealthController,
    ]) {
      expect(moduleRef.get(type)).toBeDefined();
    }

    await moduleRef.close();
  });
});
