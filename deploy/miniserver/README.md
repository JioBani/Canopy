# Canopy on miniserver (self-hosted)

Vercel + Supabase 클라우드를 대체하는 미니PC 셀프호스트 구성.

| 구성요소 | 위치 (miniserver) | 노출 |
|---|---|---|
| 프론트 (nginx, 정적) | `~/apps/canopy-web` → `127.0.0.1:8101` | https://canopy.lnk.sarl |
| Supabase (db·auth·rest·studio·meta·envoy) | `~/apps/canopy-supabase` → `127.0.0.1:8100` | https://canopy-api.lnk.sarl (`/rest/v1/`, `/auth/v1/` 만) |
| Cloudflare Tunnel | `/etc/cloudflared/config.yml` (systemd `cloudflared`) | — |
| 배포기 | `~/apps/canopy-deploy` (systemd `canopy-deploy.timer`) | — |

Studio(관리 화면)는 외부에 노출하지 않는다. 접속: `ssh -L 8100:127.0.0.1:8100 mini` 후 http://localhost:8100
(계정: `~/apps/canopy-supabase/.env` 의 `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`).

## CI/CD 흐름
1. `main` push → GitHub Actions `ci` (`build`: 타입체크+빌드, `backend-test`: 로컬 Supabase 에 전 마이그레이션 적용 + 백엔드 테스트)
2. 미니PC `canopy-deploy.timer` 가 2분마다 `origin/main` 확인 → 두 job 모두 성공한 새 커밋이면 `deploy.sh` 가
   빌드 → 미적용 마이그레이션 적용(`canopy_deploy.schema_migrations` 로 이력 관리) → `current` 심링크 원자 교체
3. 실패 시 사이트는 이전 버전 유지. 공개 저장소이므로 GitHub 에 배포 비밀값/러너를 두지 않는 pull 방식.

## 운영 명령 (miniserver)
```sh
journalctl -u canopy-deploy -n 50          # 배포 로그
sh ~/apps/canopy-deploy/deploy.sh --force  # 즉시 재배포 (CI 무시)
cat ~/apps/canopy-deploy/state/deployed    # 현재 배포 커밋
# 롤백: 이전 release 로 심링크만 교체
ls ~/apps/canopy-web/site/releases; ln -sfn releases/<sha> ~/apps/canopy-web/site/current
cd ~/apps/canopy-supabase && sh run.sh status   # Supabase 상태
```

## 설치 (최초 1회)
```sh
mkdir -p ~/apps/canopy-deploy && cp deploy.sh ~/apps/canopy-deploy/
# build.env: VITE_SUPABASE_URL=https://canopy-api.lnk.sarl , VITE_SUPABASE_ANON_KEY=<canopy-supabase/.env 의 ANON_KEY>
sudo cp canopy-deploy.service canopy-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now canopy-deploy.timer
```
`deploy.sh` 를 수정하면 미니PC 의 사본도 다시 복사할 것.

## 주의
- Docker 기본 네트워크 대역이 소진된 호스트라 `canopy-web` 은 `canopy-supabase_default` 네트워크에 붙는다.
- Supabase 업그레이드: `~/apps/canopy-supabase` 에서 백업 후 `sh update.sh` (README 참고). Canopy 오버라이드는 `docker-compose.canopy.yml`.
- 마이그레이션은 additive 로 작성 (배포 중 구버전 프론트가 잠시 새 스키마를 본다).
