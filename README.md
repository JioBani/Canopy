# Canopy

게임 기획 계층(컨텐츠 > 기능 > 세부기능/마스터데이터 > UR > 작업)을 관리하기 위한 내부용 Jira 대체 웹앱.

## 기술 스택

- **프론트엔드**: Vite + React 19 + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui (new-york, neutral)
- **백엔드/DB/인증**: Supabase (Postgres + 자동 REST API + Auth) — 별도 백엔드 앱 없음. 프론트가 `supabase-js` 로 DB 직접 호출.
- **인증**: 구글 로그인 전용 (`signInWithOAuth({ provider: "google" })`). 권한(role) 구분 없음, 로그인 여부만 검사.
- **배포**: Vercel(프론트) + Supabase 호스팅 (둘 다 무료 티어).

## 폴더 구조

```
custom jira/
├─ public/                 # 정적 에셋
├─ src/
│  ├─ auth/                # 인증 골격
│  │  ├─ AuthProvider.tsx  # 세션 context + 구글 로그인/로그아웃
│  │  ├─ RequireAuth.tsx   # 세션 가드 (미로그인 → LoginPage)
│  │  └─ LoginPage.tsx     # 구글 로그인 화면
│  ├─ components/ui/       # shadcn 컴포넌트 (button 등)
│  ├─ lib/
│  │  ├─ supabase.ts       # supabase-js 클라이언트 (.env 키 주입)
│  │  └─ utils.ts          # cn() 유틸
│  ├─ App.tsx              # RequireAuth + 대시보드 골격
│  ├─ main.tsx             # 진입점 (AuthProvider 래핑)
│  └─ index.css            # Tailwind v4 + shadcn 테마 토큰
├─ .env.example            # 환경변수 템플릿 (커밋됨)
├─ .env                    # 실제 키 (커밋 안 됨)
├─ components.json         # shadcn 설정
├─ vercel.json            # Vercel 배포 설정 (SPA rewrite 포함)
└─ vite.config.ts
```

> DB 스키마(테이블)는 아직 만들지 않았습니다. 데이터 모델은 기획서 확정 후 추가합니다.

## 1. 로컬 실행

```bash
npm install
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
# .env 에 Supabase URL / anon key 입력 (아래 2번 참고)
npm run dev
```

- 개발 서버: http://localhost:5173
- `.env` 의 키가 비어 있으면 콘솔에 경고가 뜨고 로그인은 동작하지 않습니다 (Supabase 연결 후 정상화).

스크립트:

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (HMR) |
| `npm run build` | 타입체크(`tsc -b`) 후 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | 타입체크만 (`tsc --noEmit`) |

## 2. Supabase 연결

1. https://supabase.com 에서 프로젝트 생성 (무료 티어).
2. **Project Settings > API Keys / Data API** 에서 다음을 복사해 `.env` 에 입력:
   - `VITE_SUPABASE_URL` ← Project URL
   - `VITE_SUPABASE_ANON_KEY` ← anon / public key
3. **구글 OAuth 설정** (Authentication > Sign In / Providers > Google):
   - Google Cloud Console 에서 OAuth 2.0 클라이언트 ID 생성.
     - 승인된 리디렉션 URI: `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
   - 발급된 Client ID / Client Secret 을 Supabase Google provider 에 입력 후 Enable.
4. **Redirect URLs** (Authentication > URL Configuration):
   - Site URL / Redirect URLs 에 로컬(`http://localhost:5173`)과 배포 도메인(`https://<your-app>.vercel.app`)을 등록.

> 코드의 로그인 리디렉트는 `window.location.origin` 을 사용하므로, 위 Redirect URLs 에 등록된 도메인이면 로컬·배포 모두 동작합니다.

## 2-1. DB 스키마 / 마이그레이션

스키마는 `supabase/migrations/0001_init.sql` 에 정의되어 있습니다 (기획서 §4~§7 기반).

적용 방법 (둘 중 하나):

```bash
# A) Supabase CLI
supabase link --project-ref <PROJECT-REF>
supabase db push

# B) 대시보드 SQL Editor 에 0001_init.sql 내용을 그대로 붙여넣고 Run
```

포함 내용:

- **테이블**: `project / member / status / node / ur_group / ur / ur_work_link / task_checklist / node_link`
- **enum**: 노드 타입(컨텐츠/기능/세부기능/마스터데이터/작업), 도메인(기획/디자인/사운드/구현/밸런싱/기타), 상태 카테고리(할일/진행중/완료/취소됨), 링크 타입(blocks/relates)
- **티켓 번호**: 노드 생성 시 `project.ticket_seq` 를 원자적으로 증가시켜 발급 (트리거). 티켓키는 앱에서 `key_prefix-ticket_number` 로 조합.
- **타입 문법 강제**: 부모-자식 규칙(§5) 위반 노드 insert/update 거부 (트리거).
- **기본 상태 시드**: 프로젝트 생성 시 4 카테고리 기본 상태 자동 삽입 (트리거 → `seed_default_statuses` 함수).
- **roll-up 뷰**: `node_progress`(노드별 하위 작업 완료율), `ur_coverage`(UR 별 연결/완료 작업 수, 미커버 여부).
- **RLS**: 전 테이블 enable + `authenticated`(로그인 사용자) 전부 허용.

### member 동기화 방식 (확정)

**Supabase `auth.users` 트리거 방식**을 채택했습니다. `auth.users` 에 INSERT/UPDATE 가 일어날 때
(`handle_auth_user_sync`, SECURITY DEFINER) `public.member` 로 자동 upsert 됩니다 — 구글 로그인 시
`id / email / display_name / avatar_url` 이 채워지며, **앱단에서 별도 upsert 코드가 필요 없습니다.**
(대안인 앱단 로그인 후 upsert 대비, 누락 위험 없이 DB 가 단일 진실원천이 되어 더 단순합니다.)

> ⚠️ `0001_init.sql` 은 아직 적용 전입니다. live 프로젝트 생성 후 위 절차로 한 번에 적용하세요.

## 3. 배포 (Vercel)

1. 이 저장소를 GitHub 등에 push.
2. https://vercel.com 에서 New Project → 저장소 import.
3. 프레임워크 자동 감지(Vite). 빌드 설정은 `vercel.json` 에 정의되어 있어 그대로 두면 됩니다.
4. **Environment Variables** 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가.
5. Deploy. 배포 후 도메인을 Supabase Redirect URLs (위 2-4) 에 추가.

## 테스트

테스트는 **로컬 Supabase(Docker)** 를 대상으로 돌립니다 — 실(.env) 프로젝트와 분리되어 데이터 오염이 없습니다.
`supabase start` 가 `supabase/migrations/` 를 로컬에 자동 적용하므로, live 적용 전에도 스키마 로직을 검증할 수 있습니다.

사전 준비 (한 번):

```bash
# Docker Desktop 실행 후
npx supabase start          # 로컬 스택 기동 (포트는 config.toml 에서 546xx 로 remap)
# 스키마를 새로 반영하려면:  npx supabase db reset
```

> ⚠️ Windows 예약 포트 충돌 회피를 위해 로컬 포트를 546xx 대역으로 옮겼습니다
> (API 54621 / DB 54622 / Studio 54623). `netsh interface ipv4 show excludedportrange protocol=tcp` 로 확인 가능.

### 백엔드 E2E (feature 테스트, vitest)

트리거/뷰/RLS 등 **비자명 DB 로직**을 검증합니다: 티켓 번호 원자 발급(동시성), 타입 문법 강제,
UR/링크 타입 가드, 기본 상태 자동 시드, `node_progress`/`ur_coverage` 뷰 정확성, RLS, member 동기화.

```bash
npm run test:backend        # tests/backend/**  (로컬 Supabase 필요)
```

### 프론트 E2E (Playwright)

`--mode e2e` 로 dev 서버를 띄워 `.env.e2e`(로컬 Supabase) 를 주입하고 브라우저로 검증합니다.
현재: 회원가입 → 인증 셸 진입 → 로그아웃 → 재로그인 → 로그인 실패 에러.

```bash
npm run test:e2e            # tests/e2e/**  (로컬 Supabase 필요, dev 서버는 자동 기동)
```

## shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component>   # 예: npx shadcn@latest add card dialog input
```

설정은 `components.json` 에 있으며 별칭(`@/components`, `@/lib/utils` 등)이 잡혀 있습니다.
