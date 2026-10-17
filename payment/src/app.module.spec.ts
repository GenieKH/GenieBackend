import { Test } from '@nestjs/testing';
import { HealthController } from '@genie/shared';
import { AppModule } from './app.module';
import { PaymentsController } from './payments/payments.controller';

// Nest only reports a missing provider at boot time, so resolve the whole
// service here. Nothing connects: the DB pool is lazy.
describe('payment service wiring', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_PUBLIC_KEY = 'test-public-key';
  });

  it('resolves every controller', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    for (const type of [PaymentsController, HealthController]) {
      expect(moduleRef.get(type)).toBeDefined();
    }

    await moduleRef.close();
  });
});
