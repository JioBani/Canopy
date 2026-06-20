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

## 3. 배포 (Vercel)

1. 이 저장소를 GitHub 등에 push.
2. https://vercel.com 에서 New Project → 저장소 import.
3. 프레임워크 자동 감지(Vite). 빌드 설정은 `vercel.json` 에 정의되어 있어 그대로 두면 됩니다.
4. **Environment Variables** 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가.
5. Deploy. 배포 후 도메인을 Supabase Redirect URLs (위 2-4) 에 추가.

## shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component>   # 예: npx shadcn@latest add card dialog input
```

설정은 `components.json` 에 있으며 별칭(`@/components`, `@/lib/utils` 등)이 잡혀 있습니다.
