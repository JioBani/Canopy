# Handoff: 요구사항–작업 목록 (Requirements & Tasks List)

## Overview
사용자 요구사항(Requirement)을 섹션별로 묶어 보여주고, 각 요구사항을 펼치면 **요구사항 본문**과 그 요구사항을 만족시키는 **작업(Task)** 목록을 표시하는 아코디언형 리스트 UI. 기존 UI의 두 가지 문제(① 미리보기와 본문이 중복되어 헷갈림, ② 요구사항 본문과 작업의 경계가 모호함)를 해결한 개선본이다.

## About the Design Files
이 번들의 `Requirements.dc.html` 은 **HTML로 만든 디자인 레퍼런스**다. 의도한 룩앤필과 동작을 보여주는 프로토타입이며, 그대로 복사해 프로덕션에 넣는 코드가 아니다. 목표는 **이 디자인을 대상 React 코드베이스의 기존 환경(컴포넌트, 스타일링 방식, 아이콘 라이브러리)으로 재현**하는 것이다. 파일을 열어 실제 인터랙션(섹션/요구사항 펼치기·접기, 작업 체크)을 직접 확인할 수 있다.

> 파일 여는 법: `Requirements.dc.html` 은 별도 빌드 없이 브라우저에서 바로 열린다.

## Fidelity
**High-fidelity (hifi)** — 최종 색상·타이포·간격·인터랙션이 확정된 목업이다. 아래 스펙의 hex/px 값을 그대로 사용해 픽셀 단위로 재현할 것. 단, 아이콘·폰트·컴포넌트 primitive는 코드베이스에 이미 있는 것으로 대체해도 된다(모양만 일치시키면 됨).

## 핵심 개선 포인트 (반드시 지킬 것)
1. **미리보기 ↔ 본문 중복 제거**
   - 접힌 상태: 헤더 한 줄에 `Requirement-N` 배지 + 본문 **1줄 미리보기(말줄임 `…`)**.
   - 펼친 상태: 헤더의 미리보기 텍스트를 **없애고** `"요구사항 상세"` 라벨로 대체한다. 본문 전문은 아래 상세 영역의 **"요구사항 본문" 카드 한 곳에만** 나타난다 → 텍스트가 두 번 보이지 않는다.
2. **본문 ↔ 작업 경계 명확화**
   - 펼친 상세 영역은 좌측에 **세로 커넥터 라인**(2px, `#EDE1E9`)을 두어 "이 내용이 해당 요구사항에 속함"을 시각화한다.
   - **요구사항 본문**은 로즈 틴트 카드(`#FDF3F8`), **작업**은 흰색 카드(`#FFFFFF` + `#E7ECF3` 보더)로 서로 다른 배경/보더를 써서 확실히 구분한다.
   - 각 영역 위에 작은 라벨 헤딩(`요구사항 본문` / `만족시키는 작업 [count]`)을 둔다.

## Screens / Views

### View: Requirements List (단일 뷰)
- **Purpose**: 요구사항을 섹션별로 훑고, 개별 요구사항의 상세·작업 진행 상황을 확인/토글.
- **Layout**:
  - 페이지 배경 `#F4F6F9`. 콘텐츠 컨테이너 `max-width: 1000px`, 가운데 정렬, `padding: 28px 20px 80px`.
  - 리스트 카드: `background:#FFFFFF`, `border:1px solid #E6EAF0`, `border-radius:14px`, `box-shadow:0 1px 2px rgba(20,30,50,.04)`, `overflow:hidden`.
  - 구조: 카드 안에 **섹션들** → 각 섹션 안에 **요구사항 행들** → 각 요구사항 아래 **펼침 상세**.

#### Component: Section Header (섹션 헤더)
- 예: `공통체계`, `스탯구조`, `수정자`.
- Layout: `display:flex; align-items:center; gap:8px; padding:14px 20px; cursor:pointer`. 섹션 간 상단 구분선 `border-top:1px solid #EEF1F6`.
- 요소(좌→우):
  - Caret 아이콘 14px, stroke `#5A6675`, stroke-width 2.4. 열림=아래꺾쇠(chevron-down), 닫힘=오른쪽꺾쇠(chevron-right).
  - 제목: `font-size:15px; font-weight:700; color:#1B2430`.
  - 개수 pill: `min-width:20px; height:20px; padding:0 6px; border-radius:10px; background:#F0F2F6; color:#7A8698; font-size:12px; font-weight:600`.
- 동작: 헤더 클릭 시 해당 섹션의 요구사항 목록 펼침/접힘.

#### Component: Requirement Row (요구사항 행, 접힌 상태)
- Layout: `display:flex; align-items:center; gap:12px; padding:11px 20px 11px 40px; cursor:pointer`. 상단 구분선 `border-top:1px solid #F1F3F7`.
- Hover: 행 배경 `#F7F9FC`.
- 요소(좌→우):
  - **상태 아이콘**: 18px 원+체크 (check-circle), `stroke:#D65A9A`, stroke-width 2, fill none.
  - **ID 배지**: 텍스트 `Requirement-N`. `font-family: monospace`; `font-size:12.5px; font-weight:600; color:#5B6B7C; padding:2px 8px; background:#EEF1F6; border-radius:6px`.
  - **미리보기 텍스트**(접힘 전용): `flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; color:#3C4653`.
  - **작업 카운트 메타**: `작업 N / 완료 M`. 기본 `font-size:12px; color:#9AA4B2`; 숫자 `<b>` 는 `color:#6B7684; font-weight:700`. **완료 수 M>0 이면** 완료 숫자 `color:#D6398E`.
  - **Chevron**: 16px, stroke `#98A2B0`, stroke-width 2.2. 접힘=오른쪽(`>`), 펼침=위(`^`).

#### Component: Requirement Row (펼친 상태 헤더)
- 접힌 상태와 동일하되 **미리보기 텍스트를 제거**하고 그 자리에 라벨 표시:
  - `요구사항 상세` — `font-size:12px; font-weight:600; letter-spacing:.02em; color:#AAB3C0`.
- Chevron 은 위쪽(`^`)으로.

#### Component: Expanded Detail (펼침 상세 영역)
- 컨테이너: `padding:2px 20px 20px 40px; background:#FBFCFE`.
- 내부 래퍼(커넥터): `border-left:2px solid #EDE1E9; padding-left:22px; padding-top:6px`.

- **라벨 헤딩 — 요구사항 본문**:
  - `display:flex; align-items:center; gap:7px; margin-bottom:8px`.
  - 앞 점: `width:5px; height:5px; border-radius:50%; background:#E36BA6`.
  - 텍스트 `요구사항 본문`: `font-size:11.5px; font-weight:700; letter-spacing:.04em; color:#B0788F`.
- **요구사항 본문 카드**:
  - `background:#FDF3F8; border:1px solid #F6DDEB; border-radius:8px; padding:13px 15px; font-size:14.5px; line-height:1.75; color:#38424E`.

- **라벨 헤딩 — 만족시키는 작업**:
  - `display:flex; align-items:center; gap:7px; margin:20px 0 10px`.
  - 앞 점: `background:#8AA0C4` (본문과 다른 색으로 구분).
  - 텍스트 `만족시키는 작업`: `font-size:11.5px; font-weight:700; letter-spacing:.04em; color:#7C8AA0`.
  - 개수 pill: `min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:#EDF1F7; color:#7C8AA0; font-size:11px; font-weight:700`.

- **Task Card (작업 카드)** — 작업이 있을 때, 세로 스택 `gap:8px`:
  - 카드: `display:flex; align-items:flex-start; gap:11px; background:#FFF; border:1px solid #E7ECF3; border-radius:9px; padding:11px 13px`.
  - **체크박스**(클릭 시 완료 토글, 행 토글로 전파 금지 = stopPropagation):
    - 미완료: 18px 사각형, `stroke:#BAC2CE; stroke-width:2; fill:none; rx:4`.
    - 완료: 채워진 사각형 `fill:#D6398E` + 흰 체크(`stroke:#fff`).
  - **Task 배지**: `Task-N`. monospace, `font-size:12px; font-weight:600; color:#5B6B7C; padding:2px 7px; background:#EEF1F6; border-radius:5px`.
  - **작업 텍스트**: `flex:1; min-width:0; font-size:13.5px; line-height:1.6; color:#3C4653`.
  - **완료 뱃지**(완료 시만): 별 아이콘(13px, `fill:#D6398E`) + `완료`. 텍스트 `color:#D6398E; font-size:12px; font-weight:700`.
- **작업 없음 empty state**: `border:1px dashed #DCE2EB; border-radius:9px; padding:16px; text-align:center; color:#9AA4B2; font-size:13px` — 문구 `아직 등록된 작업이 없습니다.`

- **액션 버튼**(옵션, `showActions` 참조): 상세 하단 `display:flex; gap:6px; margin-top:14px`.
  - 공통: `border:1px solid #E3E8EF; background:#fff; font-size:12.5px; font-weight:600; padding:6px 11px; border-radius:7px`.
  - `수정`(pencil 아이콘) 텍스트 `#6B7684`, hover 배경 `#F5F7FA`.
  - `삭제`(trash 아이콘) 텍스트 `#B9707E`, hover 배경 `#FCF3F5`.

## Interactions & Behavior
- **섹션 토글**: 섹션 헤더 클릭 → 하위 요구사항 목록 표시/숨김. 기본값: 모든 섹션 열림.
- **요구사항 토글**: 요구사항 행 클릭 → 펼침 상세 표시/숨김. 이때 헤더의 미리보기↔"요구사항 상세" 라벨, chevron 방향이 바뀐다. 기본값: `Requirement-2`만 열림(개선점을 보여주기 위함). 실제 앱에서는 전부 접힌 상태로 시작해도 무방.
- **작업 완료 토글**: 체크박스 클릭 → 해당 작업 done 토글. **요구사항 행 토글로 이벤트 전파를 막을 것**(stopPropagation). done 변경 시 상단 `완료 M` 카운트와 완료 뱃지가 즉시 갱신.
- 애니메이션: 펼침/접힘은 즉시 전환(원한다면 height/opacity 150–200ms ease 추가 가능, 필수 아님).
- Hover: 요구사항 행/버튼에 위 명시된 배경 hover만.

## State Management
- `openSections: Record<sectionId, boolean>` — 섹션 펼침 상태.
- `openRequirements: Record<requirementId, boolean>` — 요구사항 펼침 상태.
- `taskDone: Record<`${reqId}-${taskId}`, boolean>` — 작업 완료 상태.
- 파생값: 요구사항별 `taskCount = tasks.length`, `doneCount = tasks.filter(done).length`.
- 데이터 페칭: 실제 앱에선 섹션/요구사항/작업을 API로 로드. 아래 데이터 모델 참고.

### Data Model
```ts
type Task = { id: number; text: string; done: boolean };
type Requirement = { id: number; text: string; tasks: Task[] };
type Section = { id: string; title: string; requirements: Requirement[] };
```

## Configuration (props / 옵션)
- `expandByDefault: boolean` (기본 false) — 모든 요구사항을 펼친 채 시작할지.
- `showActions: boolean` (기본 true) — 상세 하단 수정/삭제 버튼 노출 여부.

## Design Tokens
**Colors**
- 페이지 배경 `#F4F6F9` · 카드 배경 `#FFFFFF` · 상세 배경 `#FBFCFE`
- 테두리: `#E6EAF0`(카드) · `#EEF1F6`/`#F1F3F7`(구분선) · `#E7ECF3`(작업카드) · `#F6DDEB`(본문카드) · `#E3E8EF`(버튼) · `#DCE2EB`(dashed)
- 텍스트: `#1B2430`(섹션제목) · `#38424E`/`#3C4653`(본문/작업) · `#5B6B7C`(ID/Task 배지) · `#6B7684`·`#7A8698`·`#9AA4B2`·`#AAB3C0`(메타/보조)
- 라벨: 본문 `#B0788F` · 작업 `#7C8AA0`
- 액센트(로즈): 상태아이콘 `#D65A9A` · 본문 점 `#E36BA6` · 완료/별/완료수 `#D6398E`
- 액센트(블루-그레이): 작업 점 `#8AA0C4`
- 배지/pill 배경: `#EEF1F6`(ID/Task) · `#F0F2F6`(섹션 개수) · `#EDF1F7`(작업 개수)
- 커넥터 라인 `#EDE1E9`
- Hover 배경: 행 `#F7F9FC` · 수정 `#F5F7FA` · 삭제 `#FCF3F5`

**Typography**
- 본문 폰트: `Pretendard, 'Malgun Gothic', system-ui, sans-serif`
- ID/Task 배지: monospace 스택 (`ui-monospace, 'SF Mono', Menlo, Consolas, monospace`)
- 크기: 섹션제목 15/700 · 미리보기·본문 14–14.5 · 작업 13.5 · ID 12.5/600 · 메타 12 · 라벨 11.5/700(letter-spacing .04em)

**Radius**: 14(카드) · 10(섹션 pill) · 9(작업카드/empty) · 8(본문카드) · 7(버튼) · 6(ID 배지) · 5(Task 배지)

**Spacing**: 컨테이너 `28/20/80` · 섹션헤더 `14/20` · 요구사항행 `11/20/11/40` · 상세 `2/20/20/40` + 커넥터 `padding-left:22` · gap 6–12

**Shadow**: 카드 `0 1px 2px rgba(20,30,50,.04)`

## Assets
- 별도 이미지 없음. 아이콘은 전부 인라인 SVG(stroke 기반): check-circle, chevron(right/down/up), checkbox(빈/채움), star, pencil, trash. 코드베이스의 아이콘 라이브러리(예: lucide-react — CircleCheck, ChevronRight/Down/Up, Square/CheckSquare, Star, Pencil, Trash2)로 대체 권장.
- 폰트 Pretendard: CDN(`jsdelivr orioncactus/pretendard`)로 로드했으나, 코드베이스에 이미 있는 폰트로 대체 가능.

## Files
- `Requirements.dc.html` — 개선된 디자인 프로토타입(인터랙션 포함). 시각/동작의 최종 기준.
