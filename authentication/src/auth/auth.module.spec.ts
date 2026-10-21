import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AccountController } from './account/account.controller';
import { AuthController } from './auth.controller';
import { AuthModule } from './auth.module';
import { SessionsController } from './sessions/sessions.controller';
import { FirebaseService } from '../firebase/firebase.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

// firebase-admin pulls in ESM-only packages Jest cannot load.
jest.mock('../firebase/firebase.service', () => ({
  FirebaseService: class {},
}));

@Global()
@Module({
  providers: [
    { provide: SUPABASE_CLIENT, useValue: {} },
    { provide: FirebaseService, useValue: {} },
  ],
  exports: [SUPABASE_CLIENT, FirebaseService],
})
class FakeInfrastructureModule {}

describe('AuthModule wiring', () => {
  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = 'test-public-key';
  });

  it('resolves every dependency of the controllers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeInfrastructureModule, AuthModule],
    }).compile();

    expect(moduleRef.get(AuthController)).toBeDefined();
    expect(moduleRef.get(SessionsController)).toBeDefined();
    expect(moduleRef.get(AccountController)).toBeDefined();
  });
});
