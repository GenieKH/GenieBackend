import { BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountContentService } from './account-content.service';
import { AvatarService } from './avatar.service';

const ME = '11111111-1111-4111-8111-111111111111';
const SOMEONE_ELSE = '22222222-2222-4222-8222-222222222222';
const FILE = '33333333-3333-4333-8333-333333333333';
const PUBLIC = 'https://storage.test/public/avatars';

describe('AvatarService', () => {
  const userTable = { findUnique: jest.fn(), update: jest.fn() };
  const storage = {
    ensureBucket: jest.fn(),
    createSignedUploadUrl: jest.fn(),
    createSignedDownloadUrl: jest.fn(),
    publicUrl: jest.fn((_bucket: string, path: string) => `${PUBLIC}/${path}`),
    removeFiles: jest.fn(),
    removeFolder: jest.fn(),
  };
  const users = { forgetPublicProfile: jest.fn(), getProfile: jest.fn() };
  let avatars: AvatarService;

  beforeEach(() => {
    jest.clearAllMocks();
    userTable.findUnique.mockResolvedValue({ avatarUrl: null });
    storage.createSignedUploadUrl.mockResolvedValue('https://storage.test/upload?token=t');
    storage.createSignedDownloadUrl.mockResolvedValue('https://storage.test/signed');
    users.getProfile.mockResolvedValue({ id: ME });
    avatars = new AvatarService({ user: userTable } as never, storage as never, users as never);
  });

  it("hands out an upload location inside the user's own folder", async () => {
    const upload = await avatars.createUpload(ME);

    expect(upload.path).toMatch(new RegExp(`^${ME}/[0-9a-f-]{36}$`));
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith('avatars', upload.path);
  });

  it('uses an uploaded picture, and tells everyone who shows the user', async () => {
    await avatars.useUpload(ME, `${ME}/${FILE}`);

    expect(userTable.update).toHaveBeenCalledWith({ where: { id: ME }, data: { avatarUrl: `${PUBLIC}/${ME}/${FILE}` } });
    expect(users.forgetPublicProfile).toHaveBeenCalledWith(ME);
  });

  it.each([
    ["a picture in someone else's folder", `${SOMEONE_ELSE}/${FILE}`],
    ['a path that climbs out of the folder', `${ME}/../${SOMEONE_ELSE}/${FILE}`],
    ['a URL', 'https://evil.example/a.png'],
  ])('refuses %s', async (_case, path) => {
    await expect(avatars.useUpload(ME, path)).rejects.toThrow(BadRequestException);
    expect(userTable.update).not.toHaveBeenCalled();
  });

  it('refuses a picture that was never uploaded', async () => {
    storage.createSignedDownloadUrl.mockResolvedValue(null);

    await expect(avatars.useUpload(ME, `${ME}/${FILE}`)).rejects.toThrow('not uploaded');
  });

  it('deletes the picture it replaces, which nobody can see any more', async () => {
    userTable.findUnique.mockResolvedValue({ avatarUrl: `${PUBLIC}/${ME}/old-picture` });

    await avatars.useGooglePhoto(ME, 'https://lh3.googleusercontent.com/a/photo');

    expect(storage.removeFiles).toHaveBeenCalledWith('avatars', [`${ME}/old-picture`]);
  });

  it('leaves a Google photo alone when it is replaced: it is not ours to delete', async () => {
    userTable.findUnique.mockResolvedValue({ avatarUrl: 'https://lh3.googleusercontent.com/a/photo' });

    await avatars.remove(ME);

    expect(userTable.update).toHaveBeenCalledWith({ where: { id: ME }, data: { avatarUrl: null } });
    expect(storage.removeFiles).not.toHaveBeenCalled();
  });

  it('syncs only with a real Google photo', async () => {
    await expect(avatars.useGooglePhoto(ME, 'https://evil.example/tracker.png')).rejects.toThrow(BadRequestException);
    expect(userTable.update).not.toHaveBeenCalled();
  });

  it('still changes the picture when the old file cannot be deleted', async () => {
    userTable.findUnique.mockResolvedValue({ avatarUrl: `${PUBLIC}/${ME}/old-picture` });
    storage.removeFiles.mockRejectedValue(new Error('storage down'));

    await expect(avatars.remove(ME)).resolves.toEqual({ id: ME });
  });
});

describe('AccountContentService', () => {
  const propertyTable = { findMany: jest.fn() };
  const users = { forgetPublicProfile: jest.fn() };
  const avatars = { removeAllOf: jest.fn() };
  const propertyImages = { removeAllOwnedBy: jest.fn() };
  const publicProperties = { changed: jest.fn() };
  const chat = { forgetPublicKey: jest.fn() };
  const chatAttachments = { removeAllOf: jest.fn() };
  let content: AccountContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    propertyTable.findMany.mockResolvedValue([{ id: 'listing-1' }, { id: 'listing-2' }]);
    content = new AccountContentService(
      { property: propertyTable } as never,
      users as never,
      avatars as never,
      propertyImages as never,
      publicProperties as never,
      chat as never,
      chatAttachments as never,
    );
  });

  it('erases every kind of file an account can upload', async () => {
    await content.eraseFiles(ME);

    expect(propertyImages.removeAllOwnedBy).toHaveBeenCalledWith(ME);
    expect(chatAttachments.removeAllOf).toHaveBeenCalledWith(ME);
    expect(avatars.removeAllOf).toHaveBeenCalledWith(ME);
  });

  it('does not report success when one kind could not be erased', async () => {
    chatAttachments.removeAllOf.mockRejectedValue(new Error('storage down'));

    await expect(content.eraseFiles(ME)).rejects.toThrow('storage down');
  });

  it('drops everything cached about an account that was hidden or came back', async () => {
    await content.visibilityChanged(ME);

    expect(users.forgetPublicProfile).toHaveBeenCalledWith(ME);
    expect(chat.forgetPublicKey).toHaveBeenCalledWith(ME);
    expect(publicProperties.changed.mock.calls).toEqual([['listing-1'], ['listing-2']]);
  });
});

describe('SupabaseService.removeFolder', () => {
  /** A bucket as a map of path -> file, listed and deleted the way Supabase storage does it. */
  function serviceOver(paths: string[]) {
    const files = new Set(paths);
    const bucket = {
      list: async (folder: string) => {
        const names = new Map<string, { name: string; id: string | null }>();
        for (const path of files) {
          if (!path.startsWith(`${folder}/`)) continue;
          const [name, ...deeper] = path.slice(folder.length + 1).split('/');
          names.set(name, { name, id: deeper.length === 0 ? `id-${name}` : null });
        }
        return { data: [...names.values()], error: null };
      },
      remove: async (targets: string[]) => {
        targets.forEach((path) => files.delete(path));
        return { error: null };
      },
    };
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const service = new SupabaseService();
    (service as unknown as { supabase: unknown }).supabase = { storage: { from: () => bucket } };
    return { service, files };
  }

  it('deletes every file under the folder, at any depth, and nothing else', async () => {
    const { service, files } = serviceOver([
      `${ME}/${SOMEONE_ELSE}/file-1`,
      `${ME}/${SOMEONE_ELSE}/file-2`,
      `${ME}/third-person/file-3`,
      `${SOMEONE_ELSE}/${ME}/file-4`,
      `${SOMEONE_ELSE}/third-person/file-5`,
    ]);

    await service.removeFolder('chat-attachments', ME);
    await service.removeFolder('chat-attachments', `${SOMEONE_ELSE}/${ME}`);

    expect([...files]).toEqual([`${SOMEONE_ELSE}/third-person/file-5`]);
  });

  it('does nothing for a folder that does not exist', async () => {
    const { service, files } = serviceOver([`${SOMEONE_ELSE}/file`]);

    await expect(service.removeFolder('avatars', ME)).resolves.toBeUndefined();
    expect(files.size).toBe(1);
  });
});
