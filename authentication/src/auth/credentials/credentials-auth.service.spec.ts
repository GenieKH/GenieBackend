import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CredentialsAuthService } from './credentials-auth.service';

describe('CredentialsAuthService', () => {
  const users = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
  };
  const tokens = { issue: jest.fn() };
  let service: CredentialsAuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CredentialsAuthService(users as never, tokens as never);
  });

  describe('register', () => {
    it('hashes the password and always creates a plain "user"', async () => {
      await service.register({ email: 'a@b.com', password: 'password123' });

      const saved = users.create.mock.calls[0][0];
      expect(saved.role).toBe('user');
      expect(saved.password_hash).not.toBe('password123');
      expect(await bcrypt.compare('password123', saved.password_hash)).toBe(true);
    });

    it('ignores a role sent by the client', async () => {
      await service.register({ email: 'a@b.com', password: 'password123', role: 'admin' } as never);

      expect(users.create.mock.calls[0][0].role).toBe('user');
    });
  });

  describe('login', () => {
    const passwordHash = bcrypt.hashSync('correct-password', 4);

    it('returns tokens for the right password', async () => {
      users.findByEmail.mockResolvedValue({ id: 'u1', role: 'user', password_hash: passwordHash });
      tokens.issue.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

      const result = await service.login({ email: 'a@b.com', password: 'correct-password' });

      expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
      expect(tokens.issue).toHaveBeenCalledWith('u1', 'user');
    });

    it('answers a wrong password and an unknown user identically', async () => {
      users.findByEmail.mockResolvedValueOnce({ id: 'u1', role: 'user', password_hash: passwordHash });
      await expect(service.login({ email: 'a@b.com', password: 'nope' })).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      users.findByEmail.mockResolvedValueOnce(null);
      await expect(service.login({ email: 'x@y.com', password: 'nope' })).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('looks the user up by phone when no email is given', async () => {
      users.findByPhone.mockResolvedValue(null);

      await expect(service.login({ phone: '+855123', password: 'x' })).rejects.toThrow(UnauthorizedException);
      expect(users.findByPhone).toHaveBeenCalledWith('+855123');
    });

    it('refuses a login with neither email nor phone', async () => {
      await expect(service.login({ password: 'x' })).rejects.toThrow(BadRequestException);
      expect(users.findByEmail).not.toHaveBeenCalled();
    });
  });
});
