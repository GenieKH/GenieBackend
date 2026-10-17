import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SearchHistoryService } from './search-history.service';

type Row = {
  id: string;
  userId: string;
  query: string;
  normalizedQuery: string;
  searchedAt: Date;
};

/** Just enough of the search_history table to run the service's queries. */
function fakeTable() {
  const rows: Row[] = [];
  let nextId = 1;
  const pick = ({ id, query, searchedAt }: Row) => ({ id, query, searchedAt });
  const matches = (row: Row, where: any): boolean => {
    if (where.OR) return where.OR.some((part: any) => matches(row, part));
    if (where.userId && row.userId !== where.userId) return false;
    if (typeof where.id === 'string' && row.id !== where.id) return false;
    if (where.id?.in && !where.id.in.includes(row.id)) return false;
    if (where.searchedAt?.gte && row.searchedAt < where.searchedAt.gte)
      return false;
    if (where.searchedAt?.lt && !(row.searchedAt < where.searchedAt.lt))
      return false;
    return true;
  };
  const newestFirst = (list: Row[]) =>
    [...list].sort((a, b) => b.searchedAt.getTime() - a.searchedAt.getTime());

  return {
    rows,
    findMany: jest.fn(async ({ where, skip = 0, take }: any) =>
      newestFirst(rows.filter((row) => matches(row, where)))
        .slice(skip, take === undefined ? undefined : skip + take)
        .map((row) => ({ ...pick(row), id: row.id })),
    ),
    upsert: jest.fn(async ({ where, create, update }: any) => {
      const key = where.userId_normalizedQuery;
      const existing = rows.find(
        (row) =>
          row.userId === key.userId &&
          row.normalizedQuery === key.normalizedQuery,
      );
      if (existing) {
        Object.assign(existing, update);
        return pick(existing);
      }
      const row = { id: `h-${nextId++}`, ...create };
      rows.push(row);
      return pick(row);
    }),
    deleteMany: jest.fn(async ({ where }: any) => {
      const doomed = rows.filter((row) => matches(row, where));
      doomed.forEach((row) => rows.splice(rows.indexOf(row), 1));
      return { count: doomed.length };
    }),
  };
}

const DAY = 24 * 60 * 60 * 1000;

describe('SearchHistoryService', () => {
  let table: ReturnType<typeof fakeTable>;
  let history: SearchHistoryService;
  const now = new Date('2026-10-16T12:00:00Z');

  beforeEach(() => {
    table = fakeTable();
    history = new SearchHistoryService({ searchHistoryEntry: table } as never);
  });

  it('remembers a search as typed, and lists it', async () => {
    await history.record('u-1', '  Veng Sreng ', now);

    expect(await history.list('u-1', now)).toEqual([
      { id: 'h-1', query: 'Veng Sreng', searchedAt: now },
    ]);
  });

  it('keeps one entry per text: searching it again moves it to the top', async () => {
    await history.record('u-1', 'veng sreng', new Date(now.getTime() - 3000));
    await history.record('u-1', 'pou senchey', new Date(now.getTime() - 2000));
    await history.record('u-1', 'VENG  sreng', now);

    const listed = await history.list('u-1', now);
    expect(listed.map((entry) => entry.query)).toEqual([
      'VENG  sreng',
      'pou senchey',
    ]);
    expect(table.rows).toHaveLength(2);
  });

  it('shows each account only its own searches', async () => {
    await history.record('u-1', 'villa', now);
    await history.record('u-2', 'condo', now);

    expect(
      (await history.list('u-2', now)).map((entry) => entry.query),
    ).toEqual(['condo']);
  });

  it('forgets searches older than 14 days, for everyone', async () => {
    await history.record('u-2', 'old one', new Date(now.getTime() - 15 * DAY));
    await history.record('u-1', 'recent', new Date(now.getTime() - 13 * DAY));

    await history.record('u-1', 'today', now);

    expect(table.rows.map((row) => row.query).sort()).toEqual([
      'recent',
      'today',
    ]);
  });

  it('never lists an expired search, even before it is deleted', async () => {
    table.rows.push({
      id: 'stale',
      userId: 'u-1',
      query: 'stale',
      normalizedQuery: 'stale',
      searchedAt: new Date(now.getTime() - 20 * DAY),
    });

    expect(await history.list('u-1', now)).toEqual([]);
  });

  it('keeps at most 50 searches per account', async () => {
    for (let i = 0; i < 55; i++) {
      await history.record(
        'u-1',
        `search ${i}`,
        new Date(now.getTime() - (55 - i) * 1000),
      );
    }

    expect(table.rows).toHaveLength(50);
    expect(table.rows.some((row) => row.query === 'search 0')).toBe(false);
    expect((await history.list('u-1', now))[0].query).toBe('search 54');
  });

  it('refuses a text that is nothing but wildcards', async () => {
    await expect(history.record('u-1', '%%', now)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("deletes the user's own entry, and is 404 for anyone else's", async () => {
    const entry = await history.record('u-1', 'villa', now);

    await expect(history.remove('u-2', entry.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(table.rows).toHaveLength(1);

    await history.remove('u-1', entry.id);
    expect(table.rows).toHaveLength(0);
    await expect(history.remove('u-1', entry.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
