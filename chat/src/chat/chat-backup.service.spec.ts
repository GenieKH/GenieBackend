import {
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BackupSeal } from './backup-seal';
import { ChatBackupService, lockDurationMs } from './chat-backup.service';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const SECRET = 'a-test-secret-that-is-long-enough-000';
const RIGHT = Buffer.alloc(32, 1).toString('base64');
const WRONG = Buffer.alloc(32, 2).toString('base64');
const MINUTE = 60 * 1000;

describe('lockDurationMs', () => {
  it('locks on every 5th wrong PIN, twice as long each time, up to a day', () => {
    expect([1, 2, 3, 4, 6, 9].map(lockDurationMs)).toEqual([0, 0, 0, 0, 0, 0]);
    expect([5, 10, 15, 20].map(lockDurationMs)).toEqual([
      15 * MINUTE,
      30 * MINUTE,
      60 * MINUTE,
      120 * MINUTE,
    ]);
    expect(lockDurationMs(40)).toBe(24 * 60 * MINUTE);
    expect(lockDurationMs(500)).toBe(24 * 60 * MINUTE);
  });

  it('makes trying every PIN take centuries', () => {
    const guessesInFirstYear = 35 + 5 * 365;
    expect(1_000_000 / guessesInFirstYear).toBeGreaterThan(500);
  });
});

describe('BackupSeal', () => {
  const seal = new BackupSeal(SECRET);

  it('opens what it sealed, for the same user only', () => {
    const wrapped = seal.wrap(ALICE, 'device-ciphertext');

    expect(wrapped).not.toContain('device-ciphertext');
    expect(seal.unwrap(ALICE, wrapped)).toBe('device-ciphertext');
    expect(() => seal.unwrap(BOB, wrapped)).toThrow();
    expect(() =>
      new BackupSeal('another-secret-that-is-long-enough-00').unwrap(
        ALICE,
        wrapped,
      ),
    ).toThrow();
  });

  it('recognises a PIN proof only with the same secret and user', () => {
    const tag = seal.verifierTag(ALICE, RIGHT);

    expect(tag).not.toBe(RIGHT);
    expect(seal.matches(ALICE, RIGHT, tag)).toBe(true);
    expect(seal.matches(ALICE, WRONG, tag)).toBe(false);
    expect(seal.matches(BOB, RIGHT, tag)).toBe(false);
    expect(
      new BackupSeal('another-secret-that-is-long-enough-00').matches(
        ALICE,
        RIGHT,
        tag,
      ),
    ).toBe(false);
  });

  it('refuses a short secret', () => {
    expect(() => new BackupSeal('short')).toThrow();
  });
});

describe('ChatBackupService', () => {
  const seal = new BackupSeal(SECRET);
  const originalSecret = process.env.CHAT_BACKUP_SECRET;

  /** One stored backup row, changed by the fake transaction like the table would be. */
  let row: {
    blob: string;
    nonce: string;
    verifier: string;
    failedAttempts: number;
    lockedUntil: Date | null;
  } | null;
  const tx = {
    $queryRaw: jest.fn(async () => (row ? [{ ...row }] : [])),
    chatKeyBackup: {
      update: jest.fn(
        async ({ data }: { data: Partial<NonNullable<typeof row>> }) => {
          row = { ...row!, ...data };
        },
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (work: unknown) =>
      typeof work === 'function'
        ? (work as (client: typeof tx) => unknown)(tx)
        : Promise.all(work as unknown[]),
    ),
    chatKeyBackup: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: { update: jest.fn(), findUnique: jest.fn() },
  };
  const cache = { delete: jest.fn() };
  let service: ChatBackupService;

  const unlockStatus = async (verifier: string) => {
    try {
      await service.unlock(ALICE, verifier);
      return HttpStatus.OK;
    } catch (error) {
      return (error as { getStatus(): number }).getStatus();
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    process.env.CHAT_BACKUP_SECRET = SECRET;
    row = {
      blob: seal.wrap(ALICE, 'device-ciphertext'),
      nonce: 'nonce',
      verifier: seal.verifierTag(ALICE, RIGHT),
      failedAttempts: 0,
      lockedUntil: null,
    };
    service = new ChatBackupService(prisma as never, cache as never);
  });

  afterAll(() => {
    jest.useRealTimers();
    if (originalSecret === undefined) delete process.env.CHAT_BACKUP_SECRET;
    else process.env.CHAT_BACKUP_SECRET = originalSecret;
  });

  describe('unlock', () => {
    it('releases the key for the right PIN', async () => {
      await expect(service.unlock(ALICE, RIGHT)).resolves.toEqual({
        backupBlob: 'device-ciphertext',
        backupNonce: 'nonce',
      });
    });

    it('counts a wrong PIN and says how many tries are left', async () => {
      await expect(service.unlock(ALICE, WRONG)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { message: 'Wrong PIN', attemptsLeft: 4 },
      });
      expect(row!.failedAttempts).toBe(1);
    });

    it('locks on the 5th wrong PIN and then refuses even the right one', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) statuses.push(await unlockStatus(WRONG));

      expect(statuses).toEqual([403, 403, 403, 403, 429]);
      await expect(service.unlock(ALICE, RIGHT)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: { retryAfterSeconds: expect.any(Number) },
      });
      // Tries made while locked are not even compared, so they do not add up.
      expect(row!.failedAttempts).toBe(5);
    });

    it('opens again after the lock, and locks for longer the next time', async () => {
      jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
      for (let i = 0; i < 5; i++) await unlockStatus(WRONG);

      jest.setSystemTime(new Date('2026-01-01T00:14:59Z'));
      expect(await unlockStatus(RIGHT)).toBe(429);

      jest.setSystemTime(new Date('2026-01-01T00:15:01Z'));
      for (let i = 0; i < 5; i++) await unlockStatus(WRONG);
      expect(row!.lockedUntil).toEqual(new Date('2026-01-01T00:45:01Z'));
    });

    it('forgets earlier wrong PINs after the right one', async () => {
      for (let i = 0; i < 4; i++) await unlockStatus(WRONG);

      expect(await unlockStatus(RIGHT)).toBe(200);
      expect(row).toMatchObject({ failedAttempts: 0, lockedUntil: null });
    });

    it('reports a missing backup', async () => {
      row = null;

      await expect(service.unlock(ALICE, RIGHT)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('save', () => {
    const NEW_BACKUP = {
      blob: 'new-ciphertext',
      salt: 'salt',
      nonce: 'nonce',
      verifier: WRONG,
    };
    const saveStatus = async (currentVerifier?: string) => {
      try {
        await service.save(ALICE, NEW_BACKUP, {
          currentVerifier,
          identityPublicKey: 'new-public-key',
        });
        return HttpStatus.OK;
      } catch (error) {
        return (error as { getStatus(): number }).getStatus();
      }
    };

    describe('over an existing backup', () => {
      beforeEach(() =>
        prisma.chatKeyBackup.findUnique.mockResolvedValue({ userId: ALICE }),
      );

      it('is refused without proof of the current PIN', async () => {
        expect(await saveStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(prisma.chatKeyBackup.upsert).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('is refused for a wrong PIN, which counts as a try', async () => {
        expect(await saveStatus(WRONG)).toBe(HttpStatus.FORBIDDEN);
        expect(row!.failedAttempts).toBe(1);
        expect(prisma.chatKeyBackup.upsert).not.toHaveBeenCalled();
      });

      it('locks like unlocking does, so the PIN cannot be guessed here instead', async () => {
        const statuses: number[] = [];
        for (let i = 0; i < 5; i++) statuses.push(await saveStatus(WRONG));

        expect(statuses).toEqual([403, 403, 403, 403, 429]);
        expect(await saveStatus(RIGHT)).toBe(HttpStatus.TOO_MANY_REQUESTS);
      });

      it('replaces the backup and the public key together for the right PIN', async () => {
        expect(await saveStatus(RIGHT)).toBe(HttpStatus.OK);

        expect(prisma.chatKeyBackup.upsert).toHaveBeenCalledTimes(1);
        expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
          identityPublicKey: 'new-public-key',
        });
        // Other people must stop encrypting to the old key at once.
        expect(cache.delete).toHaveBeenCalledWith(`chat:public-key:${ALICE}`);
      });
    });

    describe('for an owner who forgot the PIN and proved their account password instead', () => {
      beforeEach(() =>
        prisma.chatKeyBackup.findUnique.mockResolvedValue({ userId: ALICE }),
      );

      it('replaces the backup without the PIN', async () => {
        await service.save(ALICE, NEW_BACKUP, {
          provenByPassword: true,
          identityPublicKey: 'new-public-key',
        });

        expect(prisma.chatKeyBackup.upsert).toHaveBeenCalledTimes(1);
        expect(row!.failedAttempts).toBe(0);
      });

      it('gets back in even while wrong PINs have the backup locked', async () => {
        for (let i = 0; i < 5; i++) await saveStatus(WRONG);

        await service.save(ALICE, NEW_BACKUP, { provenByPassword: true });

        // The new backup starts with a clean count.
        expect(
          prisma.chatKeyBackup.upsert.mock.calls[0][0].update,
        ).toMatchObject({
          failedAttempts: 0,
          lockedUntil: null,
        });
      });
    });

    it('needs no proof for the first backup', async () => {
      prisma.chatKeyBackup.findUnique.mockResolvedValue(null);

      expect(await saveStatus()).toBe(HttpStatus.OK);
    });

    it('stores neither the PIN proof nor the device ciphertext as received', async () => {
      await service.save(ALICE, {
        blob: 'device-ciphertext',
        salt: 'salt',
        nonce: 'nonce',
        verifier: RIGHT,
      });

      const { create, update } = prisma.chatKeyBackup.upsert.mock.calls[0][0];
      expect(create).toMatchObject({
        userId: ALICE,
        salt: 'salt',
        nonce: 'nonce',
        failedAttempts: 0,
      });
      expect(update).toMatchObject({ failedAttempts: 0, lockedUntil: null });
      expect(seal.unwrap(ALICE, create.blob)).toBe('device-ciphertext');
      expect(create.verifier).not.toBe(RIGHT);
      expect(seal.matches(ALICE, RIGHT, create.verifier)).toBe(true);
    });

    it('records a new backup as PIN-locked, also in place of one the account password locked', async () => {
      await service.save(ALICE, {
        blob: 'b',
        salt: 's',
        nonce: 'n',
        verifier: RIGHT,
      });
      await service.save(
        ALICE,
        { blob: 'b', salt: 's', nonce: 'n', verifier: RIGHT },
        { provenByPassword: true },
      );

      expect(
        prisma.chatKeyBackup.upsert.mock.calls[0][0].create.protectedBy,
      ).toBe('pin');
      expect(
        prisma.chatKeyBackup.upsert.mock.calls[1][0].update.protectedBy,
      ).toBe('pin');
    });

    it('removes the backup from before PIN tries were counted', async () => {
      await service.save(ALICE, {
        blob: 'b',
        salt: 's',
        nonce: 'n',
        verifier: RIGHT,
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: ALICE },
        data: { backupBlob: null, backupSalt: null, backupNonce: null },
      });
    });
  });

  it('cannot remove a backup: the chat PIN is not optional', () => {
    expect(
      (service as unknown as Record<string, unknown>).remove,
    ).toBeUndefined();
  });

  describe('describe', () => {
    it('reveals only the salt of a protected backup, and what to ask for', async () => {
      prisma.chatKeyBackup.findUnique.mockResolvedValue({
        salt: 'salt',
        protectedBy: 'password',
      });

      await expect(service.describe(ALICE)).resolves.toEqual({
        backupSalt: 'salt',
        protectedBy: 'password',
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('still returns an older backup whole, so the app can upgrade it', async () => {
      prisma.chatKeyBackup.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        backupBlob: 'b',
        backupSalt: 's',
        backupNonce: 'n',
      });

      await expect(service.describe(ALICE)).resolves.toEqual({
        backupSalt: 's',
        backupBlob: 'b',
        backupNonce: 'n',
        protectedBy: 'pin',
      });
    });

    it('reports a user without any backup', async () => {
      prisma.chatKeyBackup.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        backupBlob: null,
        backupSalt: null,
        backupNonce: null,
      });

      await expect(service.describe(ALICE)).rejects.toThrow(NotFoundException);
    });
  });

  it('refuses to store or open backups without the server secret', async () => {
    delete process.env.CHAT_BACKUP_SECRET;

    await expect(service.unlock(ALICE, RIGHT)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(
      service.save(ALICE, {
        blob: 'b',
        salt: 's',
        nonce: 'n',
        verifier: RIGHT,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.chatKeyBackup.upsert).not.toHaveBeenCalled();
  });
});
