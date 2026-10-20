# Scaling work: where it stands and what is left

Written 2026-10-20, when the work was paused. Covers both repositories:
`genie-backend` (this one) and the Flutter app `genie`.

## The plan

Six recommendations were agreed, built one vertical slice at a time, in this order:

| # | Slice | Status |
|---|---|---|
| 0 | Performance fixes from the scan | **Done**, committed |
| 1 | Nightly database backups | **Done**, committed; needs your one-time setup |
| 2 | Pagination (saved listings, own listings, conversations) | **Backend done**; app about 40% done (WIP branch, does not compile) |
| 3 | Pause hidden tabs | Not started |
| 4 | Search with Meilisearch | Not started |
| 5 | PostGIS for the map | Not started |
| 6 | Read replica routing | Not started; no replica possible on the Free plan |
| - | ML Kit unbundled | **Dropped** by decision: scanning keeps working offline and on phones without Google Play Services |

Decisions already made: Supabase is on the **Free** plan; search engine is **Meilisearch**; hidden
tabs are **paused, not unloaded**; backups are **GitHub Actions artifacts** (90 days, encrypted).

## Branches

Nothing is pushed. Each branch builds on the one before it.

| Repo | Branch | What is on it |
|---|---|---|
| backend | `perf/scan-fixes` | 8 commits: gzip, engagement counts, area cache, SHA-256 refresh tokens, chat lookups, one-statement likes, migration 23, docs |
| backend | `feat/database-backups` (from `perf/scan-fixes`) | Backup workflow and scripts, `docs/BACKUPS.md`, migration 24 |
| backend | `feat/pagination` (from `perf/scan-fixes`) | Paged endpoints, tested; this document |
| app | `perf/scan-fixes` | 7 commits: chat list, recording, bundled fonts, start-up, map snapping, visited ids, unused image. **Last baseline that compiles** |
| app | `wip/pagination-app` (from `perf/scan-fixes`) | One WIP commit: half of the app side of pagination. **Does not compile** |

Suggested merge order when you are ready: `perf/scan-fixes`, then `feat/database-backups`, then
`feat/pagination` (both repos together, once the app side is finished).

## Things only you can do

1. **Backups**: make an age key, add the `BACKUP_DATABASE_URL` secret and the `BACKUP_AGE_RECIPIENT`
   variable in GitHub, run the "Database backup" workflow once (steps in `docs/BACKUPS.md`). Keep the
   private key in two safe places: without it no backup can be opened.
2. **Migrations** (both optional for the code, both change nothing visible):
   `node scripts/apply-migrations.js 23_property_likes_index 24_row_level_security_everywhere`
3. **Deploying** `perf/scan-fixes`: one `npm install` at the root (new `compression` package), then
   `npx prisma generate`; rebuild the gateway, property, chat and authentication services.

## Slice 2: pagination, what is left

### Done (backend, `feat/pagination`)

All tested (property 168 tests, chat 172) and checked on a real Postgres 17 with seeded data.
Without `limit`, every endpoint answers exactly as before, so older app builds keep working.

- `GET /properties/my/favorites?limit&offset&sort` returns `{ items, nextOffset }`. `sort` is
  `saved | newest | priceHigh | priceLow`, sorted on the server. Price is sorted by number; the app's
  old sort compared prices as text.
- `GET /properties/my/favorites/ids` returns every saved id, for the hearts.
- `GET /properties?limit&offset` returns `{ items, nextOffset, countByStatus }`, for My Properties
  and its tabs.
- `GET /properties/my/in-area?minLat&maxLat&minLng&maxLng` returns your own listings inside the
  map area, for the map's edit markers.
- `GET /chat/conversations?limit&cursor` returns `{ items, nextCursor, unreadTotal }`.

Code: `property/src/properties/dto/page.query.ts`, `services/favorite-listings.service.ts`,
`services/owner-listings.service.ts`, `chat/src/chat/conversation-pages.ts`.

### Done in the app (on `wip/pagination-app`, not compiling yet)

- `lib/shared/utils/paged_list.dart`: `PagedList<T>` (items, hasMore, loadingMore).
- `lib/shared/widgets/lists/load_more_on_scroll.dart`: asks for the next page near the end, and also
  when the first page is too short to scroll.
- `lib/features/property/data/repositories/favorites_repository.dart`: ids, page, favorite and
  unfavorite. These were moved out of `PropertyRepository`.
- `PropertyRepository`: the write-only full-list cache is gone. That cache re-downloaded every
  listing after each publish or edit. Added `fetchOwnPage` and `fetchOwnInArea`.
- `PropertyModel.listFromJson`: one shared list parser.
- `lib/features/property/presentation/view_models/own_listings_providers.dart`:
  - `ownListingsRevisionProvider` and `ownListingsChanged(ref)`: any change to your listings bumps
    it, and whatever shows them reloads.
  - Paged `propertiesProvider`.
  - `ownListingActionsProvider.changeVisibility`.
  - `ownMapPropertiesProvider`: your listings in the map area. Same flow as the public map feed,
    with grid snapping and cancelling.

### To do in the app

1. **My Properties tabs**: `fetchOwnPage` must also read `countByStatus`. The `propertiesProvider`
   state must carry it, for example `({PagedList<PropertyModel> page, Map<String, int> countByStatus})`.
   An optimistic publish, unpublish or remove must adjust it: old status -1, new status +1.
   `PropertyTabs` reads the counts instead of counting the list.
2. **My Properties page** (`my_properties_page.dart`): use `.items`, wrap the list in
   `LoadMoreOnScroll`, and show a small spinner while `loadingMore`.
3. **Saved listings** (`saved_properties_provider.dart`):
   - `savedPropertyIdsProvider` (an ordered set of ids) for hearts and the count. It owns
     `toggle(property)` with optimistic update and rollback; a guest does nothing.
   - `savedPropertiesProvider` becomes the paged list for the Saved page, with the sort sent to the
     server. Mapping: `propertyForYou` → `saved`; `recentlyPosted` / `newest` → `newest`;
     `priceHighToLow` → `priceHigh`; `priceLowToHigh` → `priceLow`.
   - It listens to the ids: an unsaved id is removed at once; a newly saved one reloads the first page
     quietly.
   - Delete `sortedSavedPropertiesProvider`.
4. **Point every consumer at the new providers**:
   - `home/presentation/providers/map_properties_provider.dart`: `propertiesProvider` →
     `ownMapPropertiesProvider`.
   - `home/presentation/widgets/map/main_map_controls.dart:216`: `refreshQuietly()` →
     `ownListingsChangedFrom(ref)`.
   - `property/presentation/widgets/detail/actions/property_owner_actions.dart`: line 56 the same;
     line 76 → `ref.read(ownListingActionsProvider).changeVisibility(...)`.
   - `property/presentation/widgets/my_properties/property_options_sheet.dart`: import the new
     file.
   - `app/session/sign_out.dart`: import the new file.
   - `add_property_controller.dart`: call `ownListingsChanged(ref)` after a successful create or
     update.
   - Hearts in `property_carousel.dart`, `property_detail_sheet.dart` (around line 205),
     `property_highlights.dart` (`_saveCount`) and `publisher_listings_grid.dart` → the ids provider.
   - `saved_properties_page.dart`: the count comes from the ids; the list is paged.
5. **Conversations** (`chat/providers/chat_provider.dart`, `data/chat_repository.dart`):
   - State becomes items + `nextCursor` + `unreadTotal`, with `loadMore()`.
   - `refresh()` reloads as many as are shown, up to 100.
   - `unreadCountProvider` reads `unreadTotal`. Keep it current locally: +1 for a message from the
     other person; `markAsRead` subtracts that conversation's count (or reloads when it is not
     loaded); `removeLocally` subtracts the removed one's.
   - `chat_list_page.dart` and the archive page load more on scroll.
6. **Tests to update**:
   - `test/features/auth/signed_out_state_test.dart`: the fakes override `fetchAll` and
     `fetchFavorites`, which no longer exist.
   - `test/features/property/map_property_filter_test.dart`: own listings now come from
     `fetchOwnInArea`.
   - The chat tests that read `notifier.state.value!` as a list.
7. **Add tests** for: loading more without repeats; the tab counts after an optimistic change; hearts
   from the ids; unread total after a read; `LoadMoreOnScroll` firing on a short first page.
8. Run `flutter analyze` and `flutter test` (742 tests passed at the baseline), then commit, one
   commit per list.

## Slice 3: pause hidden tabs (app only)

Tabs stay built (`home/presentation/widgets/layout/kept_tab_pages.dart`), so switching back stays
instant. But hidden tabs keep rebuilding when data they watch changes.

Plan:
- Hidden pages are already inside `TickerMode(enabled: false)`. Give each page a way to tell it is
  hidden (`TickerMode.valuesOf(context).enabled`, as `user_profile_page.dart` already does).
- The expensive widgets of a hidden tab stop reacting until shown again: the map overlays, and the
  chat and saved lists. Either skip the listener while hidden, or keep the last built child (a
  "frozen when hidden" wrapper that returns the cached child while hidden).
- When shown again, the tab redraws once with current data.
- Test: data changes while a tab is hidden cause no rebuild of it, and one rebuild when it is shown.

## Slice 4: Meilisearch

Today: `GET /public/search` uses `ILIKE` with trigram indexes (`property/src/search/`).

Plan:
- **Infrastructure**: a Meilisearch container on Railway (persistent volume, master key as a
  secret, private network only). For local runs, a Meilisearch binary or container.
- **A search provider interface** (`ListingSearchProvider`), with `MeilisearchListingSearch` and the
  current Postgres search as the fallback. When Meilisearch is down or not configured, search still
  works as today.
- **Index**: published listings only (title, description, type, listing type, price, lat/lng,
  owner name), and publishers. Searchable attributes, ranking (title above description), typo
  tolerance. **Test Khmer text before relying on it**: Khmer has no spaces between words.
- **Keeping it in sync (the hard part)**: every place that calls `PublicPropertyCache.changed()`
  must also update or remove the document: create, edit, move, publish, hide, sold, delete, photos,
  an owner deactivated or renamed (`internal-accounts.controller.ts`). Do it through one small
  "listing changed" path, not in each service. Add a nightly full reindex job to repair any drift.
- **Privacy rule to keep**: drafts, deleted listings and deactivated owners never appear, and people
  results carry no contact details.
- Tests: sync on every change type; fallback when the engine is down; the same results shape as
  today, so the app needs no change.

## Slice 5: PostGIS

PostGIS 3.3.7 is available on the Supabase project, but not installed.

Plan:
- **Migration**: `CREATE EXTENSION postgis`. Add a `geography(Point)` column `location` on
  `properties`, filled from lat/lng, kept in sync by a trigger on lat/lng. Add a GiST index on it.
  It must be idempotent, like the other migrations.
- **Map query** (`PropertyQueryService.searchMap`, `OwnerListingsService.inArea`): a raw SQL
  bounding-box query on `location`, with the same filters, order, 500 limit, cache and response
  shape. Prisma does not know PostGIS types, so this becomes raw SQL like the chat list.
- **Optional new features once it is in**: "nearby listings" sorted by distance; overlap check of
  boundaries (`boundary_points` → a `geography(Polygon)` column).
- **Measure first and after**: `EXPLAIN ANALYZE` of the map query on about 200 000 seeded listings,
  B-tree versus GiST. Keep PostGIS only if it is clearly faster.
- `docs/BACKUPS.md` and `scripts/restore-database.sh` must then create `postgis` before restoring,
  as they do for `pg_trgm`.

## Slice 6: read replica routing

There is no replica on the Free plan; it needs a paid plan with a compute add-on. Until then, the
backups protect the data.

Plan, so it is ready when you upgrade:
- An optional `DATABASE_READ_URL`. When it is set, `PrismaService` gets a second client (or Prisma's
  read-replicas extension).
- Only reads that can be a moment old use it: the public map, search, public listing pages and
  profiles. Anything read right after a write (the owner's own data, chat, sessions) stays on the
  primary.
- When it is not set, everything uses the primary, exactly as today.
- Tests: routing with and without the variable.

## Testing without Docker or the hosted database

This is how slices 1 and 2 were tested:
- **Real Postgres 17**: the portable Windows binaries
  (`get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip`), extracted anywhere,
  then `initdb` and `pg_ctl start` on a spare port (25433 worked). Apply
  `prisma/migrations/*/migration.sql` in numeric order with `psql`.
- **Encryption tool**: `age` from github.com/FiloSottile/age/releases (v1.2.1).
- **Lighter option**: PGlite from `node_modules/@electric-sql` (Postgres in WASM, with
  `pglite-socket` on a port). Set `maxConnections`, or parallel queries drop the connection.
- **Hosted database**: read-only checks only (`SET default_transaction_read_only = on`). Never
  write to it from a session.
