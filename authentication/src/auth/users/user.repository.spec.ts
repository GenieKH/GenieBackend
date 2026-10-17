import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { UserRepository } from './user.repository';

const USERNAME_COLLISION = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "users_username_key"',
  details: 'Key (username)=(user_0123456789) already exists.',
};
const EMAIL_COLLISION = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "users_email_key"',
  details: 'Key (email)=(a@b.com) already exists.',
};

describe('UserRepository.create', () => {
  /** Answers each insert with the next result, as the Supabase client does. */
  function repositoryAnswering(...results: { data?: unknown; error?: unknown }[]) {
    const single = jest.fn();
    for (const result of results) single.mockResolvedValueOnce({ data: null, error: null, ...result });
    const insert = jest.fn((_rows: unknown[]) => ({ select: () => ({ single }) }));
    const repository = new UserRepository({ from: () => ({ insert }) } as never);
    return { repository, insert };
  }

  const newUser = { email: 'a@b.com', password_hash: 'hash', role: 'user' };

  it('creates the account without a username: the database draws a random unused one', async () => {
    const { repository, insert } = repositoryAnswering({ data: { id: 'u1', username: 'user_0123456789' } });

    await expect(repository.create(newUser)).resolves.toMatchObject({ id: 'u1' });

    expect(insert).toHaveBeenCalledWith([newUser]);
    expect(newUser).not.toHaveProperty('username');
  });

  it('draws another handle when the random one happens to be taken', async () => {
    const { repository, insert } = repositoryAnswering(
      { error: USERNAME_COLLISION },
      { data: { id: 'u1', username: 'user_9876543210' } },
    );

    await expect(repository.create(newUser)).resolves.toMatchObject({ username: 'user_9876543210' });
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('still tells the user when it is the email or phone that is taken, without retrying', async () => {
    const { repository, insert } = repositoryAnswering({ error: EMAIL_COLLISION });

    await expect(repository.create(newUser)).rejects.toThrow(new ConflictException('Email or phone already exists'));
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('gives up with a server error, not a wrong "email in use", if handles keep colliding', async () => {
    const { repository, insert } = repositoryAnswering(...Array.from({ length: 5 }, () => ({ error: USERNAME_COLLISION })));

    await expect(repository.create(newUser)).rejects.toThrow(InternalServerErrorException);
    expect(insert).toHaveBeenCalledTimes(5);
  });
});
