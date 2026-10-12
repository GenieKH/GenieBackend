import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  const users = { findByEmail: jest.fn(), update: jest.fn() };
  const otps = {
    invalidateAllFor: jest.fn(),
    create: jest.fn(),
    findLatestActive: jest.fn(),
    markUsed: jest.fn(),
  };
  const refreshTokens = { revokeAllForUser: jest.fn() };
  const mailer = { sendOtp: jest.fn() };
  let service: PasswordResetService;

  beforeEach(() => {
    jest.resetAllMocks();
    mailer.sendOtp.mockResolvedValue(undefined);
    service = new PasswordResetService(users as never, otps as never, refreshTokens as never, mailer as never);
  });

  describe('requestReset', () => {
    it('gives the same answer for unknown emails and sends nothing', async () => {
      users.findByEmail.mockResolvedValue(null);

      const result = await service.requestReset('ghost@example.com');

      expect(result.message).toMatch(/If the email exists/);
      expect(mailer.sendOtp).not.toHaveBeenCalled();
      expect(otps.create).not.toHaveBeenCalled();
    });

    it('stores only a hash of a 6-digit code and emails the code', async () => {
      users.findByEmail.mockResolvedValue({ id: 'u1' });

      await service.requestReset('a@b.com');

      const [email, otp] = mailer.sendOtp.mock.calls[0];
      expect(email).toBe('a@b.com');
      expect(otp).toMatch(/^\d{6}$/);

      const [, storedHash] = otps.create.mock.calls[0];
      expect(storedHash).not.toBe(otp);
      expect(await bcrypt.compare(otp, storedHash)).toBe(true);
      expect(otps.invalidateAllFor).toHaveBeenCalledWith('a@b.com');
    });

    it('still succeeds when the email provider fails', async () => {
      users.findByEmail.mockResolvedValue({ id: 'u1' });
      mailer.sendOtp.mockRejectedValue(new Error('smtp down'));

      await expect(service.requestReset('a@b.com')).resolves.toBeDefined();
    });
  });

  describe('verifyOtp / resetPassword', () => {
    const record = { id: 'o1', otp_hash: bcrypt.hashSync('123456', 4) };

    it('accepts the right code', async () => {
      otps.findLatestActive.mockResolvedValue(record);

      await expect(service.verifyOtp('a@b.com', '123456')).resolves.toMatchObject({ verified: true });
    });

    it('rejects a wrong code and an expired/missing one', async () => {
      otps.findLatestActive.mockResolvedValueOnce(record);
      await expect(service.verifyOtp('a@b.com', '000000')).rejects.toThrow(BadRequestException);

      otps.findLatestActive.mockResolvedValueOnce(null);
      await expect(service.verifyOtp('a@b.com', '123456')).rejects.toThrow(BadRequestException);
    });

    it('changes the password, burns the code and signs the user out everywhere', async () => {
      otps.findLatestActive.mockResolvedValue(record);
      users.findByEmail.mockResolvedValue({ id: 'u1' });

      await service.resetPassword('a@b.com', '123456', 'new-password');

      const patch = users.update.mock.calls[0][1];
      expect(await bcrypt.compare('new-password', patch.password_hash)).toBe(true);
      expect(otps.markUsed).toHaveBeenCalledWith('o1');
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });

    it('does not touch the password when the code is wrong', async () => {
      otps.findLatestActive.mockResolvedValue(record);

      await expect(service.resetPassword('a@b.com', '999999', 'new-password')).rejects.toThrow(BadRequestException);
      expect(users.update).not.toHaveBeenCalled();
    });
  });
});
