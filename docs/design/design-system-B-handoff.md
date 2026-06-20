# Canopy 디자인 시스템 — impl 구현 핸드오프 (B안 "Pixel Blossom")

> **대상**: impl 멤버. 이 문서만 보고 정확히 구현할 수 있도록 작성.
> **확정 컨셉**: B — Pixel Blossom (흰 배경 + 핑크 악센트 + 픽셀 시그니처).
> **폰트**: 메이플스토리체 2-tier (main 채택). **Galmuri 등 2차 디스플레이체 사용 금지.**
> **적용 순서 주의**: 실제 코드 적용은 **main dispatch 후** 진행. 이 문서는 사양/소스 제공.
> **참고 시각본**: [mockup-B-final.html](mockup-B-final.html) (이 문서의 모든 토큰·아이콘이 실제로 렌더된 모습).

---

## 0. 핵심 원칙 (3줄)
1. **캔버스는 흰색**, 핑크(Sakura/Plum)는 **악센트만** — 브랜드·선택·완료·EXP 채움·강조.
2. **픽셀 정체성 = 시각요소**(픽셀 스프라이트 아이콘 · 레트로 EXP 칸 진행바 · 벚꽃 개화 상태글리프). 폰트 아님.
3. **메이플체 = 간판(≥16px Bold)만**, 그 외 밀집·숫자 전부 **Pretendard**(+ tabular-nums).

---

## 1. 컬러 토큰

### 1-1. 팔레트 (정본 = HEX)
| 토큰 | 역할 | HEX | OKLCH(shadcn용·근사) |
|---|---|---|---|
| `--c-bg` | 캔버스 배경(앱) | `#FFFFFF` | `1 0 0` |
| `--c-bg-sunken` | 페이지/뒤 배경 | `#F1EFF1` | `0.945 0.004 350` |
| `--c-surface` | 사이드바/미묘한 면 | `#FCFBFC` | `0.990 0.002 350` |
| `--c-ink` | 본문 잉크(순검정❌, 웜차콜) | `#272129` | `0.27 0.012 350` |
| `--c-ink-2` | 보조 텍스트 | `#6E646C` | `0.49 0.012 350` |
| `--c-ink-3` | 흐린 텍스트/플레이스홀더 | `#A89FA4` | `0.70 0.008 350` |
| `--c-line` | 헤어라인(저투명) | `rgba(40,28,40,.075)` | — |
| `--c-line-2` | 살짝 진한 헤어라인 | `rgba(40,28,40,.12)` | — |
| `--c-sakura` | 브랜드/primary/완료-만개/EXP채움 | `#E88AAB` | `0.74 0.105 357` |
| `--c-plum` | **핑크 텍스트/활성**(대비 확보용) | `#C24E78` | `0.58 0.155 357` |
| `--c-plum-d` | press/강한 활성 | `#A53E66` | `0.50 0.150 357` |
| `--c-peach` | 진행중/반개 | `#EC9A78` | `0.77 0.095 50` |
| `--c-peach-d` | 진행중 텍스트(대비) | `#BE6A3F` | `0.585 0.110 52` |
| `--c-mist` | 할일/muted 상태 | `#ABA2A8` | `0.71 0.008 350` |
| `--c-ember` | 경고/미커버 UR/막힌 작업 | `#D85F6E` | `0.62 0.155 12` |
| `--c-pink-bg` | 선택 행/칩 배경(연핑크) | `#FBEAF1` | `0.94 0.022 350` |
| `--c-exp-empty` | EXP 빈 칸 | `#EFE6EA` | `0.93 0.008 350` |

> **대비 규칙(WCAG AA)**: 흰 배경 위 **작은 핑크 텍스트는 반드시 `--c-plum`** (Sakura는 대비 부족). `--c-sakura`는 **채움/큰글자/장식**에만. 완료 텍스트=plum, 진행중 텍스트=peach-d.
> OKLCH 값은 근사치 — 미세조정 필요하면 impl이 tweakcn(tweakcn.com/editor)에 HEX 붙여 export 해도 됨. 정본은 HEX.

### 1-2. shadcn 시맨틱 매핑 — `src/index.css` `:root` 교체
현재 무채색 토큰을 아래로 교체(라이트만; **다크모드는 이번 범위 밖**, 추후 별도 파생).

```css
:root {
  --radius: 0.625rem;            /* 컨트롤 기본 라운드(유지) */
  --radius-card: 1rem;           /* 카드/패널 라운드(B는 살짝 둥글게) */

  --background: oklch(1 0 0);
  --foreground: oklch(0.27 0.012 350);          /* ink */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.27 0.012 350);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.27 0.012 350);

  --primary: oklch(0.74 0.105 357);             /* Sakura */
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.97 0.006 350);
  --secondary-foreground: oklch(0.49 0.012 350);
  --muted: oklch(0.97 0.004 350);
  --muted-foreground: oklch(0.49 0.012 350);    /* ink-2 */
  --accent: oklch(0.94 0.022 350);              /* pink-bg (hover/선택) */
  --accent-foreground: oklch(0.58 0.155 357);   /* plum */
  --destructive: oklch(0.62 0.155 12);          /* ember */

  --border: rgba(40,28,40,.075);
  --input: rgba(40,28,40,.12);
  --ring: oklch(0.58 0.155 357);                /* plum — 포커스 링 */

  /* 커스텀 토큰(시맨틱 외 직접 사용) */
  --c-plum: #C24E78;  --c-plum-d:#A53E66;
  --c-peach:#EC9A78;  --c-peach-d:#BE6A3F;
  --c-mist:#ABA2A8;   --c-ember:#D85F6E;
  --c-pink-bg:#FBEAF1; --c-exp-empty:#EFE6EA;
  --c-bg-sunken:#F1EFF1; --c-surface:#FCFBFC;
  --c-line:rgba(40,28,40,.075); --c-line-2:rgba(40,28,40,.12);
}
```
`@theme inline` 블록에 노출 토큰 추가(필요 시):
```css
@theme inline {
  --radius-card: var(--radius-card);
  --color-plum: var(--c-plum);
  --color-peach: var(--c-peach);
  --color-mist: var(--c-mist);
  --color-pink-bg: var(--c-pink-bg);
  --color-exp-empty: var(--c-exp-empty);
  /* …기존 매핑 유지… */
}
```

---

## 2. 타이포그래피 (메이플체 2-tier)

### 2-1. 폰트 소스 & @font-face
- **메이플스토리체**(Nexon, 상업적 무료) — `Maplestory Light`, `Maplestory Bold` 2종.
  woff2로 변환 + **한글 서브셋** 권장(용량↓). 파일은 `public/fonts/` 또는 `src/assets/fonts/`.
- **Pretendard** — 이미 CDN/패키지 사용 가능(웹폰트). 본문 일꾼.

```css
/* src/index.css 상단 */
@font-face{
  font-family:"Maplestory"; font-weight:700; font-style:normal; font-display:swap;
  src:url("/fonts/Maplestory-Bold.subset.woff2") format("woff2");
}
@font-face{
  font-family:"Maplestory"; font-weight:300; font-style:normal; font-display:swap;
  src:url("/fonts/Maplestory-Light.subset.woff2") format("woff2");
}

@layer base {
  :root{
    --font-display:"Maplestory","Pretendard Variable",Pretendard,system-ui,sans-serif;
    --font-sans:"Pretendard Variable",Pretendard,system-ui,sans-serif;
  }
  body{ font-family:var(--font-sans); color:var(--foreground);
        background:var(--background); font-feature-settings:"tnum" 1; }
  .font-display{ font-family:var(--font-display); font-weight:700; letter-spacing:-0.01em; }
  .tnum{ font-variant-numeric: tabular-nums; }
}
```
> **fallback이 Pretendard**라 메이플체 로딩 전에도 레이아웃 안 깨짐.

### 2-2. 적용 규칙 (어디에 무엇을)
| 구분 | 폰트 | 크기/굵기 | 적용처 |
|---|---|---|---|
| **Tier1 메이플체 Bold** | `.font-display` | **≥16px, Bold 고정** | 브랜드 워드마크, 뷰/섹션 제목, **이슈 상세 제목(21px)**, 보드 컬럼 헤더, 빈상태 헤드라인, 대시보드 큰 숫자 |
| **Tier2 Pretendard** | 기본 | 11~14px | 트리 행(13px), 뱃지/상태 라벨(11.5px), 칸반 카드 본문, 폼/select, 브레드크럼, 설명문, **티켓키·진행률·카운트** |

**금지/주의**
- 메이플체 **Light는 UI 금지**(작은 크기 가독성 최악). Light는 28px+ 장식 숫자에만 선택적.
- **밀집요소(뱃지·상태·티켓키·트리행)는 Pretendard만.** 메이플체 절대 안 씀.
- **모든 숫자(%, 카운트, 티켓번호)는 Pretendard `.tnum`** — 메이플체는 tabular 불가, 숫자 흔들림.
- 행간: 메이플체 제목 line-height **1.25~1.35**(둥근체라 여유). Pretendard 본문 1.5~1.6.

---

## 3. 아이콘 — 픽셀 스프라이트 (lucide 교체)

현재 [src/nodes/TreeView.tsx](../../src/nodes/TreeView.tsx) `ICONS`(lucide)를 **커스텀 픽셀 스프라이트**로 교체.
신규 파일 `src/nodes/pixelIcons.tsx` 제안. 전부 16 viewBox, `fill="currentColor"`, `shape-rendering="crispEdges"`(픽셀 또렷).

```tsx
// src/nodes/pixelIcons.tsx
import type { SVGProps } from "react"
const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16, height: 16, viewBox: "0 0 16 16",
  fill: "currentColor", shapeRendering: "crispEdges" as const, ...p,
})

// 컨텐츠 = 픽셀 벚꽃나무
export const IconContent = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="6" y="1" width="4" height="2"/><rect x="4" y="3" width="8" height="2"/>
    <rect x="2" y="5" width="12" height="2"/><rect x="4" y="7" width="8" height="2"/>
    <rect x="7" y="9" width="2" height="5" opacity=".4"/>
  </svg>
)
// 기능 = 픽셀 블록 2x2
export const IconFeature = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5" opacity=".5"/>
    <rect x="2" y="9" width="5" height="5" opacity=".5"/><rect x="9" y="9" width="5" height="5"/>
  </svg>
)
// 세부기능 = 픽셀 노드-플로우
export const IconSubFeature = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="3" height="3"/><rect x="11" y="6" width="3" height="3"/>
    <rect x="2" y="11" width="3" height="3"/>
    <rect x="5" y="3" width="6" height="1.6" opacity=".5"/><rect x="5" y="11.4" width="6" height="1.6" opacity=".5"/>
  </svg>
)
// 마스터데이터 = 픽셀 카드 스택
export const IconMasterData = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="2" width="8" height="10" opacity=".4"/><rect x="5" y="4" width="8" height="10"/>
  </svg>
)
// 작업 = 픽셀 체크박스(빈 프레임)
export const IconTask = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="12" height="2"/><rect x="2" y="12" width="12" height="2"/>
    <rect x="2" y="2" width="2" height="12"/><rect x="12" y="2" width="2" height="12"/>
  </svg>
)
```
**색 운용**: 타입 아이콘은 기본 `--c-ink-3`(muted), **컨텐츠(나무)만 `--c-sakura`** 1점 강조 → 무지개 금지·절제. (선택 행에선 plum로.)

---

## 4. 상태 글리프 — 벚꽃 개화 (status/뱃지)

[src/nodes/NodeBadges.tsx](../../src/nodes/NodeBadges.tsx) `StatusBadge`를 **개화 글리프 + 라벨**로 교체.
개화 정도 = 상태 카테고리: 빈꽃(할일)→복숭아꽃(진행중)→만개(완료)→시듦(취소).

```tsx
// src/nodes/bloomGlyph.tsx
import type { SVGProps } from "react"
const petals = [["8","3.7"],["12.3","6.4"],["10.6","11.4"],["5.4","11.4"],["3.7","6.4"]]
// 만개(완료)
export const BloomFull = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 16 16" {...p}>
    <g fill="currentColor">{petals.map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="2.3"/>)}</g>
    <circle cx="8" cy="8" r="1.7" fill="#C24E78"/>
  </svg>
)
// 반개(진행중) — 살짝 작게
export const BloomHalf = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 16 16" {...p}>
    <g fill="currentColor">{[["8","4"],["12","6.6"],["10.4","11.2"],["5.6","11.2"],["4","6.6"]]
      .map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="2.1"/>)}</g>
    <circle cx="8" cy="8" r="1.5" fill="#BE6A3F"/>
  </svg>
)
// 빈꽃(할일) — 외곽선만
export const BloomEmpty = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth="1.2" {...p}>
    {[["8","4"],["12","6.6"],["10.4","11.2"],["5.6","11.2"],["4","6.6"]]
      .map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="2.1"/>)}
  </svg>
)
// 시듦(취소) — 흐린 채움
export const BloomWilt = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 16 16" opacity=".55" {...p}>
    <g fill="currentColor">{petals.map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="2.1"/>)}</g>
  </svg>
)
```
**카테고리 → 글리프·색**: `lib/statuses.ts`의 `CATEGORY_COLOR` 갱신 + 글리프 매핑.
| category | 글리프 | 색(글리프) | 라벨 텍스트색 |
|---|---|---|---|
| 할일 | BloomEmpty | `--c-mist` | `--c-mist` |
| 진행중 | BloomHalf | `--c-peach` | `--c-peach-d` |
| 완료 | BloomFull | `--c-sakura` | `--c-plum` |
| 취소됨 | BloomWilt | `--c-mist` | `--c-ink-3` |

```ts
// src/lib/statuses.ts — CATEGORY_COLOR 교체
export const CATEGORY_COLOR: Record<StatusCategory, string> = {
  할일:   "#ABA2A8",  // mist
  진행중: "#EC9A78",  // peach
  완료:   "#E88AAB",  // sakura
  취소됨: "#ABA2A8",  // mist(흐림)
}
```
> `StatusBadge`는 기존처럼 `status.color`(커스텀) 우선 → 없으면 위 CATEGORY_COLOR.
> **테두리 친 알약 뱃지 폐기**: `[글리프][라벨]` 인라인(테두리·배경 없음). 라벨 11.5px / weight 550 / 위 텍스트색.

---

## 5. 진행바 — 레트로 EXP 칸 (ProgressBadge 교체)

매끈한 바([NodeBadges.tsx](../../src/nodes/NodeBadges.tsx) `ProgressBadge` `bg-primary`)를 **하드코너 픽셀 칸**으로.

```tsx
// EXP 칸: 4칸 고정 + 정확한 % 텍스트(Pretendard tnum)
function ExpBar({ progress }: { progress: number }) {  // progress: 0..1
  const cells = 4
  const filled = Math.round(progress * cells)
  const pct = Math.round(progress * 100)
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-[2.5px]">
        {Array.from({ length: cells }).map((_, i) => (
          <span key={i} className="h-[9px] w-[9px] rounded-[1.5px]"
            style={{ background: i < filled ? "var(--primary)" : "var(--c-exp-empty)" }}/>
        ))}
      </span>
      <span className="tnum w-7 text-right text-[10.5px]" style={{ color: "var(--c-plum)" }}>{pct}%</span>
    </span>
  )
}
```
- 하위작업 0개(progress null) → 기존처럼 중립 `—`(`--c-ink-3`).
- **UR 커버리지**(기능/상세의 `[작업 n/완료 m]`)는 칸 수 = total(최대 6캡), 채움 = done. 정확수치라 quantize 아님. `2/2`, `1/3` 텍스트는 Pretendard tnum.

---

## 6. 컴포넌트별 적용 패턴

### 6-1. 트리 행 ([TreeView.tsx](../../src/nodes/TreeView.tsx))
- 행 높이 30px, radius 8px, gap 7px.
- hover `rgba(40,28,40,.045)`, **선택** `--c-pink-bg` + **좌측 2px Sakura 액센트 레일**(`::before`), 선택 시 제목 weight 600.
- 들여쓰기 가이드선(`.branch::before`) 1.5px `--c-line-2`. **시그니처 "꽃핀 가지"**: 선택 노드의 조상 경로 가지선만 `linear-gradient(var(--primary), rgba(232,138,171,.25))`로 물들임(=완료/활성 빛). 과용 금지 — 활성 경로만.
- 작업 행 우측 = 상태 글리프, 비-잎 노드 = ExpBar.

### 6-2. 상세 패널 ([NodeDetail.tsx](../../src/nodes/NodeDetail.tsx)) — property 칩
**"Label+Select 스택 폼" 폐기 → Linear식 property 칩 행.** (네이티브 select 접근성은 유지하되 칩처럼 restyle.)
- 상단: 브레드크럼(전장 / 소환수 / …) `--c-ink-3` 12px → 티켓키(Pretendard tnum, `--c-plum`, 11.5px) + 복사 ghost + 타입태그(픽셀 아이콘+라벨, 우측).
- 제목: **메이플체 Bold 21px**(`.font-display`), `--c-ink`.
- 작업 필드(상태/도메인/담당): 가로 **칩 행**. 칩 = 높이 30px, padding 9~10px, radius 9px, bg `#F5F2F4`, hover `#EFE7EC`, `[작은라벨(ink-3)][값(+상태글리프/아바타)][chevron]`.
- 구분선 = 1px `--c-line`. 설명(body) = 테두리 textarea 대신 차분한 텍스트 블록(편집모드 진입 시만 입력 UI), 13.5px/lh 1.7/`--c-ink-2`.
- "연결된 UR" 섹션: 라벨(10.5px ink-3) + 카운트 핀(연핑크) + `UR 연결` ghost. 행 = `[상태글리프][UR텍스트][n/m + EXP칸]`. **미커버 UR** = 경고삼각(`--c-ember`) + `미커버` 태그(`bg rgba(216,95,110,.12)`), 행 텍스트 ember.

### 6-3. 상단바 ([App.tsx](../../src/App.tsx))
- 브랜드 = 벚꽃 글리프(BloomFull sakura) + **"Canopy" 메이플체 Bold 14~15px**.
- 프로젝트 스위처: `[TD 키칩(연핑크)][이름(Pretendard 600)][chevron]`.
- 검색 = pill, `⌘K` 힌트(Pretendard, kbd). 뷰 탭 = 세그먼트 컨트롤(활성 = 흰 칩 + soft shadow). primary "이슈" 버튼(Sakura, 흰 글자, inset 하이라이트). 아바타 = 핑크 그라데 + 이니셜.

---

## 7. 기타 토큰
- **Radius**: 컨트롤 `--radius`(10px), 카드/패널 `--radius-card`(16px), 칩 9px, 트리행 8px, EXP칸 1.5px(거의 각짐 — 픽셀감).
- **Shadow(소프트·핑크틴트)**: 앱 셸 `0 1px 2px rgba(90,40,60,.05), 0 10px 26px -10px rgba(120,50,80,.16), 0 30px 60px -24px rgba(120,50,80,.10)`. 내부 면은 테두리 대신 헤어라인+여백.
- **Spacing**: 8px 그리드. 상세 패널 padding 24~28px, 섹션 간 22px.
- **Transition**: hover/상태 120~150ms.

---

## 8. 품질 바닥 (필수)
- **대비(AA)**: 작은 핑크 텍스트 = `--c-plum`(Sakura❌). 완료=plum, 진행중=peach-d. 상태는 색만이 아니라 **글리프 모양**으로도 구분(색맹 대응).
- **포커스 링**: `--ring`(plum) `outline`/`ring` 가시. 키보드 인라인추가/단축키 흐름 유지.
- **reduced-motion**: 개화/꽃잎 모션은 `@media (prefers-reduced-motion: reduce)` 시 정지. EXP·선택 전환은 무방.
- **메이플체 로딩**: `font-display:swap` + Pretendard fallback → FOUT만, 레이아웃 시프트 최소.
- **반응형**: 트리(286px) ↔ 상세 분할, 모바일 폭에서 스택/드로어 전환.

---

## 9. impl 적용 체크리스트
- [ ] `index.css`: 폰트 @font-face(메이플체 2종) + `:root` 토큰 교체 + `@theme` 노출 + base 폰트/유틸(`.font-display`,`.tnum`).
- [ ] `public/fonts/`: Maplestory Bold/Light woff2(서브셋) 배치.
- [ ] `src/nodes/pixelIcons.tsx` 신규 + `TreeView.ICONS` 교체(타입색 운용 반영).
- [ ] `src/nodes/bloomGlyph.tsx` 신규.
- [ ] `lib/statuses.ts` `CATEGORY_COLOR` 개화 램프로.
- [ ] `NodeBadges.tsx`: `StatusBadge`(개화 글리프+라벨, 테두리 폐기) / `ProgressBadge`(EXP 칸).
- [ ] `NodeDetail.tsx`: property 칩 행 + 브레드크럼 + UR 섹션(미커버 강조).
- [ ] `TreeView.tsx`: 행 hover/선택 레일 + "꽃핀 가지" 가이드선(활성 경로만).
- [ ] `App.tsx`: 브랜드(메이플체)·스위처·세그먼트탭·검색·primary 버튼.
- [ ] **검증**: 메이플체가 ≥16px·제목/브랜드에만 적용됐는지 / 밀집·숫자가 Pretendard tnum인지 / Galmuri 미사용 / 작은 핑크텍스트 plum인지 / 포커스·reduced-motion.
- [ ] webapp-testing(localhost:5173) 스크린샷으로 실데이터에서 가독성·대비 최종 확인.

---

### 변경 영향 파일 한눈
[src/index.css](../../src/index.css) · [src/App.tsx](../../src/App.tsx) · [src/nodes/TreeView.tsx](../../src/nodes/TreeView.tsx) · [src/nodes/NodeBadges.tsx](../../src/nodes/NodeBadges.tsx) · [src/nodes/NodeDetail.tsx](../../src/nodes/NodeDetail.tsx) · [src/nodes/nodeGrammar.ts](../../src/nodes/nodeGrammar.ts) · [src/lib/statuses.ts](../../src/lib/statuses.ts) · 신규 `src/nodes/pixelIcons.tsx`, `src/nodes/bloomGlyph.tsx`
