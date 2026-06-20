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

## 둘러보기 (데모 — 로컬 Supabase)

실(live) Supabase 없이, **로컬 Supabase(Docker)** 에 스키마를 자동 적용해 바로 핵심 기능을 둘러봅니다.
(실 프로젝트 `.env` 와 분리되어 데이터 오염이 없습니다.)

```bash
# 0) 최초 1회
npm install

# 1) Docker Desktop 실행 후 — 로컬 Supabase 기동(스키마 자동 적용)
npx supabase start

# 2) 데모 서버 (로컬 Supabase 에 연결된 모드로 실행)
npm run demo
```

> `npm run demo` 는 `supabase start`(이미 떠 있으면 통과) 후 `vite --mode e2e` 를 띄웁니다.
> 접속: **http://localhost:5173**

### 무엇을 보면 되나

1. **로그인** — 아무 이메일 + 비밀번호(6자+)로 "회원가입" (로컬은 이메일 확인 off라 즉시 로그인).
2. **프로젝트 생성** — 이름 + 키 프리픽스(예 `TD`) 입력. 기본 상태 4종이 자동 생성됩니다.
3. **트리 만들기** — 좌측에서 컨텐츠 → 기능 → 세부기능 → 작업을 인라인 추가([+], 제목 입력 후 Enter).
   타입 문법이 강제되어 **허용된 자식 타입만** 추가됩니다.
4. **핵심 — 가시성 루프**: 작업을 클릭해 우측 상세에서 **상태를 '완료'로** 바꾸면,
   상위(세부기능·기능·컨텐츠)의 **진행바가 새로고침 없이 즉시 차오릅니다.** 작업 행 상태 뱃지 색도 바뀝니다.
5. 그 외: 노드 이름변경(더블클릭)·삭제(하위 cascade 확인), 작업의 도메인·작업자 지정, 설명 마크다운 미리보기.

> 데모를 멈추려면 서버 종료(Ctrl+C) 후 `npm run demo:stop`(=`supabase stop`, 데이터 보존) 또는 그대로 두면 됩니다.

### "사이트에 연결할 수 없음"(localhost:5173 접속 안 됨)일 때

거의 항상 **vite 가 아직/전혀 안 뜬 것**입니다. 터미널을 먼저 확인하세요.

1. **vite 가 떴는지** — 터미널에 `➜  Local:   http://localhost:5173/` 줄이 보여야 접속 가능합니다. 안 보이면 아직 준비 중이거나 실패한 것.
2. **첫 실행은 수 분** — `npx supabase start` 가 최초 1회 Docker 이미지를 내려받아 오래 걸립니다. `supabase local development setup is running` 메시지(또는 표)가 나온 뒤에야 `npm run demo` 의 vite 가 뜹니다. 그 줄이 나올 때까지 기다리세요.
3. **Docker Desktop 이 완전히 켜졌는지** — 트레이 아이콘이 "Running" 이어야 함. 초기화 중이면 `supabase start` 가 실패하고, 그러면 vite 도 안 뜹니다. Docker 준비 후 `npm run demo` 다시.
4. **포트 5173 점유** — 다른 vite/앱이 5173 을 쓰면 `Port 5173 is already in use` 로 실패합니다(자동으로 다른 포트로 옮기지 않도록 고정해 둠). 기존 dev 서버를 끄고 다시 실행하세요.
5. 위가 다 정상인데도 안 되면 `npx supabase status` 로 API 가 `http://127.0.0.1:54621` 에 떠 있는지 확인하세요.

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
| `npm run dev` | 개발 서버 (HMR, `.env` = live) |
| `npm run demo` | 로컬 Supabase 기동 후 데모 서버(`--mode e2e`, 로컬 DB) |
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
