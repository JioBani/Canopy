# Canopy 데이터 조작 가이드 (AI 에이전트용)

Canopy 의 Supabase(PostgREST) 를 **직접 읽고 쓰는** 데 필요한 모든 것. 이 문서 한 장으로 조작 가능하도록 정확·간결하게 정리했다. 데이터는 anon 으로 열려 있어(마이그레이션 0002) URL + anon key 로 REST 직접 호출하면 된다.

> 용어: **노드 트리** = 컨텐츠 > 기능 > (세부기능 | 마스터데이터) > 작업. **UR**(요구사항)은 **세부기능**이 소유.

---

## 1. 접속

| 항목 | 값 |
|---|---|
| REST base URL | `https://ztirywdmyttoqmrejjoy.supabase.co/rest/v1` |
| anon key | `sb_publishable_CBdM6CqfFnG_H_ynwkHenA_EEu9x8_9` |

**필수 헤더**
```
apikey: <anon key>
Authorization: Bearer <anon key>
Content-Type: application/json      # 쓰기(POST/PATCH)에 필요
Prefer: return=representation       # 쓰기 후 생성/수정된 행을 응답으로 받고 싶을 때
```

PostgREST 쿼리 문법: `?select=col1,col2`, 필터 `?col=eq.값` / `in.(a,b)` / `gte.` 등, 정렬 `?order=col.asc`, 제한 `?limit=10`.
⚠ **한글 enum 값(작업·세부기능·완료 등)은 URL 인코딩** 해야 한다. 예: `type=eq.작업` → `type=eq.%EC%9E%91%EC%97%85`.

**읽기 예시**
```bash
curl "$BASE/project?select=id,name" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

**쓰기 예시(생성)**
```bash
curl -X POST "$BASE/node" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"project_id":"<PID>","parent_id":"<SUB_ID>","type":"작업","title":"새 작업"}'
```

**수정/삭제**
```bash
curl -X PATCH "$BASE/node?id=eq.<NODE_ID>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"title":"수정된 제목"}'
curl -X DELETE "$BASE/node?id=eq.<NODE_ID>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
⚠ PATCH/DELETE 는 **필터 없으면 전 행 대상**이다. 항상 `?id=eq.…` 같은 필터를 붙여라.

---

## 2. 테이블 스키마 (현행)

### enum
- `node_type`: `컨텐츠` `기능` `세부기능` `마스터데이터` `작업`
- `node_domain`: `기획` `디자인` `사운드` `구현` `밸런싱` `기타`
- `status_category`: `할일` `진행중` `완료` `취소됨`
- `ur_status`: `완료` `미구현` `오구현`
- `node_link_type`: `blocks` `relates`

### project
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| name | text | 프로젝트명 (예: `Tactica Defense`) |

> project 에는 프리픽스 컬럼이 **없다**(티켓키는 타입 기반). insert 시 4개 기본 상태가 자동 시드된다(§3).

### node — 트리의 모든 노드 (type 으로 구분)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK→project | 필수 |
| parent_id | uuid FK→node (nullable) | 컨텐츠는 null, 그 외 필수 |
| type | node_type | 트리거가 부모-자식 규칙 강제 (§3) |
| ticket_number | int | **트리거 자동 발급. 직접 넣지 마라** |
| title | text | 필수 |
| body | text | 설명(마크다운), 모든 노드 공통 |
| sort_order | int | 형제 정렬 |
| status_id | uuid FK→status | 전 타입 사용. 신규 기본=할일 |
| domain | node_domain (nullable) | 주로 작업 |
| assignee_id | uuid FK→member (nullable) | 담당자 |

티켓키 표기 = `{Type}-{ticket_number}`: 컨텐츠=`Content` 기능=`Feature` 세부기능=`SubFeature` 마스터데이터=`MasterData` 작업=`Task`. 번호는 **프로젝트·타입별 독립 카운터**(Content-1, Feature-1…).

### status — 프로젝트별 커스텀 상태
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK→project | |
| name | text | 표시 이름 |
| category | status_category | 보드/롤업 기준 4종 |
| color | text (nullable) | 뱃지 색 |
| sort_order | int | |

### ur — 사용자 요구사항 (**세부기능 소유**)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| feature_id | uuid FK→node | **컬럼명은 feature_id 지만 값은 세부기능 노드**(트리거 강제) |
| ur_group_id | uuid FK→ur_group (nullable) | 그룹(선택), null=미분류 |
| ticket_number | int | **트리거 자동 발급**(키=`Requirement-{n}`, 프로젝트 단위) |
| text | text | 요구사항 원문 |
| status | ur_status | `완료`/`미구현`/`오구현` (수동 지정, 자동계산 아님) |
| misimpl_reason | text (nullable) | 오구현 사유 |
| sort_order | int | |

### ur_group — UR 묶음 (세부기능 소유)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| feature_id | uuid FK→node | **세부기능 노드**(트리거 강제) |
| name | text | |
| sort_order | int | |

### ur_work_link — UR ↔ 작업 (M:N)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| ur_id | uuid FK→ur | |
| work_id | uuid FK→node | **작업 노드여야 함**(트리거 강제) |
| | | `unique(ur_id, work_id)` |

### task_checklist — 작업내용(체크리스트)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| work_id | uuid FK→node | 작업 노드 |
| text | text | |
| done | boolean | 기본 false |
| sort_order | int | |

### node_link — 노드 간 링크(선제조건 등)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| from_node_id | uuid FK→node | |
| to_node_id | uuid FK→node | from≠to |
| type | node_link_type | `blocks`(선제조건) / `relates` |
| | | `unique(from_node_id, to_node_id, type)` |

### member — 팀원 (auth 연동)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | auth.users.id |
| email / display_name / avatar_url | text | |

> 현재 로그인 게이트가 없어(anon 운영) member 는 비어 있을 수 있다. assignee_id 는 member 가 있을 때만 지정.

---

## 3. 자동/강제 동작 (어기면 insert 실패)

1. **타입 문법(트리거가 거부)** — 부모-자식 규칙:
   - `컨텐츠`: parent_id = **null**(최상위). 자식 = 기능.
   - `기능`: 부모 = 컨텐츠. 자식 = 세부기능 | 마스터데이터.
   - `세부기능`: 부모 = 기능. 자식 = 작업.
   - `마스터데이터`: 부모 = 기능. 자식 = 작업.
   - `작업`: 부모 = 세부기능 | 마스터데이터. 자식 없음(잎).
   - 부모는 **같은 project_id** 여야 함.
2. **티켓 번호 자동 발급**: node.ticket_number / ur.ticket_number 는 BEFORE INSERT 트리거가 타입별·프로젝트별 카운터로 부여. **payload 에 ticket_number 를 넣지 마라**(넣어도 덮어써지거나 카운터와 어긋남).
3. **기본 상태**: project insert 시 4개 상태(할일/진행중/완료/취소됨)가 자동 생성. 노드 생성 시 status_id 를 생략하면 null 이므로, 보통 해당 프로젝트의 `category=할일` status.id 를 조회해 넣는다.
4. **UR/링크 대상 가드**: `ur.feature_id`·`ur_group.feature_id` = 세부기능, `ur_work_link.work_id` = 작업이어야 함(트리거 강제).
5. **읽기 전용 뷰** (insert/update 금지, 조회만):
   - `node_progress(node_id, total_urs, done_urs, progress)` — 노드 하위(자신 포함) **UR 완료율** roll-up. UR 없으면 progress=null.
   - `ur_coverage(ur_id, feature_id, ur_group_id, linked_work_count, done_work_count, is_uncovered)` — UR별 연결 작업 수. **미커버 = 연결 0 AND status≠완료**.

---

## 4. 자주 쓰는 작업 (REST 그대로)

환경: `BASE=https://ztirywdmyttoqmrejjoy.supabase.co/rest/v1`, `KEY=<anon key>`, 헤더는 §1.

**(a) 프로젝트 + 트리 조회**
```bash
# 프로젝트
curl "$BASE/project?select=id,name" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
# 한 프로젝트의 전체 노드(트리). parent_id 로 계층 재구성.
curl "$BASE/node?project_id=eq.<PID>&select=id,parent_id,type,ticket_number,title,status_id,sort_order&order=sort_order" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

**(b) 세부기능의 UR 목록 읽기**
```bash
curl "$BASE/ur?feature_id=eq.<SUB_ID>&select=id,ticket_number,text,status,misimpl_reason,ur_group_id,sort_order&order=sort_order" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

**(c) 세부기능 밑에 작업 생성** (ticket_number 생략 → 자동 `Task-N`)
```bash
curl -X POST "$BASE/node" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"project_id":"<PID>","parent_id":"<SUB_ID>","type":"작업","title":"로직 구현","domain":"구현","status_id":"<할일 status id>"}'
```
> `<할일 status id>`: `curl "$BASE/status?project_id=eq.<PID>&category=eq.%ED%95%A0%EC%9D%BC&select=id"`

**(d) 작업 ↔ UR 링크 (M:N)**
```bash
curl -X POST "$BASE/ur_work_link" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"ur_id":"<UR_ID>","work_id":"<WORK_NODE_ID>"}'
```

**(e) 작업내용(체크리스트) 추가 / 체크**
```bash
curl -X POST "$BASE/task_checklist" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"work_id":"<WORK_NODE_ID>","text":"엔티티 설계","sort_order":0}'
# 완료 체크
curl -X PATCH "$BASE/task_checklist?id=eq.<ITEM_ID>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"done":true}'
```

**(f) 작업 상태 변경**
```bash
# 대상 카테고리의 status.id 조회 후 지정 (예: 진행중)
curl -X PATCH "$BASE/node?id=eq.<WORK_NODE_ID>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"status_id":"<진행중 status id>"}'
```

**(g) UR 상태/사유 변경**
```bash
curl -X PATCH "$BASE/ur?id=eq.<UR_ID>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"오구현","misimpl_reason":"무엇이 어떻게 잘못 구현됐는지"}'
```

**(h) 진행률 / 커버리지 조회(뷰)**
```bash
curl "$BASE/node_progress?node_id=eq.<NODE_ID>&select=total_urs,done_urs,progress" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
curl "$BASE/ur_coverage?feature_id=eq.<SUB_ID>&select=ur_id,linked_work_count,is_uncovered" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

---

## 5. 하지 말 것

- ❌ `ticket_number` 수동 설정 (node·ur 둘 다 — 트리거가 부여).
- ❌ 타입 문법 위반 insert (예: 컨텐츠에 parent_id 지정, 작업을 기능 밑에 생성, 작업의 자식 생성).
- ❌ `ur.feature_id` 에 세부기능 아닌 노드, `ur_work_link.work_id` 에 작업 아닌 노드 지정.
- ❌ `node_progress` / `ur_coverage` 뷰에 write 시도(읽기 전용).
- ❌ PATCH/DELETE 를 필터 없이 호출(전 행 영향).
- ❌ project 에 key_prefix 등 없는 컬럼 전송.

---

### 검증 메모
이 문서의 읽기 예시는 live(anon)에서 동작 확인했다(project/node/ur/node_progress 조회 성공). 쓰기 동작(트리거 번호 발급·타입 가드·기본 상태 시드)은 로컬 스택의 자동화 테스트(vitest backend + Playwright E2E)로 검증되어 있다. 프로덕션 쓰기는 위 예시 그대로 동작하나, 파괴적 변경은 주의해서 수행할 것.
