#!/usr/bin/env bash
# Dumps the app's data (the "public" schema) from DATABASE_URL into one file.
#
#   DATABASE_URL=postgresql://... scripts/backup-database.sh <output.dump>
#
# The dump is pg_dump's custom format: compressed, and restored table by table
# with scripts/restore-database.sh. Owners and grants are left out, so it
# restores into any Postgres 17, not only a Supabase one.
#
# Nothing is encrypted here: the nightly workflow first proves the dump
# restores, then encrypts it (docs/BACKUPS.md). Never keep the plain file.
set -euo pipefail

out="${1:?usage: DATABASE_URL=... $0 <output.dump>}"
: "${DATABASE_URL:?DATABASE_URL is not set}"

# The app's URL carries Prisma's "pgbouncer" option, which pg_dump refuses.
url=$(sed -E 's/([?&])pgbouncer=[^&]*(&|$)/\1/; s/[?&]$//' <<<"$DATABASE_URL")

# pg_dump must be at least as new as the server (17 on Supabase today).
pg_dump --version

pg_dump "$url" \
  --format=custom \
  --compress=9 \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file="$out"

echo "Dumped $(du -h "$out" | cut -f1) to $out"
