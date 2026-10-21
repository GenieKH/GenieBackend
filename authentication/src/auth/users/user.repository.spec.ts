import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';

const USERNAME_COLLISION = {
  code: '23505',
  message:
    'duplicate key value violates unique constraint "users_username_key"',
  details: 'Key (username)=(user_0123456789) already exists.',
};
const EMAIL_COLLISION = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "users_email_key"',
  details: 'Key (email)=(a@b.com) already exists.',
};

describe('UserRepository.create', () => {
  /** Answers each insert with the next result, as the Supabase client does. */
  function repositoryAnswering(
    ...results: { data?: unknown; error?: unknown }[]
  ) {
    const single = jest.fn();
    for (const result of results)
      single.mockResolvedValueOnce({ data: null, error: null, ...result });
    const insert = jest.fn((_rows: unknown[]) => ({
      select: () => ({ single }),
    }));
    const repository = new UserRepository({
      from: () => ({ insert }),
    } as never);
    return { repository, insert };
  }

  const newUser = { email: 'a@b.com', password_hash: 'hash', role: 'user' };

  it('creates the account without a username: the database draws a random unused one', async () => {
    const { repository, insert } = repositoryAnswering({
      data: { id: 'u1', username: 'user_0123456789' },
    });

    await expect(repository.create(newUser)).resolves.toMatchObject({
      id: 'u1',
    });

    expect(insert).toHaveBeenCalledWith([newUser]);
    expect(newUser).not.toHaveProperty('username');
  });

  it('draws another handle when the random one happens to be taken', async () => {
    const { repository, insert } = repositoryAnswering(
      { error: USERNAME_COLLISION },
      { data: { id: 'u1', username: 'user_9876543210' } },
    );

    await expect(repository.create(newUser)).resolves.toMatchObject({
      username: 'user_9876543210',
    });
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('still tells the user when it is the email or phone that is taken, without retrying', async () => {
    const { repository, insert } = repositoryAnswering({
      error: EMAIL_COLLISION,
    });

    await expect(repository.create(newUser)).rejects.toThrow(
      new ConflictException('Email or phone already exists'),
    );
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('gives up with a server error, not a wrong "email in use", if handles keep colliding', async () => {
    const { repository, insert } = repositoryAnswering(
      ...Array.from({ length: 5 }, () => ({ error: USERNAME_COLLISION })),
    );

    await expect(repository.create(newUser)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(insert).toHaveBeenCalledTimes(5);
  });
});

describe('UserRepository email handling', () => {
  /** A query builder that answers like Supabase's: `eq` and `ilike` each end in a chain that resolves to a row. */
  function repositoryFinding(byExact: unknown, byIgnoringCase: unknown) {
    const eq = jest.fn();
    const ilike = jest.fn();
    const chain = (result: unknown) => ({
      limit: () => ({
        maybeSingle: async () => ({ data: result, error: null }),
      }),
    });
    eq.mockReturnValue(chain(byExact));
    ilike.mockReturnValue(chain(byIgnoringCase));
    const insert = jest.fn((_rows: unknown[]) => ({
      select: () => ({
        single: async () => ({ data: { id: 'u1' }, error: null }),
      }),
    }));
    const repository = new UserRepository({
      from: () => ({ select: () => ({ eq, ilike }), insert }),
    } as never);
    return { repository, eq, ilike, insert };
  }

  it('looks an email up in lowercase, ignoring surrounding spaces', async () => {
    const { repository, eq, ilike } = repositoryFinding({ id: 'u1' }, null);

    await expect(repository.findByEmail('  Foo@Gmail.COM ')).resolves.toEqual({
      id: 'u1',
    });

    expect(eq).toHaveBeenCalledWith('email', 'foo@gmail.com');
    expect(ilike).not.toHaveBeenCalled();
  });

  it('finds an older account that still has capitals, escaping the wildcards in the address', async () => {
    const { repository, ilike } = repositoryFinding(null, { id: 'old' });

    await expect(repository.findByEmail('a_b%c@x.com')).resolves.toEqual({
      id: 'old',
    });

    expect(ilike).toHaveBeenCalledWith('email', 'a\\_b\\%c@x.com');
  });

  it("stores a new account's email in lowercase", async () => {
    const { repository, insert } = repositoryFinding(null, null);

    await repository.create({ email: ' Foo@Gmail.com ', password_hash: 'h' });

    expect(insert).toHaveBeenCalledWith([
      { email: 'foo@gmail.com', password_hash: 'h' },
    ]);
  });
});
