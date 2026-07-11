# AI 에이전트용 Canopy CLI 안내서

이 문서는 AI 에이전트가 **Canopy 웹앱 저장소가 아닌 다른 프로젝트 cwd**에서 Canopy CLI를
발견하고 안전하게 사용하는 방법을 설명한다. Windows PowerShell과 WSL을 모두 다룬다.

## 1. 에이전트가 가장 먼저 할 일

```text
1. canopy help --json을 읽는다.
2. canopy project list로 프로젝트 UUID를 확인한다.
3. 이후 모든 프로젝트 명령에 --project <UUID>를 명시한다.
4. live 쓰기 전에 get/list/search로 대상과 현재 값을 확인한다.
5. raw 쓰기는 사용하지 않는다.
```

CLI 출력은 성공과 실패 모두 JSON이다. 자동화할 때 사람용 텍스트를 파싱하지 말고 기본 JSON
출력을 사용한다.

```json
{"ok":true,"data":[]}
{"ok":false,"error":"..."}
```

## 2. Windows 설치

요구사항:

- Node.js 18 이상(Node.js 22 권장)
- Canopy 저장소 로컬 체크아웃

Canopy 저장소에서 한 번 전역 링크한다.

```powershell
cd "C:\Project\custom jira"
npm.cmd link
canopy.cmd help --json
```

PowerShell 실행 정책이 npm의 `.ps1` shim을 막는 환경에서는 `canopy` 대신 `canopy.cmd`를
사용한다. `npm`도 같은 이유로 `npm.cmd`를 권장한다.

설치 확인:

```powershell
Get-Command canopy.cmd
canopy.cmd project list
```

이제 다른 프로젝트에서도 cwd와 무관하게 실행할 수 있다.

```powershell
cd "C:\Project\my-game"
canopy.cmd node search --project <PROJECT_UUID> --query "전투"
```

## 3. WSL 설치

Windows에 설치한 npm 전역 명령을 WSL에서 그대로 호출하지 않는다. WSL의 Node.js/npm으로
별도 링크하는 편이 경로와 셸 호환성이 안정적이다.

요구사항:

```bash
node --version
npm --version
```

전역 npm 디렉터리에 쓰기 권한이 없다면 사용자 디렉터리를 prefix로 사용한다.

```bash
mkdir -p "$HOME/.local"
npm config set prefix "$HOME/.local"
grep -q 'HOME/.local/bin' "$HOME/.profile" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.profile"
export PATH="$HOME/.local/bin:$PATH"
```

Windows 드라이브에 있는 Canopy 저장소를 WSL에서 링크한다.

```bash
cd "/mnt/c/Project/custom jira"
npm link
canopy help --json
```

다른 WSL 프로젝트 cwd에서:

```bash
cd ~/projects/my-game
canopy node search --project <PROJECT_UUID> --query "전투"
```

CLI 본체는 Node 표준 API만 사용하므로 Windows 체크아웃을 WSL에서 링크해도 별도 네이티브
모듈 빌드가 필요 없다.

## 4. live 환경 사용

별도 설정이 없으면 CLI는 현재 Canopy live PostgREST를 사용한다.

```powershell
canopy.cmd project list
```

```bash
canopy project list
```

프로젝트 이름도 받을 수 있지만 여러 프로젝트에서 이름이 중복될 수 있으므로 AI 에이전트는
반드시 UUID 사용을 우선한다.

```bash
canopy node list --project c619af71-7679-4865-831f-4194178c43b4
```

live 쓰기 전에는 현재 값을 먼저 조회한다.

```bash
canopy node get --project <PROJECT_UUID> --id <NODE_UUID>
canopy priority set --project <PROJECT_UUID> --node <NODE_UUID> --value 높음
canopy priority get --project <PROJECT_UUID> --node <NODE_UUID>
```

## 5. Windows에서 로컬 Supabase 사용

Canopy 저장소에서 Docker 기반 로컬 스택을 실행한다.

```powershell
cd "C:\Project\custom jira"
npx.cmd supabase start
```

`.env.e2e` 값을 현재 PowerShell 세션에 CLI 환경변수로 주입한다.

```powershell
$envFile = Get-Content .env.e2e | Where-Object { $_ -match '^[^#].*=' }
$values = @{}
foreach ($line in $envFile) {
  $name, $value = $line -split '=', 2
  $values[$name] = $value.Trim('"', "'")
}
$env:CANOPY_URL = "$($values['VITE_SUPABASE_URL'])/rest/v1"
$env:CANOPY_KEY = $values['VITE_SUPABASE_ANON_KEY']

canopy.cmd project list
```

CLI 전체 통합 테스트는 `.env.e2e`를 자동으로 읽으며 임시 프로젝트와 멤버를 마지막에 삭제한다.

```powershell
npm.cmd run test:cli:local
```

live로 돌아가려면 현재 세션의 재정의 값을 제거한다.

```powershell
Remove-Item Env:CANOPY_URL -ErrorAction SilentlyContinue
Remove-Item Env:CANOPY_KEY -ErrorAction SilentlyContinue
```

## 6. WSL에서 로컬 Supabase 사용

Docker Desktop과 Supabase는 Windows에서 실행해도 되고 WSL 통합 환경에서 실행해도 된다.
먼저 Canopy 저장소에서 로컬 스택을 기동한다.

```bash
cd "/mnt/c/Project/custom jira"
npx supabase start
```

`.env.e2e`를 읽어 CLI 접속값을 설정한다.

```bash
set -a
source <(sed 's/\r$//' .env.e2e)
set +a
export CANOPY_URL="${VITE_SUPABASE_URL}/rest/v1"
export CANOPY_KEY="${VITE_SUPABASE_ANON_KEY}"

canopy project list
```

WSL2에서 `127.0.0.1:54621` 연결이 되지 않는 경우:

1. Docker Desktop의 WSL integration이 해당 배포판에 활성화됐는지 확인한다.
2. Windows와 WSL 양쪽에서 `http://127.0.0.1:54621` 접근을 확인한다.
3. 필요하면 WSL 내부에서 `npx supabase start`를 실행해 같은 환경 안에 포트를 연다.

통합 테스트:

```bash
npm run test:cli:local
```

## 7. AI가 도움말을 탐색하는 방법

외부 Markdown을 명령 계약으로 간주하지 않는다. 최신 계약의 source of truth는 설치된 CLI의
도움말이다.

```bash
# 전체 기능, 옵션, 안전 규칙을 구조화된 JSON으로
canopy help --json

# 그룹별 도움말
canopy node --help
canopy work-log --help
canopy field-value --help

# 동작별 도움말
canopy node create --help
canopy priority set --help

# 특정 동작의 기계 판독용 도움말
canopy priority set --help --json
```

에이전트는 모르는 옵션을 추측하지 말고 해당 동작의 `--help`를 먼저 호출한다.

## 8. 자주 사용하는 작업

```bash
# 프로젝트와 트리 파악
canopy project list
canopy node list --project <PROJECT_UUID>
canopy node search --project <PROJECT_UUID> --query "검색어"

# 작업 시작과 기록
canopy node get --project <PROJECT_UUID> --id <TASK_UUID>
canopy work-log start --project <PROJECT_UUID> --work <TASK_UUID> --note "구현 시작"
canopy work-log stop --project <PROJECT_UUID> --id <LOG_UUID>

# 상태와 우선순위
canopy status list --project <PROJECT_UUID>
canopy node update --project <PROJECT_UUID> --id <TASK_UUID> --json '{"status_id":"<STATUS_UUID>"}'
canopy priority set --project <PROJECT_UUID> --node <TASK_UUID> --value 높음

# 체크리스트
canopy checklist create --project <PROJECT_UUID> --work <TASK_UUID> --text "테스트 작성"
canopy checklist update --project <PROJECT_UUID> --id <ITEM_UUID> --done true
```

Windows PowerShell에서는 위 예제의 `canopy`를 `canopy.cmd`로 바꾸면 된다. JSON 문자열 quoting이
복잡한 수정은 `--json` 대신 전용 named option이 있는지 먼저 `--help`로 확인한다.

## 9. 프로젝트 저장소에 넣을 최소 안내

프로젝트의 `AGENTS.md`, `CLAUDE.md` 또는 동등한 에이전트 지침에 다음 정도만 둔다.

```markdown
## Canopy

- 프로젝트 관리에는 전역 설치된 `canopy` CLI를 사용한다.
- 작업 시작 전 `canopy help --json`으로 최신 명령 계약을 확인한다.
- 이 저장소의 Canopy 프로젝트 UUID는 `<PROJECT_UUID>`다.
- 모든 명령에 `--project <PROJECT_UUID>`를 명시한다.
- live 쓰기 전 현재 대상을 조회하고, `raw` 쓰기는 사용하지 않는다.
```

전체 CLI 설명을 프로젝트마다 복사할 필요는 없다. 프로젝트 지침에는 **CLI 발견 방법과 프로젝트
UUID만** 두고, 상세 옵션은 CLI 내장 도움말에서 읽는다.

## 10. 안전 규칙

- live에서 변경 전 반드시 `get`, `list`, `search`로 현재 상태를 확인한다.
- 프로젝트 이름보다 UUID를 사용한다.
- `delete`의 `--yes`는 삭제 대상을 확인한 뒤에만 사용한다.
- `raw post/patch/delete --unsafe`는 정상 명령으로 표현할 수 없는 관리 작업이 아니면 사용하지 않는다.
- 프로젝트 삭제와 상위 노드 삭제는 하위 데이터가 cascade 삭제될 수 있다.
- 테스트는 `CANOPY_URL`과 `CANOPY_KEY`를 로컬로 설정하거나 `npm run test:cli:local`을 사용한다.

