# Canopy CLI

> 다른 프로젝트 cwd에서 AI 에이전트가 설치하고 사용하는 방법은
> [canopy-agent-guide.md](canopy-agent-guide.md)를 참고한다.

AI 에이전트가 Canopy 실서버의 배포된 기능을 JSON 입출력으로 조작하는 CLI다.
프로젝트별 커스텀 필드 정의와 노드 필드값, 우선순위도 지원한다.

## 실행

```powershell
npm.cmd run canopy -- help
npm.cmd run canopy -- project list
```

CLI 자체가 전체 명령 계약을 제공한다. AI 에이전트는 외부 문서가 없어도 JSON 도움말을
읽어 기능과 안전 규칙을 파악할 수 있다.

```powershell
canopy help --json
canopy node --help
canopy node create --help
canopy priority set --help --json
```

패키지를 링크하거나 설치한 환경에서는 `canopy ...`로 실행할 수 있다.

### 로컬 통합 테스트

Docker와 로컬 Supabase를 띄운 뒤 CLI의 전체 CRUD는 로컬에서 검증한다. 테스트는 고유한
임시 프로젝트와 멤버를 만들고 성공/실패와 관계없이 마지막에 삭제한다.

```powershell
npx.cmd supabase start
npm.cmd run test:cli:local
```

접속값은 기본적으로 `.env.e2e`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 읽는다.
필요하면 `CANOPY_LOCAL_URL`, `CANOPY_LOCAL_KEY`로 덮어쓸 수 있다. 이 테스트는 live URL을
사용하지 않는다.

기본값은 현재 Canopy 실서버다. 다른 환경은 다음 환경변수 또는 같은 이름의 옵션을 쓴다.

```text
CANOPY_URL=https://.../rest/v1
CANOPY_KEY=...
--url <url> --key <key>
```

모든 성공/실패 출력은 JSON이다. 성공은 `{ "ok": true, "data": ... }`, 실패는
`{ "ok": false, "error": ... }` 형태이며 실패 시 종료 코드는 1이다.

## 다중 프로젝트 원칙

`member`를 제외한 모든 업무 데이터 명령은 `--project <UUID|정확한 이름>`을 요구한다.
이름이 중복되면 UUID를 쓰기 전에는 실행하지 않는다. 전달한 노드·UR·체크리스트·로그가
선택 프로젝트 소속인지 조회한 후 쓰기를 수행한다.

현재 DB에서 `member`는 프로젝트 FK가 없는 전역 리소스다.

```powershell
npm.cmd run canopy -- node list --project "Tactica Defense"
npm.cmd run canopy -- node get --project <PID> --id <NODE_ID>
```

## 전체 명령 표면

| 그룹 | 동작 |
|---|---|
| `project` | `list`, `get`, `create`, `update`, `delete` |
| `member` | `list`, `get`, `create`, `update`, `delete` |
| `status` | `list`, `create`, `update`, `reassign`, `delete` |
| `node` | `list`, `search`, `get`, `create`, `update`, `delete` |
| `ur-group` | `list`, `get`, `create`, `update`, `delete` |
| `ur` | `list`, `get`, `create`, `update`, `delete` |
| `ur-link` | `list`, `create`, `delete` |
| `checklist` | `list`, `get`, `create`, `update`, `delete` |
| `node-link` | `list`, `create`, `delete` |
| `work-log` | `list`, `get`, `start`, `stop`, `update`, `delete` |
| `field` | `list`, `get`, `create`, `update`, `delete` |
| `field-value` | `list`, `get`, `set`, `clear` |
| `priority` | `list`, `get`, `set`, `clear` |
| `report` | `progress`, `coverage` |
| `raw` | 허용 리소스의 `get`, `post`, `patch`, `delete` |

`node_progress`와 `ur_coverage`는 읽기 전용이다. `raw` 쓰기는 프로젝트 소유권 검증을
우회하므로 `--unsafe`가 추가로 필요하다.

## 대표 사용 예

```powershell
# 프로젝트 생성(기본 상태는 DB가 자동 생성)
npm.cmd run canopy -- project create --name "New Game"

# 상태와 트리
npm.cmd run canopy -- status list --project <PID>
npm.cmd run canopy -- node create --project <PID> --parent null --type 컨텐츠 --title "게임"
npm.cmd run canopy -- node create --project <PID> --parent <SUBFEATURE_ID> --type 작업 --title "전투 로직 구현" --domain 구현 --status <STATUS_ID>
npm.cmd run canopy -- node update --project <PID> --id <TASK_ID> --json '{"body":"상세 설명","assignee_id":"<MEMBER_ID>"}'

# UR과 작업 연결
npm.cmd run canopy -- ur-group create --project <PID> --feature <SUBFEATURE_ID> --name "전투"
npm.cmd run canopy -- ur create --project <PID> --feature <SUBFEATURE_ID> --group <GROUP_ID> --text "플레이어가 공격할 수 있다"
npm.cmd run canopy -- ur-link create --project <PID> --ur <UR_ID> --work <TASK_ID>
npm.cmd run canopy -- ur update --project <PID> --id <UR_ID> --json '{"status":"완료","misimpl_reason":null}'

# 체크리스트
npm.cmd run canopy -- checklist create --project <PID> --work <TASK_ID> --text "테스트 작성"
npm.cmd run canopy -- checklist update --project <PID> --id <ITEM_ID> --done true

# 선행조건/관련 링크
npm.cmd run canopy -- node-link create --project <PID> --from <NODE_ID> --to <OTHER_NODE_ID> --type blocks

# 작업 로그
npm.cmd run canopy -- work-log start --project <PID> --work <TASK_ID> --member <MEMBER_ID> --note "구현 시작"
npm.cmd run canopy -- work-log stop --project <PID> --id <LOG_ID>
npm.cmd run canopy -- work-log update --project <PID> --id <LOG_ID> --json '{"note":"구현 및 테스트 완료","duration_minutes":90}'

# 커스텀 필드 정의와 값
npm.cmd run canopy -- field list --project <PID>
npm.cmd run canopy -- field create --project <PID> --field-key qa_note --label "QA 메모" --type text --applies-to 작업
npm.cmd run canopy -- field-value set --project <PID> --node <TASK_ID> --field qa_note --value "회귀 테스트 필요"
npm.cmd run canopy -- field-value clear --project <PID> --node <TASK_ID> --field qa_note

# 우선순위(priority) 편의 명령
npm.cmd run canopy -- priority list --project <PID>
npm.cmd run canopy -- priority set --project <PID> --node <NODE_ID> --value 높음
npm.cmd run canopy -- priority get --project <PID> --node <NODE_ID>
npm.cmd run canopy -- priority clear --project <PID> --node <NODE_ID>

# 리포트
npm.cmd run canopy -- report progress --project <PID> --node <NODE_ID>
npm.cmd run canopy -- report coverage --project <PID> --feature <SUBFEATURE_ID>
```

## 안전장치

- 프로젝트 소속 리소스는 `--project`를 생략할 수 없다.
- 프로젝트 이름이 중복되면 UUID 없이는 실행하지 않는다.
- 모든 일반 수정·삭제는 단일 ID 또는 명확한 복합키로 필터링한다.
- 삭제는 `--yes`가 필요하다. 링크 해제는 복합키가 명확하므로 예외다.
- 프로젝트 삭제와 노드 삭제는 cascade 범위를 메시지로 경고한다.
- 티켓 번호는 DB 트리거가 발급하므로 CLI 입력으로 받지 않는다.
- 필드값 수정은 기존 `node.fields`를 읽어 병합하므로 다른 커스텀 값을 보존한다.
- `select`/`multiselect` 값, 필드 적용 노드 타입, 필수 필드는 CLI에서 검증한다.
