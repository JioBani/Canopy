# Canopy 배포 가이드 (DEPLOY)

> Canopy 를 팀이 쓸 수 있게 인터넷에 배포하는 절차. **계정/콘솔 작업은 사용자만 가능**하므로 단계별로 정리했다.
> 코드측 준비(구글 로그인 활성화, Vercel 설정, env 구조)는 이미 완료돼 있다.

## 구성 한눈에
- **프론트**: Vite 빌드 → **Vercel**(무료) 정적 호스팅
- **백엔드/DB/인증**: **Supabase**(live 클라우드 프로젝트, 이미 생성됨 — ref `ztirywdmyttoqmrejjoy`)
- **로그인**: 프로덕션 = **구글 OAuth**(코드 활성화됨), 로컬 개발 = 이메일

> ⚠ 현재까지 개발/데모는 **로컬 Supabase(supabase start)** 로만 했고, **live 프로젝트엔 아직 스키마가 안 올라가 있다.** 배포의 핵심은 아래 A(스키마 적용)다.

---

## 사용자 액션 체크리스트

### A. live Supabase 에 스키마 적용  ★필수
1. [Supabase 대시보드](https://supabase.com/dashboard/project/ztirywdmyttoqmrejjoy) → 왼쪽 **SQL Editor** → **New query**
2. 프로젝트의 `supabase/migrations/0001_init.sql` **전체를 복사 → 붙여넣기 → Run(▶)**
   - 이 파일이 현재 스키마 단일 소스(테이블·트리거·뷰·RLS·시드함수 전부). 최신본을 올리면 됨.
3. "Success" 뜨면 끝. (에러 나면 메시지 캡처해서 알려주세요)

### B. 구글 OAuth 클라이언트 발급
1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성/선택 → **APIs & Services → Credentials**
2. **Create Credentials → OAuth client ID** → Application type = **Web application**
3. **Authorized redirect URIs** 에 추가:
   ```
   https://ztirywdmyttoqmrejjoy.supabase.co/auth/v1/callback
   ```
4. 생성된 **Client ID / Client Secret** 복사
5. (처음이면 OAuth consent screen 먼저 설정 — User Type: External, 앱 이름/이메일만 채우면 됨. 내부용이라 테스트 사용자에 팀원 이메일 추가하면 검수 없이 사용 가능)

### C. Supabase 에 구글 provider 연결
1. Supabase 대시보드 → **Authentication → Sign In / Providers → Google** → **Enable**
2. B 에서 받은 **Client ID / Secret** 입력 → Save

### D. Supabase Redirect URLs 등록
- Supabase → **Authentication → URL Configuration → Redirect URLs** 에 추가:
  ```
  http://localhost:5173
  https://<당신의-vercel-도메인>.vercel.app
  ```
  (Vercel 도메인은 E 단계에서 정해진 뒤 다시 와서 추가하면 됨)
- **Site URL** 도 배포 도메인으로 설정.
> 코드의 구글 로그인은 `redirectTo: window.location.origin` 이라, 여기 등록된 도메인이면 자동으로 맞춰진다.

### E. GitHub + Vercel 배포
1. **GitHub 저장소 생성** 후 이 프로젝트를 push. (`.env` 는 gitignore 라 키는 안 올라감 — 안전)
2. [Vercel](https://vercel.com) → **Add New → Project → Import** 그 GitHub 저장소
3. Framework = Vite 자동 감지 (vercel.json 있음). **Environment Variables** 에 추가:
   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://ztirywdmyttoqmrejjoy.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | (로컬 `.env` 의 anon/publishable key 값) |
4. **Deploy** → 배포 도메인이 나오면 **D 단계로 돌아가 그 도메인을 Supabase Redirect URLs / Site URL 에 추가**

### F. 배포 후 검증
1. 배포 도메인 접속 → **Google 계정으로 로그인** 동작 확인
2. 프로젝트 생성 → 트리/보드/대시보드 정상 동작 확인
3. 팀원들에게 도메인 공유 (구글 OAuth consent 가 "테스트" 모드면 팀원 이메일을 테스트 사용자에 추가)

---

## 코드측 준비 완료분 (참고)
- `LoginPage.tsx`: **구글 로그인 버튼 활성화됨** (이메일 로그인은 개발용으로 유지).
- `AuthProvider.signInWithGoogle()`: `redirectTo: window.location.origin` — 도메인 무관 동작.
- `vercel.json`: Vite + SPA rewrite 설정 완료.
- `supabase.ts`: 빌드는 `.env`(live) 사용, 로컬 데모/테스트는 `--mode e2e`(.env.e2e, 로컬 Supabase) — 분리됨.

## 주의
- `.env`(live 키)는 git 에 커밋 안 됨 → Vercel 환경변수로 별도 주입해야 함(E-3).
- anon key 는 공개용이라 프론트 노출 OK. **service_role 키는 절대 프론트/깃에 넣지 말 것.**
- 스키마를 바꾸면(개발 중 0001 변경 시) live 에도 다시 적용해야 반영됨.
- 로컬 데모의 구글 버튼은 로컬 Supabase 에 provider 가 없어 동작 안 함(정상) — 데모는 이메일 로그인.
