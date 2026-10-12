import { FirebaseLoginService } from './firebase-login.service';

// firebase-admin pulls in ESM-only packages Jest cannot load; the real
// service is replaced by a stub below anyway.
jest.mock('../../firebase/firebase.service', () => ({ FirebaseService: class {} }));

describe('FirebaseLoginService', () => {
  const firebase = { verifyIdToken: jest.fn() };
  const users = {
    findByFirebaseUid: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const tokens = { issue: jest.fn() };
  let service: FirebaseLoginService;

  const existingUser = {
    id: 'u1',
    role: 'user',
    email: 'a@b.com',
    username: 'Has Name',
    avatar_url: 'https://img/a.png',
    firebase_uid: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    tokens.issue.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    service = new FirebaseLoginService(firebase as never, users as never, tokens as never);
  });

  it('logs in a user already linked to the Firebase uid', async () => {
    firebase.verifyIdToken.mockResolvedValue({ uid: 'fb1', email: 'a@b.com', email_verified: true });
    users.findByFirebaseUid.mockResolvedValue({ ...existingUser, firebase_uid: 'fb1' });

    await service.login('id-token');

    expect(users.create).not.toHaveBeenCalled();
    expect(tokens.issue).toHaveBeenCalledWith('u1', 'user');
  });

  it('links a verified email to the existing account', async () => {
    firebase.verifyIdToken.mockResolvedValue({ uid: 'fb1', email: 'a@b.com', email_verified: true });
    users.findByFirebaseUid.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(existingUser);

    await service.login('id-token');

    expect(users.update).toHaveBeenCalledWith('u1', { firebase_uid: 'fb1' });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('never links an account through an UNVERIFIED email', async () => {
    firebase.verifyIdToken.mockResolvedValue({ uid: 'fb9', email: 'victim@b.com', email_verified: false });
    users.findByFirebaseUid.mockResolvedValue(null);
    users.create.mockResolvedValue({ ...existingUser, id: 'new', email: 'victim@b.com' });

    await service.login('id-token');

    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(users.update).not.toHaveBeenCalledWith('u1', expect.anything());
  });

  it('creates a new account (role "user") when nobody matches', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      uid: 'fb2',
      email: 'new@b.com',
      email_verified: true,
      name: 'New Person',
      picture: 'https://img/n.png',
    });
    users.findByFirebaseUid.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ ...existingUser, id: 'u2', username: 'New Person', avatar_url: 'https://img/n.png' });

    await service.login('id-token');

    const created = users.create.mock.calls[0][0];
    expect(created).toMatchObject({ email: 'new@b.com', role: 'user', firebase_uid: 'fb2', username: 'New Person' });
    expect(created.password_hash).toBeTruthy();
  });

  it('fills in a missing name and photo from Google', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      uid: 'fb1',
      email: 'a@b.com',
      email_verified: true,
      name: 'Google Name',
      picture: 'https://img/g.png',
    });
    users.findByFirebaseUid.mockResolvedValue({ ...existingUser, username: null, avatar_url: null, firebase_uid: 'fb1' });

    await service.login('id-token');

    expect(users.update).toHaveBeenCalledWith('u1', { username: 'Google Name', avatar_url: 'https://img/g.png' });
  });
});
