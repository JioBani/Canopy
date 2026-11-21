#!/bin/sh
# Canopy pull-based CD for miniserver.
#
# systemd timer 가 주기적으로 실행한다. origin/main 의 새 커밋이 있고
# GitHub Actions `ci` 워크플로의 job(build, backend-test)이 모두 성공했으면:
#   1) 해당 커밋을 export → node 컨테이너에서 실값 env 로 빌드
#   2) 미적용 supabase/migrations/*.sql 을 셀프호스트 DB 에 순서대로 적용
#   3) dist 를 releases/<sha> 로 복사 후 current 심링크를 원자적으로 교체
# 실패 시 current 는 그대로(이전 버전 유지). 로그는 journalctl -u canopy-deploy.
#
# 수동 실행: sh deploy.sh            (새 커밋 있을 때만)
#            sh deploy.sh --force    (CI 결과·배포 이력 무시하고 origin/main 재배포)
set -eu

REPO_SLUG="JioBani/Canopy"
REQUIRED_CHECKS="build backend-test"
BASE="$HOME/apps/canopy-deploy"
REPO="$BASE/repo"
WORK="$BASE/work"
STATE="$BASE/state"
ENV_FILE="$BASE/build.env"           # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
SITE="$HOME/apps/canopy-web/site"
DB_CONTAINER="supabase-db"
NODE_IMAGE="node:22-alpine"
KEEP_RELEASES=5

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

log() { echo "[canopy-deploy] $*"; }

mkdir -p "$STATE" "$WORK" "$SITE/releases"
exec 9>"$STATE/lock"
flock -n 9 || { log "another deploy is running"; exit 0; }

[ -d "$REPO/.git" ] || git clone -q "https://github.com/$REPO_SLUG.git" "$REPO"
git -C "$REPO" fetch -q origin main
SHA=$(git -C "$REPO" rev-parse origin/main)
SHORT=$(echo "$SHA" | cut -c1-7)

if [ "$FORCE" = 0 ]; then
  [ "$(cat "$STATE/deployed" 2>/dev/null)" = "$SHA" ] && exit 0
  [ "$(cat "$STATE/rejected" 2>/dev/null)" = "$SHA" ] && exit 0

  # CI 결과 확인 (공개 저장소 → 인증 불필요, 새 커밋일 때만 호출)
  RUNS=$(curl -fsS -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO_SLUG/commits/$SHA/check-runs?per_page=100") || {
    log "$SHORT: GitHub API unavailable, retry later"; exit 0; }
  for c in $REQUIRED_CHECKS; do
    R=$(printf '%s' "$RUNS" | jq -r --arg n "$c" \
      '[.check_runs[] | select(.name==$n)] | sort_by(.started_at) | last | "\(.status // "missing")/\(.conclusion // "none")"')
    case "$R" in
      completed/success) ;;
      completed/*) log "$SHORT: check '$c' = $R → not deploying"; echo "$SHA" > "$STATE/rejected"; exit 0 ;;
      *) log "$SHORT: check '$c' = $R → waiting"; exit 0 ;;
    esac
  done
fi

log "$SHORT: deploying"
SRC="$WORK/$SHORT"
rm -rf "$SRC"; mkdir -p "$SRC"
git -C "$REPO" archive "$SHA" | tar -x -C "$SRC"

# 1) build
mkdir -p "$BASE/npm-cache"
docker run --rm --env-file "$ENV_FILE" -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -e npm_config_cache=/cache -v "$BASE/npm-cache":/cache \
  -v "$SRC":/app -w /app "$NODE_IMAGE" \
  sh -c "npm ci --no-audit --no-fund --loglevel=error && npm run build" >"$STATE/build.log" 2>&1 || {
  log "$SHORT: build failed (see $STATE/build.log)"; echo "$SHA" > "$STATE/rejected"; exit 1; }

# 2) migrations (적용 이력: canopy_deploy.schema_migrations)
psql_db() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql_db -c "create schema if not exists canopy_deploy;
  create table if not exists canopy_deploy.schema_migrations(
    version text primary key, applied_at timestamptz not null default now());" >/dev/null
APPLIED=$(psql_db -At -c "select version from canopy_deploy.schema_migrations")
for f in $(ls "$SRC/supabase/migrations/"*.sql 2>/dev/null | sort); do
  V=$(basename "$f" .sql)
  echo "$APPLIED" | grep -qx "$V" && continue
  log "$SHORT: applying migration $V"
  { cat "$f"; printf '\ninsert into canopy_deploy.schema_migrations(version) values (%s);\n' "'$V'"; } \
    | psql_db -1 -f - >/dev/null || {
    log "$SHORT: migration $V failed → abort (site unchanged)"; echo "$SHA" > "$STATE/rejected"; exit 1; }
done
# PostgREST 스키마 캐시 갱신
psql_db -c "notify pgrst, 'reload schema';" >/dev/null

# 3) atomic swap
rm -rf "$SITE/releases/$SHORT"
cp -r "$SRC/dist" "$SITE/releases/$SHORT"
ln -sfn "releases/$SHORT" "$SITE/current.new"
mv -T "$SITE/current.new" "$SITE/current"
echo "$SHA" > "$STATE/deployed"
rm -f "$STATE/rejected"

# 정리: 오래된 release / 작업 디렉터리
ls -1t "$SITE/releases" | grep -v placeholder | tail -n +$((KEEP_RELEASES + 1)) | while read -r r; do rm -rf "$SITE/releases/$r"; done
rm -rf "$SRC"
log "$SHORT: deployed"
