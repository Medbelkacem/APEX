#!/usr/bin/env bash
#
# Full backup of an Apex Digital Lab deployment: the MongoDB contents and the
# storage volume, in one timestamped archive.
#
# Both halves are needed together. Document metadata (case records, invoice
# rows, statement periods) lives in Mongo while the files those rows point at
# live on disk, so a database dump restored against a mismatched storage tree
# yields invoices whose PDFs 404. Always restore the pair.
#
# mongodump is run INSIDE the mongo container, so the host needs no MongoDB
# tooling installed — only docker and tar.
#
# Usage:
#   scripts/backup.sh                        # dump database + storage
#   BACKUP_DIR=/mnt/backups scripts/backup.sh
#   SKIP_DB=1 scripts/backup.sh              # storage only (see note below)
#
# Restore:
#   tar xzf apex-backup-<stamp>.tar.gz
#   docker compose -f docker/compose.prod.yml exec -T mongo \
#     mongorestore --archive --drop < apex-backup-<stamp>/mongo.archive
#   rsync -a apex-backup-<stamp>/storage/ ./storage/
#
# Cron (daily at 03:15, logging to syslog):
#   15 3 * * * cd /opt/apex && scripts/backup.sh 2>&1 | logger -t apex-backup
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker/compose.prod.yml}"
MONGO_SERVICE="${MONGO_SERVICE:-mongo}"
MONGO_DB="${MONGO_DB:-dental}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
SKIP_DB="${SKIP_DB:-0}"

STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="apex-backup-$STAMP"
STAGE="$BACKUP_DIR/$NAME"

# Whichever compose entrypoint exists on this host.
if docker compose version >/dev/null 2>&1; then
	COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
	COMPOSE=(docker-compose)
else
	COMPOSE=()
fi

log() { printf '[backup] %s\n' "$*"; }
die() { printf '[backup] ERROR: %s\n' "$*" >&2; exit 1; }

mkdir -p "$STAGE"
trap 'rm -rf "$STAGE"' EXIT

# ── Database ──────────────────────────────────────────────────
# A backup that quietly skips the database is worse than no backup, because it
# looks like one. This fails loudly unless SKIP_DB=1 says the omission is
# intentional.
if [ "$SKIP_DB" = "1" ]; then
	log "SKIP_DB=1 — archiving storage only, NO database dump in this backup"
	printf 'NO DATABASE DUMP — taken with SKIP_DB=1\n' > "$STAGE/mongo.SKIPPED"
else
	[ ${#COMPOSE[@]} -gt 0 ] || die "no docker compose available; install it or re-run with SKIP_DB=1"
	[ -f "$COMPOSE_FILE" ] || die "compose file not found: $COMPOSE_FILE"
	"${COMPOSE[@]}" -f "$COMPOSE_FILE" ps "$MONGO_SERVICE" 2>/dev/null | grep -q "$MONGO_SERVICE" \
		|| die "mongo service '$MONGO_SERVICE' is not running; start the stack or re-run with SKIP_DB=1"

	log "dumping database '$MONGO_DB'"
	"${COMPOSE[@]}" -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" \
		mongodump --db "$MONGO_DB" --archive > "$STAGE/mongo.archive" \
		|| die "mongodump failed — no backup written"
	[ -s "$STAGE/mongo.archive" ] || die "mongodump produced an empty archive — no backup written"
	log "database dump: $(du -h "$STAGE/mongo.archive" | cut -f1)"
fi

# ── Storage volume ────────────────────────────────────────────
# Case attachments, invoice PDFs and statement PDFs. Only the local driver is
# implemented today (the S3 driver throws), so this directory IS the file store.
if [ -d "$ROOT/storage" ]; then
	log "copying storage volume"
	cp -a "$ROOT/storage" "$STAGE/storage"
	log "storage: $(find "$STAGE/storage" -type f ! -name .gitkeep | wc -l | tr -d ' ') file(s)"
else
	log "no storage/ directory — nothing to copy"
fi

# ── Manifest ──────────────────────────────────────────────────
# So a restorer can tell which code revision produced these documents.
{
	printf 'taken:      %s\n' "$(date -Iseconds)"
	printf 'host:       %s\n' "$(hostname)"
	printf 'database:   %s\n' "$([ "$SKIP_DB" = "1" ] && echo 'SKIPPED' || echo "$MONGO_DB")"
	printf 'git commit: %s\n' "$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
	printf 'git branch: %s\n' "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
} > "$STAGE/MANIFEST.txt"

# ── Seal and verify ───────────────────────────────────────────
ARCHIVE="$BACKUP_DIR/$NAME.tar.gz"
tar czf "$ARCHIVE" -C "$BACKUP_DIR" "$NAME"
rm -rf "$STAGE"
trap - EXIT

tar tzf "$ARCHIVE" >/dev/null || die "archive failed verification: $ARCHIVE"
log "wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# ── Retention ─────────────────────────────────────────────────
if [ "$RETAIN_DAYS" -gt 0 ]; then
	pruned=$(find "$BACKUP_DIR" -maxdepth 1 -name 'apex-backup-*.tar.gz' -mtime "+$RETAIN_DAYS" -print -delete | wc -l | tr -d ' ')
	[ "$pruned" -gt 0 ] && log "pruned $pruned archive(s) older than $RETAIN_DAYS days"
fi

log "done"
